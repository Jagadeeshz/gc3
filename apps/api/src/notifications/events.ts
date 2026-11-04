import { env } from '../config/env';
import { prisma } from '../db/client';
import type { ServiceRequestStatus } from '@gc3/types';
import { computeSlaState } from '../lib/sla';
import { notificationRepository } from '../repositories/notification.repository';
import { notifications } from './index';
import { nextAttemptAfter } from './schedule';
import type { EventEmailPayload } from './types';

/**
 * Event notifications.
 *
 * Two shapes today: a deliverable was released, and a request changed status.
 * Both are dispatched *after* the response — the state change is committed first,
 * and a mail problem must never fail an API call that already succeeded.
 *
 * The queue is in-process. That is honest for a single-node portal and it is the
 * seam where a durable queue (BullMQ on the Redis already in config) belongs when
 * this needs to survive a restart. What is not deferred: every attempt is written
 * to `notification_deliveries`, so nothing disappears silently.
 */
export type EventJob =
  | {
      readonly kind: 'deliverable_released';
      readonly organizationId: string;
      readonly requestId: string;
      readonly deliverableId: string;
    }
  | {
      readonly kind: 'request_status_updated';
      readonly organizationId: string;
      readonly requestId: string;
      readonly fromStatus: string;
      readonly toStatus: string;
    }
  | {
      readonly kind: 'sla_risk';
      readonly organizationId: string;
      readonly requestId: string;
      readonly state: string;
    };

interface Recipient {
  readonly userId: string;
  readonly email: string;
  readonly fullName: string;
}

const queue: EventJob[] = [];
let pending: Promise<void> | null = null;

/** Adds a job and starts draining without waiting for it. */
export function enqueueEvent(job: EventJob): void {
  queue.push(job);
  schedule();
}

/**
 * Processes everything queued, and anything queued while it runs. Exported so
 * tests can await dispatch deterministically instead of sleeping.
 */
export async function drainEventQueue(): Promise<void> {
  schedule();
  await pending;
}

export function pendingEventJobs(): number {
  return queue.length;
}

function schedule(): void {
  if (pending) {
    return;
  }

  pending = run().finally(() => {
    pending = null;
  });
}

async function run(): Promise<void> {
  while (queue.length > 0) {
    const job = queue.shift();

    if (!job) {
      break;
    }

    try {
      await processJob(job);
    } catch (error) {
      // The API response has already gone out; log loudly and keep the queue moving.
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[gc3-api][notifications] event dispatch failed (${job.kind}): ${message}`);
    }
  }
}

/**
 * Who hears about a release: the people in the tenant who own or approve client
 * output. Not every member — a team member cannot act on a release.
 */
async function releaseRecipients(organizationId: string): Promise<Recipient[]> {
  const memberships = await prisma.membership.findMany({
    where: {
      organizationId,
      status: 'ACTIVE',
      roles: { hasSome: ['CLIENT_OWNER', 'CLIENT_APPROVER'] },
      user: { status: 'ACTIVE', deletedAt: null },
    },
    include: { user: { select: { id: true, email: true, fullName: true } } },
  });

  return memberships.map((membership) => ({
    userId: membership.user.id,
    email: membership.user.email,
    fullName: membership.user.fullName,
  }));
}

/** Who hears about a status change: the person who raised the request. */
async function statusRecipients(requestId: string): Promise<Recipient[]> {
  const request = await prisma.serviceRequest.findFirst({
    where: { id: requestId, deletedAt: null },
    include: {
      requester: {
        select: {
          id: true,
          email: true,
          fullName: true,
          status: true,
          deletedAt: true,
        },
      },
    },
  });

  if (!request || request.requester.status !== 'ACTIVE' || request.requester.deletedAt) {
    return [];
  }

  return [
    {
      userId: request.requester.id,
      email: request.requester.email,
      fullName: request.requester.fullName,
    },
  ];
}

/**
 * Who hears about an SLA risk: the person who owns the work, falling back to the
 * lead of the pod that owns it. Nobody is invented — if both are absent the sweep
 * reports the request as skipped rather than mailing an unrelated administrator.
 */
async function slaRecipients(requestId: string): Promise<Recipient[]> {
  const request = await prisma.serviceRequest.findFirst({
    where: { id: requestId, deletedAt: null },
    include: {
      assignee: { select: { id: true, email: true, fullName: true, status: true, deletedAt: true } },
      pod: { include: { lead: { select: { id: true, email: true, fullName: true, status: true, deletedAt: true } } } },
    },
  });

  if (!request) {
    return [];
  }

  const candidate = request.assignee ?? request.pod?.lead ?? null;

  if (!candidate || candidate.status !== 'ACTIVE' || candidate.deletedAt) {
    return [];
  }

  return [{ userId: candidate.id, email: candidate.email, fullName: candidate.fullName }];
}

interface EventSubject {
  readonly organizationName: string;
  readonly requestReference: string;
  readonly requestTitle: string;
  readonly requestUrl: string;
  /** The status as of *now* — what a retry should report, not what it was then. */
  readonly requestStatus: string;
  /** SLA state as of *now*, for risk alerts. */
  readonly slaState: string;
  readonly slaTargetAt: string | null;
  readonly deliverableTitle?: string;
  readonly deliverableVersion?: number;
}

/**
 * Builds the payload for one recipient. Shared by the first dispatch and by the
 * retry sweep — a retry is only safe because this is a pure read of committed
 * state, never a replay of a captured string.
 */
export function buildEventPayload(
  job: EventJob,
  subject: EventSubject,
  recipient: Recipient,
): EventEmailPayload {
  const base = {
    to: recipient.email,
    recipientName: recipient.fullName,
    organizationName: subject.organizationName,
    requestReference: subject.requestReference,
    requestTitle: subject.requestTitle,
    requestUrl: subject.requestUrl,
  };

  if (job.kind === 'deliverable_released') {
    return {
      ...base,
      kind: 'deliverable_released',
      ...(subject.deliverableTitle ? { deliverableTitle: subject.deliverableTitle } : {}),
      ...(subject.deliverableVersion !== undefined
        ? { deliverableVersion: subject.deliverableVersion }
        : {}),
    };
  }

  if (job.kind === 'sla_risk') {
    // The state is read from the live row, not from the job: a retry hours later
    // should say what is true now, which may already be BREACHED.
    return {
      ...base,
      kind: 'sla_risk',
      slaState: subject.slaState,
      ...(subject.slaTargetAt ? { slaTargetAt: subject.slaTargetAt } : {}),
    };
  }

  return {
    ...base,
    kind: 'request_status_updated',
    fromStatus: job.fromStatus,
    toStatus: job.toStatus,
  };
}

/** Reads the committed state an event email is built from. */
export async function loadEventSubject(job: EventJob): Promise<EventSubject | null> {
  const request = await prisma.serviceRequest.findFirst({
    where: { id: job.requestId, organizationId: job.organizationId, deletedAt: null },
    include: { organization: { select: { name: true } } },
  });

  if (!request) {
    return null;
  }

  const subject: EventSubject = {
    organizationName: request.organization.name,
    requestReference: request.reference,
    requestTitle: request.title,
    requestUrl: `${env.WEB_APP_URL}/requests/${request.id}`,
    requestStatus: request.status,
    slaState: computeSlaState(
      {
        status: request.status as ServiceRequestStatus,
        targetAt: request.slaTargetAt,
        closedAt: request.closedAt,
        startAt: request.createdAt,
      },
      new Date(),
    ),
    slaTargetAt: request.slaTargetAt ? request.slaTargetAt.toISOString() : null,
  };

  if (job.kind === 'deliverable_released') {
    const deliverable = await prisma.deliverable.findFirst({
      where: { id: job.deliverableId, organizationId: job.organizationId, deletedAt: null },
      select: { title: true, version: true },
    });

    if (!deliverable) {
      return null;
    }

    return {
      ...subject,
      deliverableTitle: deliverable.title,
      deliverableVersion: deliverable.version,
    };
  }

  return subject;
}

async function processJob(job: EventJob): Promise<void> {
  const subject = await loadEventSubject(job);

  if (!subject) {
    // The request or deliverable vanished (hard delete / tenant mismatch).
    return;
  }

  const recipients =
    job.kind === 'deliverable_released'
      ? await releaseRecipients(job.organizationId)
      : job.kind === 'sla_risk'
        ? await slaRecipients(job.requestId)
        : await statusRecipients(job.requestId);

  for (const recipient of recipients) {
    const payload = buildEventPayload(job, subject, recipient);
    let receipt;

    try {
      receipt = await notifications.current.sendEvent(payload);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      receipt = { status: 'failed' as const, driver: notifications.current.driver, error: message };
    }

    await notificationRepository.record({
      organizationId: job.organizationId,
      userId: recipient.userId,
      kind: job.kind,
      driver: receipt.driver,
      status: receipt.status,
      recipient: recipient.email,
      ...(receipt.messageId ? { messageId: receipt.messageId } : {}),
      ...(receipt.error ? { error: receipt.error } : {}),
      attempt: 1,
      lastAttemptAt: new Date(),
      // A failed event email joins the same retry queue as an invitation.
      nextAttemptAt: receipt.status === 'failed' ? nextAttemptAfter(1) : null,
      subjectRequestId: job.requestId,
      subjectDeliverableId: job.kind === 'deliverable_released' ? job.deliverableId : null,
    });
  }
}
