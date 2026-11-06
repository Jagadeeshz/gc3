import { describe, expect, it } from 'vitest';
import { prisma } from '../src/db/client';
import {
  API,
  authGet,
  authPatch,
  authPost,
  createMember,
  createOrganization,
  createStaff,
} from './helpers/api';

/**
 * Staff dashboards (Phase 7).
 *
 * Three things are being pinned here, and they are the three that would hurt:
 *
 *  1. The permission split — `directory:read`, `ops:read` and `security:read` are
 *     different boundaries, so a pod manager can run delivery without reading the
 *     security log, and the sales desk can see the client list without seeing work.
 *  2. Row scoping — a specialist's board is their own work, a pod manager's is
 *     their pod, and neither can widen it with a query parameter.
 *  3. The regression that shipped a 500: an empty scope must return an empty list,
 *     never a sentinel string that reaches Postgres as a uuid.
 */

async function seedRequest(organizationId: string, token: string, title: string) {
  const response = await authPost(
    `${API}/service-requests`,
    token,
    { title, description: 'Work for the dashboard fixtures.', status: 'SUBMITTED' },
    organizationId,
  ).expect(201);

  return response.body.data as { id: string; reference: string };
}

async function seedPod(organizationId: string, token: string, name: string) {
  const response = await authPost(`${API}/pods`, token, { name }, organizationId).expect(201);
  return response.body.data as { id: string };
}

async function seedTask(
  organizationId: string,
  adminToken: string,
  requestId: string,
  assigneeId: string,
  title: string,
) {
  const response = await authPost(
    `${API}/service-requests/${requestId}/tasks`,
    adminToken,
    { title, assigneeId },
    organizationId,
  ).expect(201);

  return response.body.data as { id: string };
}

/** A tenant with one pod, one request in that pod, and one task per person. */
async function seedDelivery() {
  const organization = await createOrganization();
  const admin = await createStaff('PLATFORM_ADMIN');
  const podManager = await createStaff('POD_MANAGER');
  const specialist = await createStaff('SPECIALIST');
  const outsider = await createStaff('SPECIALIST');

  const pod = await seedPod(organization.id, admin.token, 'Dashboard Pod');
  const request = await seedRequest(organization.id, admin.token, 'Dashboard request');

  await authPatch(
    `${API}/service-requests/${request.id}/assign`,
    admin.token,
    { podId: pod.id },
    organization.id,
  );

  // Seat the pod manager and one specialist in the pod.
  for (const person of [podManager, specialist]) {
    await prisma.podMember.create({
      data: { organizationId: organization.id, podId: pod.id, userId: person.userId },
    });
  }

  await seedTask(organization.id, admin.token, request.id, specialist.userId, 'Specialist task');
  await seedTask(organization.id, admin.token, request.id, podManager.userId, 'Manager task');

  return { organization, admin, podManager, specialist, outsider, request };
}

describe('GET /ops/organizations — the client directory', () => {
  it('answers the sales desk and the executive seat', async () => {
    const sales = await createStaff('SALES_MANAGER');
    const management = await createStaff('MANAGEMENT');

    await authGet(`${API}/ops/organizations`, sales.token).expect(200);
    await authGet(`${API}/ops/organizations`, management.token).expect(200);
  });

  it('refuses a specialist and a client', async () => {
    const specialist = await createStaff('SPECIALIST');
    const organization = await createOrganization();
    const owner = await createMember({ organizationId: organization.id, roles: ['CLIENT_OWNER'] });

    await authGet(`${API}/ops/organizations`, specialist.token).expect(403);
    await authGet(`${API}/ops/organizations`, owner.token).expect(403);
  });
});

describe('GET /ops/audit — the security boundary', () => {
  it('is closed to a pod manager and open to operations', async () => {
    const podManager = await createStaff('POD_MANAGER');
    const operations = await createStaff('OPERATIONS_MANAGER');

    await authGet(`${API}/ops/audit`, podManager.token).expect(403);
    await authGet(`${API}/ops/audit`, operations.token).expect(200);
  });

  it('is closed to the sales desk, which holds no security:read', async () => {
    const sales = await createStaff('SALES_MANAGER');
    await authGet(`${API}/ops/audit`, sales.token).expect(403);
  });
});

describe('GET /ops/tasks — row scoping', () => {
  it('gives a specialist only their own tasks', async () => {
    const seeded = await seedDelivery();

    const response = await authGet(`${API}/ops/tasks`, seeded.specialist.token).expect(200);
    const rows = response.body.data as { assigneeId: string }[];

    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.assigneeId === seeded.specialist.userId)).toBe(true);
  });

  it('gives a pod manager the work seated in their pod', async () => {
    const seeded = await seedDelivery();

    const response = await authGet(`${API}/ops/tasks`, seeded.podManager.token).expect(200);
    const rows = response.body.data as { assigneeId: string }[];
    const assignees = new Set(rows.map((row) => row.assigneeId));

    expect(assignees.has(seeded.specialist.userId)).toBe(true);
    expect(assignees.has(seeded.podManager.userId)).toBe(true);
    expect(assignees.has(seeded.outsider.userId)).toBe(false);
  });

  it('gives operations the platform and narrows to self with mine=true', async () => {
    const seeded = await seedDelivery();

    const all = await authGet(`${API}/ops/tasks`, seeded.admin.token).expect(200);
    expect((all.body.data as unknown[]).length).toBeGreaterThanOrEqual(2);

    const mine = await authGet(
      `${API}/ops/tasks?mine=true&assigneeId=${seeded.specialist.userId}`,
      seeded.podManager.token,
    ).expect(200);
    const rows = mine.body.data as { assigneeId: string }[];

    // `mine` resolves from the token; the forged assigneeId in the query is ignored.
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.assigneeId === seeded.podManager.userId)).toBe(true);
  });

  it('returns an empty board, not an error, for someone with no seat and no tasks', async () => {
    const sales = await createStaff('SALES_MANAGER');

    // Regression: an empty pod scope used to reach Postgres as a uuid comparison
    // and 500 the workload endpoint.
    const workload = await authGet(`${API}/ops/workload`, sales.token).expect(200);
    expect(workload.body.data).toEqual([]);

    const tasks = await authGet(`${API}/ops/tasks`, sales.token).expect(200);
    expect(tasks.body.data).toEqual([]);
  });
});

describe('GET /ops/my/requests — the pod member door into a tenant', () => {
  it('returns the requests behind the caller own work, and nothing else', async () => {
    const seeded = await seedDelivery();
    const other = await seedRequest(seeded.organization.id, seeded.admin.token, 'Unrelated work');

    const response = await authGet(`${API}/ops/my/requests`, seeded.specialist.token).expect(200);
    const rows = response.body.data as { id: string }[];
    const ids = rows.map((row) => row.id);

    expect(ids).toContain(seeded.request.id);
    expect(ids).not.toContain(other.id);
  });

  it('refuses a client token outright', async () => {
    const organization = await createOrganization();
    const owner = await createMember({ organizationId: organization.id, roles: ['CLIENT_OWNER'] });

    await authGet(`${API}/ops/my/requests`, owner.token).expect(403);
  });
});

describe('new staff roles', () => {
  it('issues a token that verifies for SALES_MANAGER and MANAGEMENT', async () => {
    // Regression: the JWT claim schema enumerated the old roles, so these tokens
    // were minted and then rejected as invalid on the very next request.
    const sales = await createStaff('SALES_MANAGER');
    const management = await createStaff('MANAGEMENT');

    const me = await authGet(`${API}/auth/me`, sales.token).expect(200);
    expect((me.body.data as { actor: { platformRole: string } }).actor.platformRole).toBe(
      'SALES_MANAGER',
    );

    const meManagement = await authGet(`${API}/auth/me`, management.token).expect(200);
    expect(
      (meManagement.body.data as { actor: { platformRole: string } }).actor.platformRole,
    ).toBe('MANAGEMENT');
  });

  it('gives management read across delivery without any way to write', async () => {
    const management = await createStaff('MANAGEMENT');
    const organization = await createOrganization();

    await authGet(`${API}/ops/requests`, management.token).expect(200);

    // No create path: management holds no request:create.
    await authPost(
      `${API}/service-requests`,
      management.token,
      { title: 'Should not exist', description: 'Management may not raise work.', status: 'SUBMITTED' },
      organization.id,
    ).expect(403);
  });
});
