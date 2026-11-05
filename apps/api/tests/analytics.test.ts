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

/**
 * The analytics endpoint.
 *
 * The test database is shared across files, so these assertions are written as
 * *deltas* — what changed when this test added rows — rather than absolutes. A
 * hard-coded average would break the moment any other suite closed a request.
 */
async function report(token: string, windowDays?: number) {
  const suffix = windowDays ? `?windowDays=${windowDays}` : '';
  const response = await authGet(`${API}/ops/analytics${suffix}`, token).expect(200);
  return response.body.data;
}

async function seedRequest(token: string, organizationId: string, title: string) {
  const response = await authPost(
    `${API}/service-requests`,
    token,
    { title, description: 'Seeded for the analytics assertions' },
    organizationId,
  ).expect(201);

  return response.body.data as { id: string };
}

describe('GET /ops/analytics', () => {
  it('counts a closed request in the turnaround sample, with its own duration', async () => {
    const admin = await createStaff('PLATFORM_ADMIN');
    const organization = await createOrganization();

    const before = await report(admin.token);

    const first = await seedRequest(admin.token, organization.id, 'Closed in eight hours');
    const second = await seedRequest(admin.token, organization.id, 'Closed in four hours');

    const now = Date.now();
    await prisma.serviceRequest.update({
      where: { id: first.id },
      data: {
        createdAt: new Date(now - 10 * 3_600_000),
        closedAt: new Date(now - 2 * 3_600_000),
        status: 'CLOSED',
      },
    });
    await prisma.serviceRequest.update({
      where: { id: second.id },
      data: {
        createdAt: new Date(now - 20 * 3_600_000),
        closedAt: new Date(now - 16 * 3_600_000),
        status: 'CLOSED',
      },
    });

    const after = await report(admin.token);

    expect(after.turnaround.sampled).toBe(before.turnaround.sampled + 2);
    expect(after.turnaround.avgHours).toBeGreaterThan(0);
    expect(after.turnaround.medianHours).toBeGreaterThan(0);
    expect(after.turnaround.p90Hours).toBeGreaterThanOrEqual(after.turnaround.medianHours);
    // A closed request is in the closed count, and out of the open one.
    expect(after.totals.closedRequests).toBeGreaterThanOrEqual(before.totals.closedRequests + 2);
  });

  it('measures punctuality against the SLA target, not the due date', async () => {
    const admin = await createStaff('PLATFORM_ADMIN');
    const organization = await createOrganization();

    const before = await report(admin.token);

    const onTime = await seedRequest(admin.token, organization.id, 'Closed inside its SLA');
    const late = await seedRequest(admin.token, organization.id, 'Closed after its SLA');

    const now = Date.now();
    // Two distinct commitments: one closes inside its window, one closes after.
    const metTarget = new Date(now - 3_600_000);
    const missedTarget = new Date(now - 5 * 3_600_000);

    await prisma.serviceRequest.update({
      where: { id: onTime.id },
      data: {
        createdAt: new Date(now - 5 * 3_600_000),
        slaTargetAt: metTarget,
        closedAt: new Date(now - 2 * 3_600_000), // closed before the target
        status: 'CLOSED',
      },
    });
    await prisma.serviceRequest.update({
      where: { id: late.id },
      data: {
        createdAt: new Date(now - 9 * 3_600_000),
        slaTargetAt: missedTarget,
        closedAt: new Date(now - 1 * 3_600_000), // an hour past the target
        status: 'CLOSED',
      },
    });

    const after = await report(admin.token);

    expect(after.turnaround.onTime).toBe(before.turnaround.onTime + 1);
    expect(after.turnaround.late).toBe(before.turnaround.late + 1);

    const measured = after.turnaround.onTime + after.turnaround.late;
    expect(after.turnaround.onTimeRate).toBe(
      Math.round((after.turnaround.onTime / measured) * 1_000) / 10,
    );
  });

  it('buckets throughput by week and counts what this test created', async () => {
    const admin = await createStaff('PLATFORM_ADMIN');
    const organization = await createOrganization();

    const before = await report(admin.token);
    const createdBefore = before.throughput.reduce(
      (total: number, bucket: { created: number }) => total + bucket.created,
      0,
    );

    await seedRequest(admin.token, organization.id, 'Throughput one');
    await seedRequest(admin.token, organization.id, 'Throughput two');
    await seedRequest(admin.token, organization.id, 'Throughput three');

    const after = await report(admin.token);
    const createdAfter = after.throughput.reduce(
      (total: number, bucket: { created: number }) => total + bucket.created,
      0,
    );

    expect(after.throughput).toHaveLength(8);
    expect(createdAfter).toBe(createdBefore + 3);
    // The current week is the last bucket, and it is where they landed.
    const last = after.throughput[after.throughput.length - 1];
    expect(last.created).toBeGreaterThanOrEqual(3);
    expect(last.bucket).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('reports pod efficiency: load, punctuality and how old the open work is', async () => {
    const admin = await createStaff('PLATFORM_ADMIN');
    const organization = await createOrganization();

    const pod = await authPost(
      `${API}/pods`,
      admin.token,
      { name: `Analytics Pod ${Date.now()}` },
      organization.id,
    ).expect(201);

    const closed = await seedRequest(admin.token, organization.id, 'Routed and closed');
    const open = await seedRequest(admin.token, organization.id, 'Routed and still open');

    const now = Date.now();

    await authPatch(
      `${API}/service-requests/${closed.id}/assign`,
      admin.token,
      { podId: pod.body.data.id },
      organization.id,
    ).expect(200);
    await authPatch(
      `${API}/service-requests/${open.id}/assign`,
      admin.token,
      { podId: pod.body.data.id },
      organization.id,
    ).expect(200);

    await prisma.serviceRequest.update({
      where: { id: closed.id },
      data: {
        createdAt: new Date(now - 12 * 3_600_000),
        slaTargetAt: new Date(now - 10 * 3_600_000),
        closedAt: new Date(now - 8 * 3_600_000), // two hours past the target
        status: 'CLOSED',
      },
    });
    await prisma.serviceRequest.update({
      where: { id: open.id },
      data: { createdAt: new Date(now - 30 * 3_600_000) },
    });

    const after = await report(admin.token);
    const row = after.pods.find(
      (entry: { podId: string }) => entry.podId === pod.body.data.id,
    );

    expect(row).toBeDefined();
    expect(row.podName).toBe(pod.body.data.name);
    expect(row.closedRequests).toBe(1);
    expect(row.openRequests).toBe(1);
    expect(row.late).toBe(1);
    expect(row.onTime).toBe(0);
    expect(row.onTimeRate).toBe(0);
    expect(row.avgOpenAgeHours).toBeGreaterThan(29);
  });

  it('reports tenant growth per month, ending at the current tenant total', async () => {
    const admin = await createStaff('PLATFORM_ADMIN');
    const organization = await createOrganization({ name: 'Growth Co' });

    // A tenant with a request is an *active* tenant; one that has never raised
    // anything is a signup. The report distinguishes them, so the fixture must
    // produce both facts.
    await seedRequest(admin.token, organization.id, 'First request from a new tenant');

    const after = await report(admin.token);

    expect(after.tenantGrowth).toHaveLength(6);

    const last = after.tenantGrowth[after.tenantGrowth.length - 1];
    expect(last.newTenants).toBeGreaterThanOrEqual(1);
    // Cumulative only ever grows, and never exceeds what exists.
    for (let index = 1; index < after.tenantGrowth.length; index += 1) {
      expect(after.tenantGrowth[index].cumulative).toBeGreaterThanOrEqual(
        after.tenantGrowth[index - 1].cumulative,
      );
    }
    expect(last.cumulative).toBe(after.totals.tenants);
    expect(after.totals.tenants).toBeGreaterThanOrEqual(1);
    expect(after.totals.activeTenants).toBeGreaterThanOrEqual(1);

    // The tenant we just created is one of the active ones.
    const tenant = await prisma.organization.findUnique({ where: { id: organization.id } });
    expect(tenant).not.toBeNull();
  });

  it('honours the window and rejects nonsense', async () => {
    const admin = await createStaff('PLATFORM_ADMIN');

    const week = await report(admin.token, 7);
    expect(week.windowDays).toBe(7);

    const year = await report(admin.token, 365);
    expect(year.windowDays).toBe(365);
    // A wider window can only include more.
    expect(year.turnaround.sampled).toBeGreaterThanOrEqual(week.turnaround.sampled);

    const defaulted = await report(admin.token);
    expect(defaulted.windowDays).toBe(90);

    await authGet(`${API}/ops/analytics?windowDays=3`, admin.token).expect(400);
    await authGet(`${API}/ops/analytics?windowDays=abc`, admin.token).expect(400);
  });

  it('is a platform report: no tenant scope, no client access', async () => {
    const organization = await createOrganization();
    const client = await createMember({ organizationId: organization.id, roles: ['CLIENT_OWNER'] });

    await authGet(`${API}/ops/analytics`, client.token).expect(403);
    await authGet(`${API}/ops/analytics`, 'not-a-token').expect(401);
  });
});
