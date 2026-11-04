import { env } from '../config/env';
import {
  ConsoleNotificationService,
  FailingNotificationService,
  MemoryNotificationService,
  NoopNotificationService,
} from './drivers';
import { SmtpNotificationService } from './smtp.driver';
import type { InviteEmailPayload, NotificationService } from './types';

export type { InviteEmailPayload, DeliveryReceipt, NotificationService } from './types';
export {
  getOutbox,
  getEventOutbox,
  resetOutbox,
  type CapturedMessage,
  type CapturedEventMessage,
} from './drivers';

/**
 * Builds the driver named by `NOTIFICATION_DRIVER`.
 *
 * Security boundary: `console` (prints the token to stdout) and `failing` (a
 * deliberate error injector) must never be selectable in production. Rather than
 * trusting configuration, the factory refuses to start — a deployment that cannot
 * deliver email should fail loudly at boot, not silently accept invites nobody
 * receives, and never with a token printed into container logs.
 */
export function createNotificationService(): NotificationService {
  const configured = env.NOTIFICATION_DRIVER;
  const driver = configured ?? (env.NODE_ENV === 'production' ? 'noop' : 'console');

  if (env.NODE_ENV === 'production' && (driver === 'console' || driver === 'failing')) {
    throw new Error(
      `NOTIFICATION_DRIVER="${driver}" is not permitted in production: it exposes invite tokens or drops deliveries. ` +
        'Configure a real provider (or "noop" explicitly).',
    );
  }

  switch (driver) {
    case 'console':
      return new ConsoleNotificationService();
    case 'memory':
      return new MemoryNotificationService();
    case 'noop':
      return new NoopNotificationService();
    case 'failing':
      return new FailingNotificationService();
    case 'smtp': {
      // Fail at boot, not on the first invitation: a half-configured relay is a
      // silent outage otherwise.
      if (!env.SMTP_HOST) {
        throw new Error('NOTIFICATION_DRIVER="smtp" requires SMTP_HOST to be set');
      }

      return new SmtpNotificationService({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_SECURE,
        from: env.MAIL_FROM,
        ...(env.SMTP_USER && env.SMTP_PASS
          ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
          : {}),
      });
    }
    default: {
      // Exhaustiveness guard: a new env value without a driver must not fall through.
      const unreachable: never = driver;
      throw new Error(`Unsupported NOTIFICATION_DRIVER: ${String(unreachable)}`);
    }
  }
}

/**
 * Mutable container so the service can be swapped in tests (dependency injection
 * without a framework). Production code reads `notifications.current` only.
 */
export const notifications: { current: NotificationService } = {
  current: createNotificationService(),
};

export function setNotificationService(service: NotificationService): void {
  notifications.current = service;
}

export function resetNotificationService(): void {
  notifications.current = createNotificationService();
}

/** The accept link handed to the invitee. */
export function buildInviteUrl(token: string): string {
  return `${env.WEB_APP_URL.replace(/\/+$/, '')}/invite/${token}`;
}
