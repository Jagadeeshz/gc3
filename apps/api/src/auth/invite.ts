import { createHash, randomBytes } from 'node:crypto';
import { env } from '../config/env';

/**
 * Invite tokens.
 *
 * A token is 32 random bytes (256 bits) rendered base64url — unguessable, so a
 * fast hash is the right storage choice: unlike a password there is no low
 * entropy to defend against. Only SHA-256(token) is persisted, which means a
 * database leak does not hand out working invitation links.
 */
const TOKEN_BYTES = 32;

export interface GeneratedInvite {
  /** Returned to the inviter once (dev) / emailed by the notification service (prod). */
  readonly token: string;
  readonly tokenHash: string;
  readonly expiresAt: Date;
}

export function generateInviteToken(ttlHours: number = env.INVITE_TTL_HOURS): GeneratedInvite {
  const token = randomBytes(TOKEN_BYTES).toString('base64url');

  return {
    token,
    tokenHash: hashInviteToken(token),
    expiresAt: new Date(Date.now() + ttlHours * 60 * 60 * 1000),
  };
}

export function hashInviteToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/** Masks an email for the pre-authentication preview: `p•••@acme.example`. */
export function maskEmail(email: string): string {
  const [local = '', domain = ''] = email.split('@');
  const head = local.slice(0, 1);
  return `${head}${'•'.repeat(Math.max(3, local.length - 1))}@${domain}`;
}
