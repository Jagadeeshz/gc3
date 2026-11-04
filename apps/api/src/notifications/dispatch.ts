import type { ClientRole } from '@gc3/types';
import { buildInviteUrl, notifications } from './index';
import type { DeliveryReceipt } from './types';

export interface DeliverInviteInput {
  readonly to: string;
  readonly fullName: string;
  readonly organizationName: string;
  readonly roles: readonly ClientRole[];
  readonly token: string;
  readonly expiresAt: Date | string;
  readonly kind: 'invitation' | 'resent';
}

/**
 * Hands an invitation to the configured notification service.
 *
 * Delivery is deliberately *not* part of the database transaction: an invite is
 * a real record the moment the membership commits, and a provider outage must
 * not roll it back. A failure is reported in the response as
 * `delivery.status = "failed"` (plus a server log) so the caller can resend,
 * rather than being silently swallowed.
 */
export async function deliverInvite(input: DeliverInviteInput): Promise<DeliveryReceipt> {
  const service = notifications.current;

  try {
    return await service.sendInvite({
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

    return { status: 'failed', driver: service.driver, error: message };
  }
}
