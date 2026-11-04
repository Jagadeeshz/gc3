import type { ClientRole } from '@gc3/types';

/**
 * Notification boundary.
 *
 * The API never touches an email provider directly: it hands a typed payload to a
 * NotificationService implementation. That keeps provider choice (SMTP, SES,
 * Postmark, n8n…) an infrastructure decision and keeps the plaintext invite token
 * inside a single seam instead of scattered through route handlers.
 */
export interface InviteEmailPayload {
  readonly to: string;
  readonly fullName: string;
  readonly organizationName: string;
  readonly roles: readonly ClientRole[];
  /** Accept link containing the one-time token. Never persisted by the API. */
  readonly inviteUrl: string;
  readonly expiresAt: Date;
  /** `invitation` for a first invite, `resent` when a token was rotated. */
  readonly kind: 'invitation' | 'resent';
}

/**
 * `skipped` is deliberate: a noop driver has not sent anything, and reporting
 * `sent` would be a lie in the audit trail.
 */
export type DeliveryStatus = 'sent' | 'failed' | 'skipped';

export interface DeliveryReceipt {
  readonly status: DeliveryStatus;
  readonly driver: string;
  readonly messageId?: string;
  readonly error?: string;
}

export interface NotificationService {
  readonly driver: string;
  sendInvite(payload: InviteEmailPayload): Promise<DeliveryReceipt>;
}
