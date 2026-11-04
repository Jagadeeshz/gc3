import type { ClientRole } from '@gc3/types';
import { buildInviteUrl, notifications } from './index';
import { nextAttemptAfter } from './retry';
import type { DeliveryReceipt } from './types';
import { notificationRepository } from '../repositories/notification.repository';

export interface DeliverInviteInput {
  /** Tenant context, required to attribute the delivery audit row. */
  readonly organizationId: string;
  readonly membershipId: string;
  readonly userId: string;

  readonly to: string;
  readonly fullName: string;
  readonly organizationName: string;
  readonly roles: readonly ClientRole[];
  readonly token: string;
  readonly expiresAt: Date | string;
  readonly kind: 'invitation' | 'resent';
}

/** Receipt plus the audit row that recorded it. */
export type DeliveryOutcome = DeliveryReceipt & { readonly auditId: string | null };

/**
 * Hands an invitation to the configured notification service and records the
 * attempt in `notification_deliveries`.
 *
 * Two independent failure domains, handled differently on purpose:
 *
 *  - **Delivery** is outside any transaction. The membership is already
 *    committed; a provider outage must not roll an invitation back. A failure is
 *    returned as `status: "failed"` so the caller can resend.
 *  - **Audit** must never break the request either. If the audit insert fails we
 *    log loudly and return `auditId: null` — losing the audit row is bad, but
 *    failing a committed invite because of it is worse.
 */
export async function deliverInvite(input: DeliverInviteInput): Promise<DeliveryOutcome> {
  const service = notifications.current;
  let receipt: DeliveryReceipt;

  try {
    receipt = await service.sendInvite({
      to: input.to,
      fullName: input.fullName,
      organizationName: input.organizationName,
      roles: input.roles,
      inviteUrl: buildInviteUrl(input.token),
      expiresAt: new Date(input.expiresAt),
      kind: input.kind,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[gc3-api][notifications] delivery failed via ${service.driver}: ${message}`);
    receipt = { status: 'failed', driver: service.driver, error: message };
  }

  let auditId: string | null = null;

  try {
    auditId = await notificationRepository.record({
      organizationId: input.organizationId,
      membershipId: input.membershipId,
      userId: input.userId,
      kind: input.kind,
      driver: receipt.driver,
      status: receipt.status,
      recipient: input.to,
      ...(receipt.messageId ? { messageId: receipt.messageId } : {}),
      ...(receipt.error ? { error: receipt.error } : {}),
      attempt: 1,
      lastAttemptAt: new Date(),
      // A failed first attempt enters the retry queue instead of dead-ending.
      nextAttemptAt: receipt.status === 'failed' ? nextAttemptAfter(1) : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[gc3-api][delivery-audit] could not record delivery: ${message}`);
  }

  return { ...receipt, auditId };
}
