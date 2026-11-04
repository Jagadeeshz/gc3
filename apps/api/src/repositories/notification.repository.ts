import { prisma } from '../db/client';

export interface RecordDeliveryInput {
  readonly organizationId: string;
  /** Absent for event notifications, which target a user rather than a membership. */
  readonly membershipId?: string | null;
  readonly userId: string;
  readonly kind: 'invitation' | 'resent' | 'deliverable_released' | 'request_status_updated' | 'sla_risk';
  readonly driver: string;
  readonly status: 'sent' | 'failed' | 'skipped';
  readonly recipient: string;
  readonly messageId?: string;
  readonly error?: string;
  /** 1 for the first send; the retry sweep increments it. */
  readonly attempt?: number;
  /** When this attempt ran. Defaults to now. */
  readonly lastAttemptAt?: Date;
  /** When the next retry is due, when this attempt failed and retries remain. */
  readonly nextAttemptAt?: Date | null;
  /** Event subjects, so a retry can rebuild the message from the database. */
  readonly subjectRequestId?: string | null;
  readonly subjectDeliverableId?: string | null;
}

const ERROR_MAX = 500;

const KIND_MAP = {
  invitation: 'INVITATION',
  resent: 'RESENT',
  deliverable_released: 'DELIVERABLE_RELEASED',
  request_status_updated: 'REQUEST_STATUS_UPDATED',
  sla_risk: 'SLA_RISK',
} as const;

const STATUS_MAP = { sent: 'SENT', failed: 'FAILED', skipped: 'SKIPPED' } as const;

/**
 * Delivery audit. One row per attempt, including failures and skips, so
 * "the client never got the email" is answerable from the database instead of
 * from container logs that have already rotated away.
 */
export const notificationRepository = {
  async record(input: RecordDeliveryInput): Promise<string | null> {
    const row = await prisma.notificationDelivery.create({
      data: {
        organizationId: input.organizationId,
        membershipId: input.membershipId ?? null,
        userId: input.userId,
        kind: KIND_MAP[input.kind],
        subjectRequestId: input.subjectRequestId ?? null,
        subjectDeliverableId: input.subjectDeliverableId ?? null,
        driver: input.driver,
        status: STATUS_MAP[input.status],
        recipient: input.recipient,
        messageId: input.messageId ?? null,
        error: input.error ? input.error.slice(0, ERROR_MAX) : null,
        attempt: input.attempt ?? 1,
        lastAttemptAt: input.lastAttemptAt ?? new Date(),
        nextAttemptAt: input.nextAttemptAt ?? null,
      },
      select: { id: true },
    });

    return row.id;
  },

  /**
   * Failed rows whose retry is due. Ordered oldest-due first so a backlog drains
   * in the order it was created. Passing `organizationId` limits the sweep to one
   * tenant, which is what the manual endpoint does.
   */
  async findDueRetries(now: Date, limit: number, organizationId?: string) {
    return prisma.notificationDelivery.findMany({
      where: {
        status: 'FAILED',
        nextAttemptAt: { not: null, lte: now },
        ...(organizationId ? { organizationId } : {}),
      },
      orderBy: { nextAttemptAt: 'asc' },
      take: limit,
    });
  },

  /**
   * Takes ownership of one due row by clearing its schedule. Returns false when
   * another worker (or an overlapping sweep) already claimed it, which is what
   * stops a double send.
   */
  async claimRetry(id: string, now: Date): Promise<boolean> {
    const result = await prisma.notificationDelivery.updateMany({
      where: { id, status: 'FAILED', nextAttemptAt: { not: null, lte: now } },
      data: { nextAttemptAt: null },
    });

    return result.count === 1;
  },

  /** Ends a retry chain without sending again (nothing left to deliver to). */
  async abandonRetry(id: string, reason: string): Promise<void> {
    await prisma.notificationDelivery.updateMany({
      where: { id },
      data: {
        nextAttemptAt: null,
        error: reason.slice(0, ERROR_MAX),
      },
    });
  },

  /**
   * The administrative read: filterable, paginated, plus a status summary so an
   * operator sees the shape of the queue without paging through it.
   */
  async queryScoped(
    organizationId: string,
    filters: {
      status?: 'SENT' | 'FAILED' | 'SKIPPED';
      kind?: 'INVITATION' | 'RESENT' | 'DELIVERABLE_RELEASED' | 'REQUEST_STATUS_UPDATED' | 'SLA_RISK';
      recipient?: string;
      page: number;
      pageSize: number;
    },
  ) {
    const where = {
      organizationId,
      ...(filters.status ? { status: filters.status } : {}),
      ...(filters.kind ? { kind: filters.kind } : {}),
      ...(filters.recipient ? { recipient: { contains: filters.recipient, mode: 'insensitive' as const } } : {}),
    };

    const [rows, total, byStatus, pendingRetry] = await Promise.all([
      prisma.notificationDelivery.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (filters.page - 1) * filters.pageSize,
        take: filters.pageSize,
      }),
      prisma.notificationDelivery.count({ where }),
      prisma.notificationDelivery.groupBy({
        by: ['status'],
        where: { organizationId },
        _count: { _all: true },
      }),
      prisma.notificationDelivery.count({
        where: { organizationId, status: 'FAILED', nextAttemptAt: { not: null } },
      }),
    ]);

    const counts = { SENT: 0, FAILED: 0, SKIPPED: 0 };
    for (const group of byStatus) {
      counts[group.status] = group._count._all;
    }

    return {
      rows,
      total,
      summary: {
        sent: counts.SENT,
        failed: counts.FAILED,
        skipped: counts.SKIPPED,
        pendingRetry,
      },
    };
  },

  /** Tenant-scoped read used by tests and support tooling. */
  async listScoped(organizationId: string, limit = 50) {
    return prisma.notificationDelivery.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  },
};
