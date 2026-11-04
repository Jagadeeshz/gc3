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
import { computeSlaState } from '../src/lib/sla';
import { drainEventQueue } from '../src/notifications/events';
import { getEventOutbox, resetNotificationService, setNotificationService } from '../src/notifications';
import { MemoryNotificationService } from '../src/notifications/drivers';

const HOUR = 3_600_000;

async function seedRequest(
  organizationId: string,
  token: string,
  overrides: { priority?: string; categoryId?: string; title?: string } = {},
) {
  const response = await authPost(
    `${API}/service-requests`,
    token,
    {
      title: overrides.title ?? 'SLA seed request',
      description: 'A request created to exercise the delivery commitment.',
      status: 'SUBMITTED',
      priority: overrides.priority ?? 'NORMAL',
      ...(overrides.categoryId ? { categoryId: overrides.categoryId } : {}),
    },
    organizationId,
  ).expect(201);

  return response.body.data as { id: string; slaTargetAt: string; createdAt: string };
}

/**
 * Forces the commitment so a test can stand in the warning window or past it.
 *
 * Both ends move: the warning window is a fraction of the *contract* duration, so
 * setting only the target would shrink the window to match and the request would
 * read as ON_TRACK. A 72h contract is kept and the clock is wound forward.
 */
async function forceTarget(requestId: string, phase: 'at-risk' | 'breached') {
  const now = Date.now();
  const createdAt = new Date(now - (phase === 'at-risk' ? 71 : 73) * HOUR);
  const target = new Date(now + (phase === 'at-risk' ? 1 : -1) * HOUR);

  await prisma.serviceRequest.update({
    where: { id: requestId },
    data: {
      createdAt,
      slaTargetAt: target,
      slaAlertedState: null,
      slaAlertedAt: null,
    },
  });
}

describe('SLA target', () => {
  it('is materialised from the priority default at creation', async () => {
    const organization = await createOrganization();
    const admin = await createStaff('PLATFORM_ADMIN');
    const request = await seedRequest(organization.id, admin.token, { priority: 'URGENT' });

    const target = new Date(request.slaTargetAt).getTime();
    const created = new Date(request.createdAt).getTime();

    expect(target - created).toBeCloseTo(8 * HOUR, -4);
  });

  it('prefers the service category hours over the priority default', async () => {
    const organization = await createOrganization();
    const admin = await createStaff('PLATFORM_ADMIN');

    const category = await authPost(
      `${API}/service-categories`,
      admin.token,
      { name: 'Managed Migration', slaDeliveryHours: 12 },
      organization.id,
    ).expect(201);

    expect(category.body.data.slaDeliveryHours).toBe(12);

    const request = await seedRequest(organization.id, admin.token, {
      priority: 'URGENT',
      categoryId: category.body.data.id as string,
    });

    const delta =
      new Date(request.slaTargetAt).getTime() - new Date(request.createdAt).getTime();

    // 12 hours wins over URGENT's 8.
    expect(delta).toBeCloseTo(12 * HOUR, -4);
  });

  it('moves when the priority changes, measured from creation and re-arming the alert', async () => {
    const organization = await createOrganization();
    const admin = await createStaff('PLATFORM_ADMIN');
    const request = await seedRequest(organization.id, admin.token, { priority: 'LOW' });

    await prisma.serviceRequest.update({
      where: { id: request.id },
      data: { slaAlertedState: 'AT_RISK', slaAlertedAt: new Date() },
    });

    const updated = await authPatch(
      `${API}/service-requests/${request.id}`,
      admin.token,
      { priority: 'URGENT' },
      organization.id,
    ).expect(200);

    const delta =
      new Date(updated.body.data.slaTargetAt).getTime() -
      new Date(updated.body.data.createdAt).getTime();

    expect(delta).toBeCloseTo(8 * HOUR, -4);

    const row = await prisma.serviceRequest.findUniqueOrThrow({ where: { id: request.id } });
    expect(row.slaAlertedState).toBeNull();
    expect(row.slaAlertedAt).toBeNull();
  });
});

describe('computeSlaState', () => {
  const start = new Date('2026-01-01T00:00:00.000Z');

  it('is NONE without a target, for drafts and for cancellations', () => {
    expect(
      computeSlaState({ status: 'SUBMITTED', targetAt: null, closedAt: null, startAt: start }, start),
    ).toBe('NONE');
    expect(
      computeSlaState(
        { status: 'DRAFT', targetAt: new Date(start.getTime() + 72 * HOUR), closedAt: null, startAt: start },
        start,
      ),
    ).toBe('NONE');
    expect(
      computeSlaState(
        {
          status: 'CANCELLED',
          targetAt: new Date(start.getTime() + 72 * HOUR),
          closedAt: null,
          startAt: start,
        },
        start,
      ),
    ).toBe('NONE');
  });

  it('walks ON_TRACK → AT_RISK → BREACHED against a 72h window', () => {
    const targetAt = new Date(start.getTime() + 72 * HOUR);
    const base = { status: 'IN_PROGRESS' as const, targetAt, closedAt: null, startAt: start };

    // Well inside: 12h in, 60h remaining against an 18h warning window.
    expect(computeSlaState(base, new Date(start.getTime() + 12 * HOUR))).toBe('ON_TRACK');
    // Last quarter: 60h in, 12h remaining.
    expect(computeSlaState(base, new Date(start.getTime() + 60 * HOUR))).toBe('AT_RISK');
    // One minute late.
    expect(computeSlaState(base, new Date(targetAt.getTime() + 60_000))).toBe('BREACHED');
  });

  it('judges a closed request by when it closed', () => {
    const targetAt = new Date(start.getTime() + 72 * HOUR);

    expect(
      computeSlaState(
        {
          status: 'CLOSED',
          targetAt,
          closedAt: new Date(start.getTime() + 48 * HOUR),
          startAt: start,
        },
        new Date(start.getTime() + 100 * HOUR),
      ),
    ).toBe('MET');

    expect(
      computeSlaState(
        {
          status: 'CLOSED',
          targetAt,
          closedAt: new Date(start.getTime() + 80 * HOUR),
          startAt: start,
        },
        new Date(start.getTime() + 100 * HOUR),
      ),
    ).toBe('MISSED');
  });
});

describe('GET /ops/dashboard — SLA flags', () => {
  it('counts at-risk and breached requests per tenant and per queue row', async () => {
    const organization = await createOrganization({ name: 'SLA Tenant' });
    const admin = await createStaff('OPERATIONS_MANAGER');

    const atRisk = await seedRequest(organization.id, admin.token, { title: 'Nearly late' });
    const breached = await seedRequest(organization.id, admin.token, { title: 'Already late' });
    const fine = await seedRequest(organization.id, admin.token, { title: 'Comfortable' });

    await forceTarget(atRisk.id, 'at-risk');
    await forceTarget(breached.id, 'breached');
    void fine;

    const dashboard = await authGet(
      `${API}/ops/dashboard?organizationId=${organization.id}`,
      admin.token,
    ).expect(200);

    const row = dashboard.body.data.organizations[0];
    expect(row).toMatchObject({ slaAtRisk: 1, slaBreached: 1 });
    expect(dashboard.body.data.totals.slaAtRisk).toBe(1);
    expect(dashboard.body.data.totals.slaBreached).toBe(1);

    const queue = dashboard.body.data.queue as { requestId: string; slaState: string }[];
    expect(queue.find((item) => item.requestId === atRisk.id)?.slaState).toBe('AT_RISK');
    expect(queue.find((item) => item.requestId === breached.id)?.slaState).toBe('BREACHED');
    expect(queue.find((item) => item.requestId === fine.id)?.slaState).toBe('ON_TRACK');
  });
});

describe('POST /ops/sla/sweep — risk alerts', () => {
  it('alerts the assignee once per state and records an SLA_RISK delivery', async () => {
    setNotificationService(new MemoryNotificationService());

    const organization = await createOrganization();
    const admin = await createStaff('PLATFORM_ADMIN');
    const specialist = await createStaff('SPECIALIST');

    const request = await seedRequest(organization.id, admin.token, { title: 'At risk request' });
    await authPatch(
      `${API}/service-requests/${request.id}/assign`,
      admin.token,
      { assigneeId: specialist.userId },
      organization.id,
    ).expect(200);
    await forceTarget(request.id, 'at-risk');

    const first = await authPost(
      `${API}/ops/sla/sweep?organizationId=${organization.id}`,
      admin.token,
      {},
    ).expect(200);

    expect(first.body.data).toMatchObject({ atRisk: 1, breached: 0, alerted: 1, skipped: 0 });

    await drainEventQueue();

    const messages = getEventOutbox();
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({
      to: specialist.email,
      kind: 'sla_risk',
      slaState: 'AT_RISK',
    });
    expect(messages[0]?.requestUrl).toContain(`/requests/${request.id}`);

    const audited = await prisma.notificationDelivery.findMany({ where: { kind: 'SLA_RISK' } });
    expect(audited).toHaveLength(1);
    expect(audited[0]).toMatchObject({ status: 'SENT', attempt: 1 });
    expect(audited[0]?.subjectRequestId).toBe(request.id);

    // A second sweep at the same state says nothing new.
    const second = await authPost(
      `${API}/ops/sla/sweep?organizationId=${organization.id}`,
      admin.token,
      {},
    ).expect(200);

    expect(second.body.data).toMatchObject({ atRisk: 1, alerted: 0 });
    await drainEventQueue();
    expect(getEventOutbox()).toHaveLength(1);

    resetNotificationService();
  });

  it('escalates: a breach after a warning alerts again', async () => {
    setNotificationService(new MemoryNotificationService());

    const organization = await createOrganization();
    const admin = await createStaff('PLATFORM_ADMIN');
    const specialist = await createStaff('SPECIALIST');

    const request = await seedRequest(organization.id, admin.token, { title: 'Escalating request' });
    await authPatch(
      `${API}/service-requests/${request.id}/assign`,
      admin.token,
      { assigneeId: specialist.userId },
      organization.id,
    ).expect(200);

    await forceTarget(request.id, 'at-risk');
    await authPost(`${API}/ops/sla/sweep?organizationId=${organization.id}`, admin.token, {}).expect(200);
    await drainEventQueue();

    // The window closes.
    await prisma.serviceRequest.update({
      where: { id: request.id },
      data: { slaTargetAt: new Date(Date.now() - 60_000) },
    });

    const escalated = await authPost(
      `${API}/ops/sla/sweep?organizationId=${organization.id}`,
      admin.token,
      {},
    ).expect(200);

    expect(escalated.body.data).toMatchObject({ atRisk: 0, breached: 1, alerted: 1 });
    await drainEventQueue();

    const messages = getEventOutbox();
    expect(messages).toHaveLength(2);
    expect(messages[1]).toMatchObject({ kind: 'sla_risk', slaState: 'BREACHED' });

    resetNotificationService();
  });

  it('falls back to the pod lead, and skips when nobody owns the work', async () => {
    setNotificationService(new MemoryNotificationService());

    const organization = await createOrganization();
    const admin = await createStaff('PLATFORM_ADMIN');
    const lead = await createStaff('POD_MANAGER');

    const pod = await authPost(
      `${API}/pods`,
      admin.token,
      { name: 'SLA Pod', leadId: lead.userId },
      organization.id,
    ).expect(201);

    const owned = await seedRequest(organization.id, admin.token, { title: 'Owned by a pod' });
    await authPatch(
      `${API}/service-requests/${owned.id}/assign`,
      admin.token,
      { podId: pod.body.data.id as string },
      organization.id,
    ).expect(200);
    await forceTarget(owned.id, 'breached');

    const orphan = await seedRequest(organization.id, admin.token, { title: 'Nobody owns this' });
    await forceTarget(orphan.id, 'breached');

    const sweep = await authPost(
      `${API}/ops/sla/sweep?organizationId=${organization.id}`,
      admin.token,
      {},
    ).expect(200);

    expect(sweep.body.data).toMatchObject({ breached: 2, alerted: 1, skipped: 1 });

    await drainEventQueue();

    const messages = getEventOutbox();
    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ to: lead.email, kind: 'sla_risk', slaState: 'BREACHED' });

    resetNotificationService();
  });

  it('is closed to staff without ops:read', async () => {
    const organization = await createOrganization();
    const specialist = await createStaff('SPECIALIST');

    await authPost(`${API}/ops/sla/sweep`, specialist.token, {}).expect(403);
  });

  it('is visible in the delivery audit by kind', async () => {
    setNotificationService(new MemoryNotificationService());

    const organization = await createOrganization();
    const admin = await createStaff('PLATFORM_ADMIN');
    const specialist = await createStaff('SPECIALIST');

    const request = await seedRequest(organization.id, admin.token);
    await authPatch(
      `${API}/service-requests/${request.id}/assign`,
      admin.token,
      { assigneeId: specialist.userId },
      organization.id,
    ).expect(200);
    await forceTarget(request.id, 'breached');

    await authPost(`${API}/ops/sla/sweep?organizationId=${organization.id}`, admin.token, {}).expect(200);
    await drainEventQueue();

    const audit = await authGet(
      `${API}/notifications/deliveries?kind=SLA_RISK`,
      admin.token,
      organization.id,
    ).expect(200);

    expect(audit.body.data.total).toBe(1);
    expect(audit.body.data.items[0].kind).toBe('SLA_RISK');

    resetNotificationService();
  });

  it('does not alert a client about internal risk', async () => {
    setNotificationService(new MemoryNotificationService());

    const organization = await createOrganization();
    const admin = await createStaff('PLATFORM_ADMIN');
    const owner = await createMember({ organizationId: organization.id, roles: ['CLIENT_OWNER'] });

    // The requester is a client; ownership is internal, so they are not the target.
    const request = await seedRequest(organization.id, owner.token);
    await forceTarget(request.id, 'breached');

    const sweep = await authPost(
      `${API}/ops/sla/sweep?organizationId=${organization.id}`,
      admin.token,
      {},
    ).expect(200);

    expect(sweep.body.data).toMatchObject({ breached: 1, alerted: 0, skipped: 1 });

    await drainEventQueue();
    expect(getEventOutbox()).toHaveLength(0);

    resetNotificationService();
  });
});
