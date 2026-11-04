import type { ClientRole, RetrySweepReport } from '@gc3/types';
import { generateInviteToken } from '../auth/invite';
import { env } from '../config/env';
import { prisma } from '../db/client';
import { notificationRepository } from '../repositories/notification.repository';
import { buildInviteUrl, notifications } from './index';
import type { DeliveryReceipt } from './types';

/**
 * Retry schedule for a failed notification.
 *
 * Deliberately slow and bounded: an invite email is not a chat message. Five
 * attempts spread over roughly eight hours rides out a relay outage without
 * hammering a provider that is already unhappy, and stops before an invitation
 * link is a week stale.
 */
const BACKOFF_SECONDS = [60, 300, 900, 3_600, 21_600] as const;

/** Delay before the retry that follows `attempt` (1-based). */
export function backoffSeconds(attempt: number): number {
  const index = Math.min(Math.max(attempt, 1), BACKOFF_SECONDS.length) - 1;
  return BACKOFF_SECONDS[index] ?? BACKOFF_SECONDS[BACKOFF_SECONDS.length - 1]!;
}

/**
 * When the next attempt is due, or null when the chain is over because
 * `attempt` has reached NOTIFICATION_MAX_ATTEMPTS.
 */
export function nextAttemptAfter(attempt: number, from: Date = new Date()): Date | null {
  if (attempt >= env.NOTIFICATION_MAX_ATTEMPTS) {
    return null;
  }

  return new Date(from.getTime() + backoffSeconds(attempt) * 1_000);
}

/**
 * One retry sweep.
 *
 * Invitations cannot be replayed from the audit row: only the token *hash* is
 * stored, so there is no link to resend. A retry therefore rotates the invite
 * token and re-sends. That is safe for the case this exists for — the previous
 * attempt failed — but it does mean a retry invalidates any link from an earlier
 * attempt, including the ambiguous case where SMTP timed out after accepting the
 * message. When that matters, the operator's answer is a deliberate resend, not
 * this worker.
 */
export async function runRetrySweep(
  options: { now?: Date; limit?: number; organizationId?: string } = {},
): Promise<RetrySweepReport> {
  const now = options.now ?? new Date();
  const limit = options.limit ?? 25;

  const due = await notificationRepository.findDueRetries(now, limit, options.organizationId);

  const report = { processed: 0, sent: 0, failed: 0, exhausted: 0, skipped: 0 };

  for (const row of due) {
    // Claim first: clearing the schedule is what stops two overlapping sweeps
    // from sending the same invitation twice.
    const claimed = await notificationRepository.claimRetry(row.id, now);

    if (!claimed) {
      continue;
    }

    report.processed += 1;

    // Never exceed the budget, even if a stale schedule survived a crash or a
    // manual edit: budget spent means no further send.
    if (row.attempt >= env.NOTIFICATION_MAX_ATTEMPTS) {
      await notificationRepository.abandonRetry(
        row.id,
        `Retry budget exhausted after ${row.attempt} attempts`,
      );
      report.exhausted += 1;
      continue;
    }

    const membership = await prisma.membership.findFirst({
      where: { id: row.membershipId },
      include: {
        user: { select: { email: true, fullName: true } },
        organization: { select: { name: true } },
      },
    });

    // Nothing left to deliver: the invite was accepted, revoked, or the
    // membership is gone. Retrying would email a dead link.
    if (!membership || membership.status !== 'INVITED') {
      await notificationRepository.abandonRetry(
        row.id,
        'Not retried: the invitation is no longer awaiting acceptance',
      );
      report.skipped += 1;
      continue;
    }

    const attempt = row.attempt + 1;
    const generated = generateInviteToken();

    await prisma.membership.update({
      where: { id: membership.id },
      data: {
        inviteTokenHash: generated.tokenHash,
        inviteTokenExpiresAt: generated.expiresAt,
      },
    });

    let receipt: DeliveryReceipt;

    try {
      receipt = await notifications.current.sendInvite({
        to: membership.user.email,
        fullName: membership.user.fullName,
        organizationName: membership.organization.name,
        roles: membership.roles as ClientRole[],
        inviteUrl: buildInviteUrl(generated.token),
        expiresAt: generated.expiresAt,
        kind: row.kind === 'RESENT' ? 'resent' : 'invitation',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      receipt = { status: 'failed', driver: notifications.current.driver, error: message };
    }

    const schedule = receipt.status === 'failed' ? nextAttemptAfter(attempt, now) : null;

    await notificationRepository.record({
      organizationId: row.organizationId,
      membershipId: membership.id,
      userId: row.userId,
      kind: row.kind === 'RESENT' ? 'resent' : 'invitation',
      driver: receipt.driver,
      status: receipt.status,
      recipient: membership.user.email,
      ...(receipt.messageId ? { messageId: receipt.messageId } : {}),
      ...(receipt.error ? { error: receipt.error } : {}),
      attempt,
      lastAttemptAt: now,
      nextAttemptAt: schedule,
    });

    if (receipt.status === 'sent') {
      report.sent += 1;
    } else if (schedule) {
      report.failed += 1;
    } else {
      report.exhausted += 1;
    }
  }

  return report;
}

/**
 * Periodic sweeper. Started from the server bootstrap, disabled in tests (they
 * call the endpoint) and when the interval is 0. `unref()` keeps it from holding
 * the process open on shutdown.
 */
export function startRetryWorker(): NodeJS.Timeout | null {
  if (env.NODE_ENV === 'test' || env.NOTIFICATION_RETRY_INTERVAL_SECONDS <= 0) {
    return null;
  }

  const timer = setInterval(() => {
    void runRetrySweep()
      .then((report) => {
        if (report.processed > 0) {
          console.log(
            `[gc3-api][notifications] retry sweep processed=${report.processed} sent=${report.sent} failed=${report.failed} exhausted=${report.exhausted} skipped=${report.skipped}`,
          );
        }
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[gc3-api][notifications] retry sweep failed: ${message}`);
      });
  }, env.NOTIFICATION_RETRY_INTERVAL_SECONDS * 1_000);

  timer.unref();
  return timer;
}
