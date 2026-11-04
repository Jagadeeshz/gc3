import { describe, expect, it } from 'vitest';
import {
  API,
  authDelete,
  authGet,
  authPatch,
  authPost,
  createMember,
  createOrganization,
  createStaff,
} from './helpers/api';

const PODS = `${API}/pods`;

async function createPod(
  organizationId: string,
  token: string,
  body: Record<string, unknown> = {},
) {
  const response = await authPost(
    PODS,
    token,
    { name: 'Staffing Pod', ...body },
    organizationId,
  ).expect(201);

  return response.body.data as {
    id: string;
    members: { userId: string; fullName: string; openRequests: number }[];
  };
}

function seat(
  organizationId: string,
  token: string,
  podId: string,
  userId: string,
) {
  return authPost(`${PODS}/${podId}/members`, token, { userId }, organizationId);
}

async function seedRequest(organizationId: string, token: string, assigneeId?: string) {
  const response = await authPost(
    `${API}/service-requests`,
    token,
    {
      title: 'Workload seed request',
      description: 'Used to check per-person load on the pod roster.',
      status: 'SUBMITTED',
    },
    organizationId,
  ).expect(201);

  const request = response.body.data as { id: string };

  if (assigneeId) {
    // Creation does not take an assignee; the routing endpoint is the real path.
    await authPatch(
      `${API}/service-requests/${request.id}/assign`,
      token,
      { assigneeId },
      organizationId,
    ).expect(200);
  }

  return request;
}

describe('POST /pods/:podId/members — seating', () => {
  it('seats a specialist and returns the updated roster', async () => {
    const organization = await createOrganization();
    const admin = await createStaff('PLATFORM_ADMIN');
    const specialist = await createStaff('SPECIALIST');
    const pod = await createPod(organization.id, admin.token);

    expect(pod.members).toHaveLength(0);

    const seated = await seat(organization.id, admin.token, pod.id, specialist.userId).expect(201);

    expect(seated.body.data.members).toHaveLength(1);
    expect(seated.body.data.members[0]).toMatchObject({
      userId: specialist.userId,
      openRequests: 0,
    });
    expect(seated.body.data.memberCount).toBe(1);
  });

  it('refuses to seat the same person twice', async () => {
    const organization = await createOrganization();
    const admin = await createStaff('PLATFORM_ADMIN');
    const specialist = await createStaff('SPECIALIST');
    const pod = await createPod(organization.id, admin.token);

    await seat(organization.id, admin.token, pod.id, specialist.userId).expect(201);

    const duplicate = await seat(organization.id, admin.token, pod.id, specialist.userId).expect(409);
    expect(duplicate.body.error.code).toBe('CONFLICT');
  });

  it('404s for a pod in another tenant and for an unknown user', async () => {
    const admin = await createStaff('PLATFORM_ADMIN');
    const alpha = await createOrganization({ name: 'Seat Alpha' });
    const beta = await createOrganization({ name: 'Seat Beta' });
    const specialist = await createStaff('SPECIALIST');
    const betaPod = await createPod(beta.id, admin.token, { name: 'Beta Staffing Pod' });

    const foreignPod = await seat(alpha.id, admin.token, betaPod.id, specialist.userId).expect(404);
    expect(foreignPod.body.error.message).toMatch(/Pod not found/);

    const localPod = await createPod(alpha.id, admin.token, { name: 'Alpha Staffing Pod' });
    await seat(
      alpha.id,
      admin.token,
      localPod.id,
      '99999999-9999-4999-8999-999999999999',
    ).expect(404);
  });

  it('is gated on pod:manage — a pod manager cannot seat, an ops manager can', async () => {
    const organization = await createOrganization();
    const admin = await createStaff('PLATFORM_ADMIN');
    const podManager = await createStaff('POD_MANAGER');
    const operations = await createStaff('OPERATIONS_MANAGER');
    const specialist = await createStaff('SPECIALIST');
    const pod = await createPod(organization.id, admin.token);

    await seat(organization.id, podManager.token, pod.id, specialist.userId).expect(403);
    await seat(organization.id, operations.token, pod.id, specialist.userId).expect(201);
  });
});

describe('DELETE /pods/:podId/members/:userId — removal', () => {
  it('removes a seated person, 204, and they are gone from the roster', async () => {
    const organization = await createOrganization();
    const admin = await createStaff('PLATFORM_ADMIN');
    const specialist = await createStaff('SPECIALIST');
    const pod = await createPod(organization.id, admin.token);
    await seat(organization.id, admin.token, pod.id, specialist.userId).expect(201);

    await authDelete(
      `${PODS}/${pod.id}/members/${specialist.userId}`,
      admin.token,
      organization.id,
    ).expect(204);

    const pods = await authGet(PODS, admin.token, organization.id).expect(200);
    expect(pods.body.data[0].members).toHaveLength(0);
    expect(pods.body.data[0].memberCount).toBe(0);
  });

  it('404s when the person is not seated', async () => {
    const organization = await createOrganization();
    const admin = await createStaff('PLATFORM_ADMIN');
    const specialist = await createStaff('SPECIALIST');
    const pod = await createPod(organization.id, admin.token);

    const response = await authDelete(
      `${PODS}/${pod.id}/members/${specialist.userId}`,
      admin.token,
      organization.id,
    ).expect(404);

    expect(response.body.error.message).toMatch(/not seated/);
  });

  it('cannot remove someone from another tenant’s pod', async () => {
    const admin = await createStaff('PLATFORM_ADMIN');
    const alpha = await createOrganization({ name: 'Remove Alpha' });
    const beta = await createOrganization({ name: 'Remove Beta' });
    const specialist = await createStaff('SPECIALIST');
    const betaPod = await createPod(beta.id, admin.token, { name: 'Beta Remove Pod' });
    await seat(beta.id, admin.token, betaPod.id, specialist.userId).expect(201);

    await authDelete(
      `${PODS}/${betaPod.id}/members/${specialist.userId}`,
      admin.token,
      alpha.id,
    ).expect(404);

    // Still seated where they belong.
    const pods = await authGet(PODS, admin.token, beta.id).expect(200);
    expect(pods.body.data[0].members).toHaveLength(1);
  });
});

describe('staff workload', () => {
  it('shows open requests per seated person', async () => {
    const organization = await createOrganization();
    const admin = await createStaff('PLATFORM_ADMIN');
    const specialist = await createStaff('SPECIALIST');
    const idle = await createStaff('SPECIALIST');
    const pod = await createPod(organization.id, admin.token);
    await seat(organization.id, admin.token, pod.id, specialist.userId).expect(201);
    await seat(organization.id, admin.token, pod.id, idle.userId).expect(201);

    await seedRequest(organization.id, admin.token, specialist.userId);
    await seedRequest(organization.id, admin.token, specialist.userId);

    const pods = await authGet(PODS, admin.token, organization.id).expect(200);
    const roster = pods.body.data[0].members as { userId: string; openRequests: number }[];

    expect(roster.find((member) => member.userId === specialist.userId)?.openRequests).toBe(2);
    expect(roster.find((member) => member.userId === idle.userId)?.openRequests).toBe(0);
  });

  it('lists seatable staff with the pods each already sits in', async () => {
    const organization = await createOrganization();
    const admin = await createStaff('PLATFORM_ADMIN');
    const specialist = await createStaff('SPECIALIST');
    const first = await createPod(organization.id, admin.token, { name: 'Staff Pod One' });
    const second = await createPod(organization.id, admin.token, { name: 'Staff Pod Two' });
    await seat(organization.id, admin.token, first.id, specialist.userId).expect(201);
    await seat(organization.id, admin.token, second.id, specialist.userId).expect(201);

    const response = await authGet(`${PODS}/staff`, admin.token, organization.id).expect(200);
    const candidates = response.body.data as {
      userId: string;
      platformRole: string;
      podCount: number;
    }[];

    const mine = candidates.find((candidate) => candidate.userId === specialist.userId);
    expect(mine).toMatchObject({ platformRole: 'SPECIALIST', podCount: 2 });

    // Every candidate is staff; client accounts never appear.
    expect(candidates.every((candidate) => candidate.platformRole !== null)).toBe(true);
    expect(candidates.some((candidate) => candidate.userId === admin.userId)).toBe(true);
  });

  it('keeps client accounts out of the roster entirely', async () => {
    const organization = await createOrganization();
    const admin = await createStaff('PLATFORM_ADMIN');
    const owner = await createMember({ organizationId: organization.id, roles: ['CLIENT_OWNER'] });

    const staff = await authGet(`${PODS}/staff`, admin.token, organization.id).expect(200);
    expect(
      (staff.body.data as { userId: string }[]).some((entry) => entry.userId === owner.userId),
    ).toBe(false);

    // A client cannot even read the roster.
    await authGet(`${PODS}/staff`, owner.token, organization.id).expect(403);

    const pod = await createPod(organization.id, admin.token);
    await seat(organization.id, admin.token, pod.id, owner.userId).expect(201);
    // ...but seating is not role-checked beyond existence: documented, and the seat
    // gives no client any staff permission.
    const pods = await authGet(PODS, admin.token, organization.id).expect(200);
    expect(pods.body.data[0].members[0].userId).toBe(owner.userId);

    // The client still cannot assign work.
    await authPatch(
      `${API}/service-requests/00000000-0000-4000-8000-000000000000/assign`,
      owner.token,
      { podId: pod.id },
      organization.id,
    ).expect(403);
  });
});
