import { describe, expect, it } from 'vitest';
import { API, authGet, authPost, createMember, createOrganization, createStaff } from './helpers/api';

const DASHBOARD = `${API}/ops/dashboard`;

async function seedRequest(
  organizationId: string,
  token: string,
  overrides: { title?: string; status?: string; priority?: string; dueAt?: string } = {},
) {
  const response = await authPost(
    `${API}/service-requests`,
    token,
    {
      title: overrides.title ?? 'Ops seed request',
      description: 'Seeded for the operations dashboard.',
      status: overrides.status ?? 'SUBMITTED',
      priority: overrides.priority ?? 'NORMAL',
      ...(overrides.dueAt ? { dueAt: overrides.dueAt } : {}),
    },
    organizationId,
  ).expect(201);

  return response.body.data as { id: string; reference: string; status: string };
}

/** Walk the legal transition chain so the request really lands in CLOSED. */
async function closeRequest(organizationId: string, token: string, requestId: string) {
  for (const status of ['IN_PROGRESS', 'IN_REVIEW', 'DELIVERED', 'CLOSED']) {
    await authPost(
      `${API}/service-requests/${requestId}/status`,
      token,
      { status },
      organizationId,
    ).expect(200);
  }
}

function orgRow(dashboard: { organizations: { organizationId: string }[] }, id: string) {
  const row = dashboard.organizations.find((entry) => entry.organizationId === id);
  expect(row, `organization ${id} missing from the dashboard`).toBeDefined();
  return row as unknown as {
    organizationId: string;
    name: string;
    openRequests: number;
    blockedRequests: number;
    overdueRequests: number;
    unassignedRequests: number;
    podCount: number;
    memberCount: number;
    releasedDeliverables: number;
  };
}

describe('GET /ops/dashboard — access control', () => {
  it('serves a platform admin', async () => {
    const admin = await createStaff('PLATFORM_ADMIN');

    const response = await authGet(DASHBOARD, admin.token).expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data).toMatchObject({
      totals: expect.any(Object),
      organizations: expect.any(Array),
      pods: expect.any(Array),
      queue: expect.any(Array),
    });
    expect(typeof response.body.data.generatedAt).toBe('string');
  });

  it('serves an operations manager', async () => {
    const operations = await createStaff('OPERATIONS_MANAGER');

    await authGet(DASHBOARD, operations.token).expect(200);
  });

  it.each(['ACCOUNT_MANAGER', 'SPECIALIST', 'FINANCE_MANAGER'] as const)(
    'refuses a %s',
    async (role) => {
      const staff = await createStaff(role);

      const response = await authGet(DASHBOARD, staff.token).expect(403);
      expect(response.body.error.code).toBe('FORBIDDEN');
    },
  );

  it('refuses a client owner even when they send a tenant header', async () => {
    const organization = await createOrganization();
    const owner = await createMember({ organizationId: organization.id, roles: ['CLIENT_OWNER'] });

    await authGet(DASHBOARD, owner.token, organization.id).expect(403);
  });

  it('refuses an unauthenticated caller', async () => {
    await authGet(DASHBOARD, 'not-a-real-token').expect(401);
  });

  it('does not need a tenant header — the permission is the boundary', async () => {
    const admin = await createStaff('PLATFORM_ADMIN');
    const organization = await createOrganization();

    // With a header and without one, the same platform-wide answer comes back.
    const withHeader = await authGet(DASHBOARD, admin.token, organization.id).expect(200);
    const withoutHeader = await authGet(DASHBOARD, admin.token).expect(200);

    expect(withHeader.body.data.organizations.length).toBe(withoutHeader.body.data.organizations.length);
  });
});

describe('GET /ops/dashboard — cross-tenant aggregation', () => {
  it('reports every tenant independently, with correct open/blocked/overdue counts', async () => {
    const admin = await createStaff('OPERATIONS_MANAGER');
    const alpha = await createOrganization({ name: 'Ops Alpha' });
    const beta = await createOrganization({ name: 'Ops Beta' });

    // Alpha: one plain open request, one blocked and past due, one closed (not open).
    await seedRequest(alpha.id, admin.token, { title: 'Alpha open', status: 'SUBMITTED' });
    const blocked = await seedRequest(alpha.id, admin.token, {
      title: 'Alpha blocked',
      // Creation only accepts DRAFT/SUBMITTED; BLOCKED is reached by transition.
      status: 'SUBMITTED',
      dueAt: new Date(Date.now() - 3 * 86_400_000).toISOString(),
    });
    for (const status of ['IN_PROGRESS', 'BLOCKED']) {
      await authPost(
        `${API}/service-requests/${blocked.id}/status`,
        admin.token,
        { status },
        alpha.id,
      ).expect(200);
    }
    await seedRequest(alpha.id, admin.token, { title: 'Alpha closed', status: 'SUBMITTED' }).then(
      (request) => closeRequest(alpha.id, admin.token, request.id),
    );

    // Beta: a single in-flight request, assigned later in the pod suite.
    await seedRequest(beta.id, admin.token, { title: 'Beta open', status: 'SUBMITTED' });

    const response = await authGet(DASHBOARD, admin.token).expect(200);
    const dashboard = response.body.data;

    const alphaRow = orgRow(dashboard, alpha.id);
    expect(alphaRow).toMatchObject({
      name: 'Ops Alpha',
      openRequests: 2,
      blockedRequests: 1,
      overdueRequests: 1,
      unassignedRequests: 2,
    });

    const betaRow = orgRow(dashboard, beta.id);
    expect(betaRow).toMatchObject({
      name: 'Ops Beta',
      openRequests: 1,
      blockedRequests: 0,
      overdueRequests: 0,
      unassignedRequests: 1,
    });

    // Totals are the sum of the rows, not a separate query that could drift.
    expect(dashboard.totals.openRequests).toBeGreaterThanOrEqual(
      alphaRow.openRequests + betaRow.openRequests,
    );
  });

  it('narrows to one tenant on request', async () => {
    const admin = await createStaff('PLATFORM_ADMIN');
    const alpha = await createOrganization({ name: 'Narrow Alpha' });
    const beta = await createOrganization({ name: 'Narrow Beta' });
    await seedRequest(alpha.id, admin.token, { title: 'Only alpha' });
    await seedRequest(beta.id, admin.token, { title: 'Only beta' });

    const response = await authGet(
      `${DASHBOARD}?organizationId=${alpha.id}`,
      admin.token,
    ).expect(200);

    expect(response.body.data.organizations).toHaveLength(1);
    expect(response.body.data.organizations[0].organizationId).toBe(alpha.id);
    expect(response.body.data.queue.every((item: { organizationId: string }) => item.organizationId === alpha.id)).toBe(true);
  });

  it('puts unassigned work in the routing queue, honouring queueLimit', async () => {
    const admin = await createStaff('OPERATIONS_MANAGER');
    const organization = await createOrganization({ name: 'Queue Org' });

    for (let index = 0; index < 3; index += 1) {
      await seedRequest(organization.id, admin.token, { title: `Queue item ${index}` });
    }

    const limited = await authGet(
      `${DASHBOARD}?organizationId=${organization.id}&queueLimit=2`,
      admin.token,
    ).expect(200);

    expect(limited.body.data.queue).toHaveLength(2);
    expect(limited.body.data.queue[0]).toMatchObject({
      organizationId: organization.id,
      organizationName: 'Queue Org',
      podId: null,
      podName: null,
      assigneeId: null,
    });
    expect(limited.body.data.queue[0].reference).toMatch(/^REQ-/);
  });

  it('rejects an invalid queueLimit', async () => {
    const admin = await createStaff('PLATFORM_ADMIN');

    const response = await authGet(`${DASHBOARD}?queueLimit=500`, admin.token).expect(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
});
