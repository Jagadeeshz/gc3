import type { ClientRole, RetrySweepReport } from '@gc3/types';
import { generateInviteToken } from '../auth/invite';
import { env } from '../config/env';
import { prisma } from '../db/client';
import { notificationRepository } from '../repositories/notification.repository';
import { buildEventPayload, loadEventSubject, type EventJob } from './events';
import { buildInviteUrl, notifications } from './index';
import { backoffSeconds, nextAttemptAfter } from './schedule';
import type { DeliveryReceipt } from './types';

// The backoff schedule lives in ./schedule so the event dispatcher can share it
// without importing this module back.
export { backoffSeconds, nextAttemptAfter } from './schedule';

/**
 * Retry a failed *event* notification.
 *
 * Unlike an invitation, nothing needs rotating: the message is rebuilt from the
 * request and deliverable the delivery row points at. If either is gone, the retry
 * is abandoned rather than sending a link to nothing.
 */
async function retryEventDelivery(
  row: {
    id: string;
    organizationId: string;
    userId: string;
    kind: 'DELIVERABLE_RELEASED' | 'REQUEST_STATUS_UPDATED';
    subjectRequestId: string | null;
    subjectDeliverableId: string | null;
    attempt: number;
  },
  now: Date,
  report: { sent: number; failed: number; exhausted: number; skipped: number },
): Promise<void> {
  if (!row.subjectRequestId) {
    await notificationRepository.abandonRetry(row.id, 'Not retried: no subject request on this delivery');
    report.skipped += 1;
    return;
  }

  if (row.kind === 'DELIVERABLE_RELEASED' && !row.subjectDeliverableId) {
    await notificationRepository.abandonRetry(row.id, 'Not retried: no subject deliverable on this delivery');
    report.skipped += 1;
    return;
  }

  const user = await prisma.user.findFirst({
    where: { id: row.userId, deletedAt: null },
    select: { id: true, email: true, fullName: true, status: true },
  });

  if (!user || user.status !== 'ACTIVE') {
    await notificationRepository.abandonRetry(row.id, 'Not retried: the recipient is no longer active');
    report.skipped += 1;
    return;
  }

  const job: EventJob =
    row.kind === 'DELIVERABLE_RELEASED'
      ? {
          kind: 'deliverable_released',
          organizationId: row.organizationId,
          requestId: row.subjectRequestId,
          deliverableId: row.subjectDeliverableId!,
        }
      : {
          kind: 'request_status_updated',
          organizationId: row.organizationId,
          requestId: row.subjectRequestId,
          // The original from/to are not stored; a retry reports the status as it
          // is now, which stays true even if the request moved on meanwhile.
          fromStatus: '',
          toStatus: '',
        };

  const subject = await loadEventSubject(job);

  if (!subject) {
    await notificationRepository.abandonRetry(row.id, 'Not retried: the request or deliverable no longer exists');
    report.skipped += 1;
    return;
  }

  const effectiveJob: EventJob =
    job.kind === 'request_status_updated'
      ? { ...job, toStatus: subject.requestStatus }
      : job;

  const payload = buildEventPayload(effectiveJob, subject, {
    userId: user.id,
    email: user.email,
    fullName: user.fullName,
  });

  let receipt: DeliveryReceipt;

  try {
    receipt = await notifications.current.sendEvent(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    receipt = { status: 'failed', driver: notifications.current.driver, error: message };
  }

  const attempt = row.attempt + 1;
  const schedule = receipt.status === 'failed' ? nextAttemptAfter(attempt, now) : null;

  await notificationRepository.record({
    organizationId: row.organizationId,
    userId: row.userId,
    kind: row.kind === 'DELIVERABLE_RELEASED' ? 'deliverable_released' : 'request_status_updated',
    driver: receipt.driver,
    status: receipt.status,
    recipient: user.email,
    ...(receipt.messageId ? { messageId: receipt.messageId } : {}),
    ...(receipt.error ? { error: receipt.error } : {}),
    attempt,
    lastAttemptAt: now,
    nextAttemptAt: schedule,
    subjectRequestId: row.subjectRequestId,
    subjectDeliverableId: row.subjectDeliverableId,
  });

  if (receipt.status === 'sent') {
    report.sent += 1;
  } else if (schedule) {
    report.failed += 1;
  } else {
    report.exhausted += 1;
  }
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

    // Event notifications go to a user, not a membership, and are rebuilt from the
    // request/deliverable they point at. Handle them before touching membership.
    if (row.kind === 'DELIVERABLE_RELEASED' || row.kind === 'REQUEST_STATUS_UPDATED') {
      await retryEventDelivery(
        {
          id: row.id,
          organizationId: row.organizationId,
          userId: row.userId,
          kind: row.kind,
          subjectRequestId: row.subjectRequestId,
          subjectDeliverableId: row.subjectDeliverableId,
          attempt: row.attempt,
        },
        now,
        report,
      );
      continue;
    }

    if (!row.membershipId) {
      await notificationRepository.abandonRetry(row.id, 'Not retried: no membership on this delivery');
      report.skipped += 1;
      continue;
    }

    const membership = await prisma.membership.findFirst({
      where: { id: row.membershipId },
      include: {
        user: { select: { email: true, fullName: true } },
        organization: { select: { name: true } },
      },
    });

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
