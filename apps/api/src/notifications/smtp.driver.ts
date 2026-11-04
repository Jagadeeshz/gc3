import nodemailer, { type Transporter } from 'nodemailer';
import type { DeliveryReceipt, InviteEmailPayload, NotificationService } from './types';

export interface SmtpConfig {
  readonly host: string;
  readonly port: number;
  readonly secure: boolean;
  readonly user?: string;
  readonly pass?: string;
  readonly from: string;
  /** Fail fast instead of hanging a request when the relay is unreachable. */
  readonly connectionTimeoutMs?: number;
}

/**
 * Production email driver (SMTP via nodemailer).
 *
 * Deliberately dumb: it renders the invitation, hands it to the transport, and
 * reports exactly what the transport said. It never swallows an error — the
 * caller records the failure in the delivery audit table.
 *
 * Timeouts are explicit because nodemailer waits indefinitely by default, and a
 * hung SMTP server would otherwise hold an HTTP request open with it.
 */
export class SmtpNotificationService implements NotificationService {
  readonly driver = 'smtp';
  private readonly transporter: Transporter;

  constructor(private readonly config: SmtpConfig) {
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      ...(config.user && config.pass
        ? { auth: { user: config.user, pass: config.pass } }
        : {}),
      connectionTimeout: config.connectionTimeoutMs ?? 5_000,
      greetingTimeout: 5_000,
      socketTimeout: 10_000,
    });
  }

  async sendInvite(payload: InviteEmailPayload): Promise<DeliveryReceipt> {
    try {
      const info = await this.transporter.sendMail({
        from: this.config.from,
        to: payload.to,
        subject: buildSubject(payload),
        text: buildText(payload),
        html: buildHtml(payload),
      });

      return { status: 'sent', driver: this.driver, messageId: info.messageId };
    } catch (error) {
      return {
        status: 'failed',
        driver: this.driver,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /** Releases pooled sockets; used by tests and graceful shutdown. */
  close(): void {
    this.transporter.close();
  }
}

function buildSubject(payload: InviteEmailPayload): string {
  return payload.kind === 'resent'
    ? `Reminder: your invitation to ${payload.organizationName} on GC³ Portal`
    : `You have been invited to ${payload.organizationName} on GC³ Portal`;
}

function buildText(payload: InviteEmailPayload): string {
  return [
    `Hello ${payload.fullName},`,
    '',
    `${payload.organizationName} has invited you to the GC³ Portal as ${payload.roles.join(', ')}.`,
    '',
    'Set your password and activate your account:',
    payload.inviteUrl,
    '',
    `This link expires on ${payload.expiresAt.toISOString()} and can only be used once.`,
    '',
    "If you weren't expecting this invitation you can ignore this email.",
    '',
    '— GC³ Portal',
  ].join('\n');
}

function buildHtml(payload: InviteEmailPayload): string {
  const roles = payload.roles.join(', ');
  return `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#07080b;color:#f4f0e8;font-family:system-ui,sans-serif">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      <tr><td align="center" style="padding:32px 16px">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0"
               style="background:#11141a;border:1px solid rgba(244,240,232,0.12);border-radius:14px">
          <tr><td style="padding:28px 28px 0">
            <p style="margin:0;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;color:#a7a9b0">GC³ Portal</p>
            <h1 style="margin:10px 0 0;font-size:22px;line-height:1.25;color:#f4f0e8">You have been invited to ${escapeHtml(payload.organizationName)}</h1>
          </td></tr>
          <tr><td style="padding:16px 28px 0;font-size:14px;line-height:1.6;color:#a7a9b0">
            Hello ${escapeHtml(payload.fullName)}, you have been added as <strong style="color:#f4f0e8">${escapeHtml(roles)}</strong>.
            Set a password to activate your account.
          </td></tr>
          <tr><td style="padding:24px 28px 0">
            <a href="${escapeHtml(payload.inviteUrl)}"
               style="display:inline-block;padding:12px 18px;border-radius:10px;background:#d9b65d;color:#111318;font-weight:600;text-decoration:none">
              Set your password
            </a>
          </td></tr>
          <tr><td style="padding:16px 28px 0;font-size:12px;line-height:1.6;color:#a7a9b0">
            Or paste this link into your browser:<br>
            <span style="color:#e2c777;word-break:break-all">${escapeHtml(payload.inviteUrl)}</span>
          </td></tr>
          <tr><td style="padding:16px 28px 28px;font-size:12px;line-height:1.6;color:#a7a9b0">
            This link expires on ${escapeHtml(payload.expiresAt.toISOString())} and can only be used once.
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

/** The org name and invitee name are tenant-supplied strings — never trusted as markup. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
