import { describe, expect, it } from 'vitest';
import {
  API,
  authGet,
  authPatch,
  authPost,
  createMember,
  createOrganization,
  createStaff,
} from './helpers/api';
import { prisma } from '../src/db/client';
import { drainEventQueue, pendingEventJobs } from '../src/notifications/events';
import {
  getEventOutbox,
  resetNotificationService,
  setNotificationService,
} from '../src/notifications';
import {
  FailingNotificationService,
  MemoryNotificationService,
} from '../src/notifications/drivers';

interface Seeded {
  readonly requestId: string;
  readonly deliverableId: string;
}

async function seedRequest(organizationId: string, token: string, title = 'Event host request') {
  const response = await authPost(
    `${API}/service-requests`,
    token,
    {
      title,
      description: 'A request that will trigger notification events.',
      priority: 'NORMAL',
      status: 'SUBMITTED',
    },
    organizationId,
  ).expect(201);

  return response.body.data as { id: string; reference: string };
}

async function seedDeliverable(organizationId: string, token: string): Promise<Seeded> {
  const request = await seedRequest(organizationId, token);

  const deliverable = await authPost(
    `${API}/service-requests/${request.id}/deliverables`,
    token,
    { title: 'Release candidate pack' },
    organizationId,
  ).expect(201);

  return { requestId: request.id, deliverableId: deliverable.body.data.id as string };
}

async function approve(organizationId: string, token: string, seeded: Seeded) {
  return authPatch(
    `${API}/service-requests/${seeded.requestId}/deliverables/${seeded.deliverableId}/status`,
    token,
    { status: 'APPROVED' },
    organizationId,
  ).expect(200);
}

async function release(organizationId: string, token: string, seeded: Seeded) {
  return authPatch(
    `${API}/service-requests/${seeded.requestId}/deliverables/${seeded.deliverableId}/status`,
    token,
    { status: 'RELEASED' },
    organizationId,
  ).expect(200);
}

describe('deliverable released event', () => {
  it('emails the client owner and approver, and audits each send', async () => {
    const organization = await createOrganization();
    const admin = await createStaff('PLATFORM_ADMIN');
    const owner = await createMember({ organizationId: organization.id, roles: ['CLIENT_OWNER'] });
    const approver = await createMember({
      organizationId: organization.id,
      roles: ['CLIENT_APPROVER'],
    });
    await createMember({ organizationId: organization.id, roles: ['CLIENT_TEAM_MEMBER'] });

    const seeded = await seedDeliverable(organization.id, admin.token);
    await approve(organization.id, approver.token, seeded);
    await release(organization.id, approver.token, seeded);

    await drainEventQueue();

    const messages = getEventOutbox();
    expect(messages).toHaveLength(2);

    const recipients = messages.map((message) => message.to).sort();
    expect(recipients).toEqual([owner.email, approver.email].sort());

    const sample = messages[0]!;
    expect(sample.kind).toBe('deliverable_released');
    expect(sample.deliverableTitle).toBe('Release candidate pack');
    expect(sample.requestReference).toMatch(/^REQ-/);
    expect(sample.requestUrl).toContain(`/requests/${seeded.requestId}`);

    const rows = await prisma.notificationDelivery.findMany({
      where: { kind: 'DELIVERABLE_RELEASED' },
    });

    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.status).toBe('SENT');
      expect(row.attempt).toBe(1);
      expect(row.nextAttemptAt).toBeNull();
      expect(row.membershipId).toBeNull();
      expect(row.subjectRequestId).toBe(seeded.requestId);
      expect(row.subjectDeliverableId).toBe(seeded.deliverableId);
      expect(row.messageId).toBeTruthy();
    }
  });

  it('does not email on approval alone', async () => {
    const organization = await createOrganization();
    const admin = await createStaff('PLATFORM_ADMIN');
    await createMember({ organizationId: organization.id, roles: ['CLIENT_OWNER'] });
    const approver = await createMember({
      organizationId: organization.id,
      roles: ['CLIENT_APPROVER'],
    });

    const seeded = await seedDeliverable(organization.id, admin.token);
    await approve(organization.id, approver.token, seeded);
    await drainEventQueue();

    expect(getEventOutbox()).toHaveLength(0);
    expect(await prisma.notificationDelivery.count()).toBe(0);
  });
});

describe('request status updated event', () => {
  it('emails the requester with the from and to states', async () => {
    const organization = await createOrganization();
    const admin = await createStaff('PLATFORM_ADMIN');
    const owner = await createMember({ organizationId: organization.id, roles: ['CLIENT_OWNER'] });

    const request = await seedRequest(organization.id, owner.token, 'Move me through triage');

    await authPost(
      `${API}/service-requests/${request.id}/status`,
      admin.token,
      { status: 'TRIAGE' },
      organization.id,
    ).expect(200);

    await drainEventQueue();

    const messages = getEventOutbox();
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      to: owner.email,
      kind: 'request_status_updated',
      requestReference: request.reference,
      fromStatus: 'SUBMITTED',
      toStatus: 'TRIAGE',
    });

    const row = await prisma.notificationDelivery.findFirst({
      where: { kind: 'REQUEST_STATUS_UPDATED' },
    });

    expect(row).toMatchObject({ status: 'SENT', attempt: 1, userId: owner.userId });
    expect(row?.subjectRequestId).toBe(request.id);
    expect(row?.membershipId).toBeNull();
  });

  it('sends nothing when the transition is refused', async () => {
    const organization = await createOrganization();
    const admin = await createStaff('PLATFORM_ADMIN');
    const owner = await createMember({ organizationId: organization.id, roles: ['CLIENT_OWNER'] });

    const request = await seedRequest(organization.id, owner.token);

    // SUBMITTED -> DELIVERED is not a legal move.
    await authPost(
      `${API}/service-requests/${request.id}/status`,
      admin.token,
      { status: 'DELIVERED' },
      organization.id,
    ).expect(409);

    await drainEventQueue();
    expect(getEventOutbox()).toHaveLength(0);
  });
});

describe('event delivery failures', () => {
  it('queues a failed event into the retry pipeline and rebuilds it on retry', async () => {
    const organization = await createOrganization();
    const admin = await createStaff('PLATFORM_ADMIN');
    const approver = await createMember({
      organizationId: organization.id,
      roles: ['CLIENT_APPROVER'],
    });

    const seeded = await seedDeliverable(organization.id, admin.token);
    await approve(organization.id, approver.token, seeded);

    // The relay is down for the release.
    setNotificationService(new FailingNotificationService());
    await release(organization.id, approver.token, seeded);
    await drainEventQueue();

    const failed = await prisma.notificationDelivery.findMany({
      where: { kind: 'DELIVERABLE_RELEASED' },
    });

    expect(failed).toHaveLength(1);
    expect(failed[0]).toMatchObject({ status: 'FAILED', attempt: 1 });
    expect(failed[0]?.error).toMatch(/simulated provider failure/);
    expect(failed[0]?.nextAttemptAt).toBeInstanceOf(Date);

    // Relay back; the schedule comes due.
    resetNotificationService();
    setNotificationService(new MemoryNotificationService());
    await prisma.notificationDelivery.updateMany({
      data: { nextAttemptAt: new Date(Date.now() - 60_000) },
    });

    const sweep = await authPost(`${API}/notifications/retry`, admin.token, {}, organization.id)
      .expect(200);

    expect(sweep.body.data).toMatchObject({ processed: 1, sent: 1 });

    const afterRetry = await prisma.notificationDelivery.findMany({
      where: { kind: 'DELIVERABLE_RELEASED' },
      orderBy: { attempt: 'asc' },
    });

    expect(afterRetry).toHaveLength(2);
    expect(afterRetry[1]).toMatchObject({ status: 'SENT', attempt: 2 });

    // Rebuilt from the database: same subject, real content.
    const retried = getEventOutbox();
    expect(retried).toHaveLength(1);
    expect(retried[0]).toMatchObject({
      kind: 'deliverable_released',
      deliverableTitle: 'Release candidate pack',
    });

    resetNotificationService();
  });

  it('abandons a retry when the deliverable no longer exists', async () => {
    const organization = await createOrganization();
    const admin = await createStaff('PLATFORM_ADMIN');
    const approver = await createMember({
      organizationId: organization.id,
      roles: ['CLIENT_APPROVER'],
    });

    const seeded = await seedDeliverable(organization.id, admin.token);
    await approve(organization.id, approver.token, seeded);

    setNotificationService(new FailingNotificationService());
    await release(organization.id, approver.token, seeded);
    await drainEventQueue();

    // The record is gone before the retry window opens.
    await prisma.deliverable.delete({ where: { id: seeded.deliverableId } });

    resetNotificationService();
    setNotificationService(new MemoryNotificationService());
    await prisma.notificationDelivery.updateMany({
      data: { nextAttemptAt: new Date(Date.now() - 60_000) },
    });

    const sweep = await authPost(`${API}/notifications/retry`, admin.token, {}, organization.id)
      .expect(200);

    expect(sweep.body.data).toMatchObject({ processed: 1, skipped: 1, sent: 0 });

    const row = await prisma.notificationDelivery.findFirst({
      where: { kind: 'DELIVERABLE_RELEASED' },
    });

    expect(row?.nextAttemptAt).toBeNull();
    // The FK sets subject_deliverable_id to null on delete, so the sweep reports
    // the missing subject rather than a missing row.
    expect(row?.error).toMatch(/not retried/i);
    expect(getEventOutbox()).toHaveLength(0);

    resetNotificationService();
  });
});

describe('event notifications in the audit API', () => {
  it('are queryable by kind', async () => {
    const organization = await createOrganization();
    const admin = await createStaff('OPERATIONS_MANAGER');
    const approver = await createMember({
      organizationId: organization.id,
      roles: ['CLIENT_APPROVER'],
    });

    const seeded = await seedDeliverable(organization.id, admin.token);
    await approve(organization.id, approver.token, seeded);
    await release(organization.id, approver.token, seeded);

    await authPost(
      `${API}/service-requests/${seeded.requestId}/status`,
      admin.token,
      { status: 'TRIAGE' },
      organization.id,
    ).expect(200);

    await drainEventQueue();
    expect(pendingEventJobs()).toBe(0);

    const response = await authGet(
      `${API}/notifications/deliveries?kind=DELIVERABLE_RELEASED`,
      admin.token,
      organization.id,
    ).expect(200);

    expect(response.body.data.total).toBe(1);
    expect(response.body.data.items[0].kind).toBe('DELIVERABLE_RELEASED');

    const all = await authGet(`${API}/notifications/deliveries`, admin.token, organization.id)
      .expect(200);

    expect(all.body.data.summary.sent).toBeGreaterThanOrEqual(2);
  });
});
