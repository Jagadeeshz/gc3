import nodemailer, { type Transporter } from 'nodemailer';
import { renderEvent, renderInvite } from './templates';
import type {
  DeliveryReceipt,
  EventEmailPayload,
  InviteEmailPayload,
  NotificationService,
} from './types';

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
    const rendered = renderInvite(payload);

    try {
      const info = await this.transporter.sendMail({
        from: this.config.from,
        to: payload.to,
        subject: rendered.subject,
        text: rendered.text,
        html: rendered.html,
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

  async sendEvent(payload: EventEmailPayload): Promise<DeliveryReceipt> {
    const rendered = renderEvent(payload);

    try {
      const info = await this.transporter.sendMail({
        from: this.config.from,
        to: payload.to,
        subject: rendered.subject,
        text: rendered.text,
        html: rendered.html,
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
