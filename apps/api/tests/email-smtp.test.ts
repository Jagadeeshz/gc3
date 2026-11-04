import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import {
  API,
  app,
  authPost,
  createOrganization,
  createStaff,
  inviteMember,
} from './helpers/api';
import { notificationRepository } from '../src/repositories/notification.repository';
import { resetNotificationService, setNotificationService } from '../src/notifications';
import { SmtpNotificationService } from '../src/notifications/smtp.driver';

/**
 * Real SMTP integration against a Mailpit relay (Podman).
 *
 *   podman run -d --name gc3-mailpit -p 1025:1025 -p 8025:8025 axllent/mailpit
 *
 * The relay is queried over its HTTP API, so these assertions check what a mail
 * server actually accepted — not what our own code claims it sent. If the relay
 * is not running the block skips with a reason instead of failing the suite.
 */
const MAILPIT_URL = process.env.MAILPIT_URL ?? 'http://localhost:8025';
const SMTP_HOST = process.env.SMTP_HOST ?? '127.0.0.1';
const SMTP_PORT = Number(process.env.SMTP_PORT ?? 1025);
const FROM = 'GC3 Portal <no-reply@gc3.test>';

async function mailpitReachable(): Promise<boolean> {
  try {
    const response = await fetch(`${MAILPIT_URL}/api/v1/messages`, {
      signal: AbortSignal.timeout(1_500),
    });
    return response.ok;
  } catch {
    return false;
  }
}

interface MailpitAddress {
  Address?: string;
}

interface MailpitSummary {
  ID: string;
  Subject?: string;
  To?: MailpitAddress[];
}

interface MailpitDetail {
  Text?: string;
  HTML?: string;
  Subject?: string;
}

async function clearMailpit(): Promise<void> {
  await fetch(`${MAILPIT_URL}/api/v1/messages`, { method: 'DELETE' });
}

async function listMessages(): Promise<MailpitSummary[]> {
  const response = await fetch(`${MAILPIT_URL}/api/v1/messages`);
  const payload = (await response.json()) as { messages?: MailpitSummary[] };
  return payload.messages ?? [];
}

async function getMessage(id: string): Promise<MailpitDetail> {
  const response = await fetch(`${MAILPIT_URL}/api/v1/message/${id}`);
  return (await response.json()) as MailpitDetail;
}

const mailpitUp = await mailpitReachable();

describe.skipIf(!mailpitUp)('SMTP driver against a real relay', () => {
  let service: SmtpNotificationService;

  beforeAll(() => {
    service = new SmtpNotificationService({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: false,
      from: FROM,
      connectionTimeoutMs: 3_000,
    });
  });

  afterAll(() => {
    service.close();
    resetNotificationService();
  });

  beforeEach(async () => {
    await clearMailpit();
  });

  it('hands a message to the relay and the relay keeps it', async () => {
    const receipt = await service.sendInvite({
      to: 'direct@relay.test',
      fullName: 'Direct Person',
      organizationName: 'Relay Co',
      roles: ['CLIENT_OWNER'],
      inviteUrl: 'http://localhost:3000/invite/direct-token-abc',
      expiresAt: new Date(Date.now() + 3_600_000),
      kind: 'invitation',
    });

    expect(receipt.status).toBe('sent');
    expect(receipt.messageId).toBeTruthy();

    const messages = await listMessages();
    expect(messages).toHaveLength(1);
    expect(messages[0]?.To?.[0]?.Address).toBe('direct@relay.test');
    expect(messages[0]?.Subject).toContain('Relay Co');

    const detail = await getMessage(messages[0]!.ID);
    expect(detail.Text ?? '').toContain('http://localhost:3000/invite/direct-token-abc');
    expect(detail.HTML ?? '').toContain('Set your password');
  });

  it('sends a real invitation through the API and records SENT', async () => {
    const organization = await createOrganization({ name: 'Relay Co API' });
    const admin = await createStaff('PLATFORM_ADMIN');
    setNotificationService(service);

    const invite = await inviteMember({
      organizationId: organization.id,
      adminToken: admin.token,
      email: 'api@relay.test',
    });

    // 1. The database says the dispatch succeeded, with the provider message id.
    const rows = await notificationRepository.listScoped(organization.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      status: 'SENT',
      driver: 'smtp',
      recipient: 'api@relay.test',
      kind: 'INVITATION',
    });
    expect(rows[0]?.messageId).toBeTruthy();

    // 2. The relay independently confirms it received the mail.
    const messages = await listMessages();
    expect(messages).toHaveLength(1);
    const detail = await getMessage(messages[0]!.ID);
    expect(detail.Text ?? '').toContain(invite.inviteToken);

    // 3. The link in that email actually activates the account.
    await request(app)
      .post(`${API}/auth/accept-invite`)
      .send({ token: invite.inviteToken, password: 'Emailed-Link-77' })
      .expect(200);
  });

  it('escapes tenant-supplied markup in the HTML body', async () => {
    const organization = await createOrganization({ name: '<script>alert(1)</script>' });
    const admin = await createStaff('PLATFORM_ADMIN');
    setNotificationService(service);

    await inviteMember({
      organizationId: organization.id,
      adminToken: admin.token,
      email: 'xss@relay.test',
    });

    const messages = await listMessages();
    const detail = await getMessage(messages[0]!.ID);
    const html = detail.HTML ?? '';

    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;');
  });
});

describe('SMTP failure handling', () => {
  it('reports and records a failure when the relay is unreachable', async () => {
    const organization = await createOrganization();
    const admin = await createStaff('PLATFORM_ADMIN');

    const deadRelay = new SmtpNotificationService({
      host: '127.0.0.1',
      port: 65_000,
      secure: false,
      from: FROM,
      connectionTimeoutMs: 1_500,
    });
    setNotificationService(deadRelay);

    try {
      const response = await authPost(
        `${API}/organizations/${organization.id}/memberships`,
        admin.token,
        { email: 'dead@relay.test', fullName: 'Dead Relay', roles: ['CLIENT_TEAM_MEMBER'] },
        organization.id,
      ).expect(201);

      expect(response.body.data.delivery).toMatchObject({ status: 'failed', driver: 'smtp' });

      const rows = await notificationRepository.listScoped(organization.id);
      expect(rows[0]).toMatchObject({ status: 'FAILED', driver: 'smtp' });
      expect(rows[0]?.error).toBeTruthy();

      // The invitation is still usable despite the outage.
      const token = response.body.data.inviteToken as string;
      await request(app)
        .post(`${API}/auth/accept-invite`)
        .send({ token, password: 'Outage-Survives-3' })
        .expect(200);
    } finally {
      deadRelay.close();
      resetNotificationService();
    }
  });
});
