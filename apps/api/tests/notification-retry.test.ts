import { describe, expect, it } from 'vitest';
import request from 'supertest';
import {
  API,
  app,
  authGet,
  authPost,
  createMember,
  createOrganization,
  createStaff,
  inviteMember,
} from './helpers/api';
import { prisma } from '../src/db/client';
import { env } from '../src/config/env';
import {
  getOutbox,
  resetNotificationService,
  setNotificationService,
} from '../src/notifications';
import {
  FailingNotificationService,
  MemoryNotificationService,
} from '../src/notifications/drivers';

/**
 * Every test starts by producing a genuine failure with the failing driver, then
 * rewinds the schedule instead of waiting a minute for the first backoff.
 */
async function seedFailedInvite(organizationId: string, adminToken: string) {
  setNotificationService(new FailingNotificationService());

  const invitation = await inviteMember({
    organizationId,
    adminToken,
    roles: ['CLIENT_TEAM_MEMBER'],
  });

  resetNotificationService();
  return invitation;
}

async function makeDue(): Promise<void> {
  await prisma.notificationDelivery.updateMany({
    data: { nextAttemptAt: new Date(Date.now() - 60_000) },
  });
}

async function deliveries() {
  return prisma.notificationDelivery.findMany({ orderBy: { createdAt: 'asc' } });
}

describe('notification retry queue', () => {
  it('puts a failed delivery into the queue with the first backoff', async () => {
    const organization = await createOrganization();
    const admin = await createStaff('OPERATIONS_MANAGER');

    await seedFailedInvite(organization.id, admin.token);

    const rows = await deliveries();

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ status: 'FAILED', attempt: 1 });
    expect(rows[0]?.lastAttemptAt).toBeInstanceOf(Date);

    const secondsOut = (rows[0]!.nextAttemptAt!.getTime() - Date.now()) / 1_000;
    expect(secondsOut).toBeGreaterThan(50);
    expect(secondsOut).toBeLessThanOrEqual(61);
  });

  it('does nothing when nothing is due', async () => {
    const organization = await createOrganization();
    const admin = await createStaff('PLATFORM_ADMIN');
    await seedFailedInvite(organization.id, admin.token);

    // Still inside its first backoff window.
    const sweep = await authPost(`${API}/notifications/retry`, admin.token, {}, organization.id)
      .expect(200);

    expect(sweep.body.data).toMatchObject({ processed: 0, sent: 0 });
  });

  it('retries a due failure, delivers, and rotates the invite token', async () => {
    const organization = await createOrganization();
    const admin = await createStaff('PLATFORM_ADMIN');
    const invitation = await seedFailedInvite(organization.id, admin.token);

    await makeDue();

    const sweep = await authPost(`${API}/notifications/retry`, admin.token, {}, organization.id)
      .expect(200);

    expect(sweep.body.data).toMatchObject({ processed: 1, sent: 1, failed: 0 });

    const rows = await deliveries();
    expect(rows).toHaveLength(2);
    expect(rows[1]).toMatchObject({ status: 'SENT', attempt: 2, nextAttemptAt: null });

    // The retried email carries a fresh token, so the original one is dead.
    const messages = getOutbox();
    expect(messages).toHaveLength(1);
    const retriedUrl = messages[0]!.inviteUrl;
    const retriedToken = retriedUrl.split('/invite/')[1]!;
    expect(retriedToken).not.toBe(invitation.inviteToken);

    await request(app)
      .post(`${API}/auth/accept-invite`)
      .send({ token: invitation.inviteToken, password: 'Retried-Password-9' })
      .expect(400);

    await request(app)
      .post(`${API}/auth/accept-invite`)
      .send({ token: retriedToken, password: 'Retried-Password-9' })
      .expect(200);
  });

  it('keeps failing and grows the backoff instead of hammering', async () => {
    const organization = await createOrganization();
    const admin = await createStaff('PLATFORM_ADMIN');
    await seedFailedInvite(organization.id, admin.token);

    await makeDue();
    setNotificationService(new FailingNotificationService());

    const first = await authPost(`${API}/notifications/retry`, admin.token, {}, organization.id)
      .expect(200);

    expect(first.body.data).toMatchObject({ processed: 1, sent: 0, failed: 1, exhausted: 0 });

    const afterFirst = await deliveries();
    expect(afterFirst).toHaveLength(2);
    expect(afterFirst[1]).toMatchObject({ status: 'FAILED', attempt: 2 });

    // Second attempt backs off further: 300 s, not another 60.
    const secondsOut = (afterFirst[1]!.nextAttemptAt!.getTime() - Date.now()) / 1_000;
    expect(secondsOut).toBeGreaterThan(290);
    expect(secondsOut).toBeLessThanOrEqual(301);

    const second = await authPost(`${API}/notifications/retry`, admin.token, {}, organization.id)
      .expect(200);

    expect(second.body.data).toMatchObject({ processed: 0 });

    resetNotificationService();
  });

  it('gives up once the attempt budget is spent', async () => {
    const organization = await createOrganization();
    const admin = await createStaff('PLATFORM_ADMIN');
    await seedFailedInvite(organization.id, admin.token);

    // Pretend it has already burned through every attempt.
    await prisma.notificationDelivery.updateMany({
      data: {
        attempt: env.NOTIFICATION_MAX_ATTEMPTS,
        nextAttemptAt: new Date(Date.now() - 60_000),
      },
    });

    setNotificationService(new FailingNotificationService());

    const sweep = await authPost(`${API}/notifications/retry`, admin.token, {}, organization.id)
      .expect(200);

    expect(sweep.body.data).toMatchObject({ processed: 1, exhausted: 1, failed: 0 });

    const rows = await deliveries();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.nextAttemptAt).toBeNull();

    resetNotificationService();
  });

  it('stops retrying an invitation that has already been accepted', async () => {
    const organization = await createOrganization();
    const admin = await createStaff('PLATFORM_ADMIN');
    const invitation = await seedFailedInvite(organization.id, admin.token);

    await request(app)
      .post(`${API}/auth/accept-invite`)
      .send({ token: invitation.inviteToken, password: 'Accepted-Password-9' })
      .expect(200);

    await makeDue();

    const sweep = await authPost(`${API}/notifications/retry`, admin.token, {}, organization.id)
      .expect(200);

    expect(sweep.body.data).toMatchObject({ processed: 1, sent: 0, skipped: 1 });

    const rows = await deliveries();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.error).toMatch(/no longer awaiting acceptance/i);
  });

  it('refuses the manual sweep without notification:manage', async () => {
    const organization = await createOrganization();
    const accountManager = await createStaff('ACCOUNT_MANAGER');
    const podManager = await createStaff('POD_MANAGER');
    const owner = await createMember({ organizationId: organization.id, roles: ['CLIENT_OWNER'] });

    await authPost(`${API}/notifications/retry`, accountManager.token, {}, organization.id)
      .expect(403);
    await authPost(`${API}/notifications/retry`, podManager.token, {}, organization.id).expect(403);
    await authPost(`${API}/notifications/retry`, owner.token, {}, organization.id).expect(403);
  });
});

describe('GET /api/v1/notifications/deliveries', () => {
  it('returns the audit with a status summary', async () => {
    const organization = await createOrganization();
    const admin = await createStaff('OPERATIONS_MANAGER');

    // One successful delivery via the memory driver...
    setNotificationService(new MemoryNotificationService());
    await inviteMember({ organizationId: organization.id, adminToken: admin.token });
    // ...and one failure that sits in the retry queue.
    await seedFailedInvite(organization.id, admin.token);

    const response = await authGet(
      `${API}/notifications/deliveries`,
      admin.token,
      organization.id,
    ).expect(200);

    expect(response.body.data.total).toBe(2);
    expect(response.body.data.summary).toMatchObject({
      sent: 1,
      failed: 1,
      skipped: 0,
      pendingRetry: 1,
    });

    const [newest] = response.body.data.items as { status: string; attempt: number }[];
    expect(newest?.status).toBe('FAILED');
    expect(newest?.attempt).toBe(1);
  });

  it('filters by status and recipient, and paginates', async () => {
    const organization = await createOrganization();
    const admin = await createStaff('OPERATIONS_MANAGER');

    setNotificationService(new MemoryNotificationService());
    await inviteMember({
      organizationId: organization.id,
      adminToken: admin.token,
      email: 'findme@client.test',
    });
    await inviteMember({ organizationId: organization.id, adminToken: admin.token });
    await seedFailedInvite(organization.id, admin.token);

    const failed = await authGet(
      `${API}/notifications/deliveries?status=FAILED`,
      admin.token,
      organization.id,
    ).expect(200);

    expect(failed.body.data.total).toBe(1);

    const byRecipient = await authGet(
      `${API}/notifications/deliveries?recipient=findme`,
      admin.token,
      organization.id,
    ).expect(200);

    expect(byRecipient.body.data.total).toBe(1);
    expect(byRecipient.body.data.items[0].recipient).toBe('findme@client.test');

    const paged = await authGet(
      `${API}/notifications/deliveries?pageSize=1&page=2`,
      admin.token,
      organization.id,
    ).expect(200);

    expect(paged.body.data.items).toHaveLength(1);
    expect(paged.body.data.total).toBe(3);
    expect(paged.body.data.page).toBe(2);
  });

  it('never shows another tenant’s deliveries', async () => {
    const mine = await createOrganization();
    const theirs = await createOrganization();
    const admin = await createStaff('PLATFORM_ADMIN');

    setNotificationService(new MemoryNotificationService());
    await inviteMember({ organizationId: theirs.id, adminToken: admin.token });

    const response = await authGet(
      `${API}/notifications/deliveries`,
      admin.token,
      mine.id,
    ).expect(200);

    expect(response.body.data.total).toBe(0);
    expect(response.body.data.items).toEqual([]);
  });

  it('refuses clients and roles without notification:read', async () => {
    const organization = await createOrganization();
    const owner = await createMember({ organizationId: organization.id, roles: ['CLIENT_OWNER'] });
    const podManager = await createStaff('POD_MANAGER');

    await authGet(`${API}/notifications/deliveries`, owner.token, organization.id).expect(403);
    await authGet(`${API}/notifications/deliveries`, podManager.token, organization.id).expect(403);
  });
});
