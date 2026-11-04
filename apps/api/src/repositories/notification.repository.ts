import { prisma } from '../db/client';

export interface RecordDeliveryInput {
  readonly organizationId: string;
  readonly membershipId: string;
  readonly userId: string;
  readonly kind: 'invitation' | 'resent';
  readonly driver: string;
  readonly status: 'sent' | 'failed' | 'skipped';
  readonly recipient: string;
  readonly messageId?: string;
  readonly error?: string;
}

const ERROR_MAX = 500;

const KIND_MAP = { invitation: 'INVITATION', resent: 'RESENT' } as const;
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
        membershipId: input.membershipId,
        userId: input.userId,
        kind: KIND_MAP[input.kind],
        driver: input.driver,
        status: STATUS_MAP[input.status],
        recipient: input.recipient,
        messageId: input.messageId ?? null,
        error: input.error ? input.error.slice(0, ERROR_MAX) : null,
      },
      select: { id: true },
    });

    return row.id;
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
