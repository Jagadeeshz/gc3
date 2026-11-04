import { randomUUID } from 'node:crypto';
import type {
  DeliveryReceipt,
  EventEmailPayload,
  InviteEmailPayload,
  NotificationService,
} from './types';

/**
 * Drivers. Only `memory` and `noop` are safe regardless of environment;
 * `console` prints the accept URL (and therefore the token) to stdout and is
 * refused in production by the factory in ./index.ts.
 */

/** Writes the message to stdout. Development convenience only. */
export class ConsoleNotificationService implements NotificationService {
  readonly driver = 'console';

  async sendInvite(payload: InviteEmailPayload): Promise<DeliveryReceipt> {
    console.log(
      [
        '[gc3-api][email:console]',
        `to=${payload.to}`,
        `kind=${payload.kind}`,
        `org=${payload.organizationName}`,
        `roles=${payload.roles.join(',')}`,
        `expires=${payload.expiresAt.toISOString()}`,
        `url=${payload.inviteUrl}`,
      ].join(' '),
    );

    return { status: 'sent', driver: this.driver, messageId: randomUUID() };
  }

  async sendEvent(payload: EventEmailPayload): Promise<DeliveryReceipt> {
    // Event bodies carry no secret, so printing them in development is harmless.
    console.log(
      [
        '[gc3-api][email:console]',
        `to=${payload.to}`,
        `kind=${payload.kind}`,
        `request=${payload.requestReference}`,
        `url=${payload.requestUrl}`,
      ].join(' '),
    );

    return { status: 'sent', driver: this.driver, messageId: randomUUID() };
  }
}

/** Captures messages in memory. Used by the test suite to assert dispatch. */
export interface CapturedMessage extends InviteEmailPayload {
  readonly messageId: string;
  readonly sentAt: Date;
}

/** Event messages are captured separately so invite assertions stay unchanged. */
export interface CapturedEventMessage extends EventEmailPayload {
  readonly messageId: string;
  readonly sentAt: Date;
}

const outbox: CapturedMessage[] = [];
const eventOutbox: CapturedEventMessage[] = [];

export function getOutbox(): readonly CapturedMessage[] {
  return outbox;
}

export function getEventOutbox(): readonly CapturedEventMessage[] {
  return eventOutbox;
}

export function resetOutbox(): void {
  outbox.length = 0;
  eventOutbox.length = 0;
}

export class MemoryNotificationService implements NotificationService {
  readonly driver = 'memory';

  async sendInvite(payload: InviteEmailPayload): Promise<DeliveryReceipt> {
    const messageId = randomUUID();
    outbox.push({ ...payload, messageId, sentAt: new Date() });
    return { status: 'sent', driver: this.driver, messageId };
  }

  async sendEvent(payload: EventEmailPayload): Promise<DeliveryReceipt> {
    const messageId = randomUUID();
    eventOutbox.push({ ...payload, messageId, sentAt: new Date() });
    return { status: 'sent', driver: this.driver, messageId };
  }
}

/**
 * Sends nothing. The production fallback when no provider is configured: the
 * invite still exists in the database, and the receipt says `skipped` so nobody
 * believes an email went out.
 */
export class NoopNotificationService implements NotificationService {
  readonly driver = 'noop';

  async sendInvite(_payload: InviteEmailPayload): Promise<DeliveryReceipt> {
    return { status: 'skipped', driver: this.driver };
  }

  async sendEvent(_payload: EventEmailPayload): Promise<DeliveryReceipt> {
    return { status: 'skipped', driver: this.driver };
  }
}

/** Always fails. Test-only: proves a delivery failure cannot roll back an invite. */
export class FailingNotificationService implements NotificationService {
  readonly driver = 'failing';

  async sendInvite(_payload: InviteEmailPayload): Promise<DeliveryReceipt> {
    return { status: 'failed', driver: this.driver, error: 'simulated provider failure' };
  }

  async sendEvent(_payload: EventEmailPayload): Promise<DeliveryReceipt> {
    return { status: 'failed', driver: this.driver, error: 'simulated provider failure' };
  }
}
