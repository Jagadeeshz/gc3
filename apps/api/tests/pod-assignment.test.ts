import { describe, expect, it } from 'vitest';
import { API, authGet, authPatch, authPost, createMember, createOrganization, createStaff } from './helpers/api';

const PODS = `${API}/pods`;

async function seedRequest(organizationId: string, token: string, title = 'Routing candidate') {
  const response = await authPost(
    `${API}/service-requests`,
    token,
    {
      title,
      description: 'A request that will be routed to a pod.',
      status: 'SUBMITTED',
      priority: 'NORMAL',
    },
    organizationId,
  ).expect(201);

  return response.body.data as { id: string; podId: string | null };
}

async function createPod(
  organizationId: string,
  token: string,
  body: Record<string, unknown> = {},
) {
  const response = await authPost(
    PODS,
    token,
    { name: 'Cloud Delivery', ...body },
    organizationId,
  ).expect(201);

  return response.body.data as { id: string; name: string; slug: string; memberCount: number };
}

describe('POST /pods — pod structure', () => {
  it('creates a pod with a derived slug and seated members', async () => {
    const organization = await createOrganization();
    const admin = await createStaff('PLATFORM_ADMIN');
    const specialist = await createStaff('SPECIALIST');

    const pod = await createPod(organization.id, admin.token, {
      name: 'Cloud Delivery',
      description: 'Runs migrations and platform work.',
      leadId: specialist.userId,
      memberIds: [specialist.userId],
    });

    expect(pod).toMatchObject({
      name: 'Cloud Delivery',
      slug: 'cloud-delivery',
      organizationId: organization.id,
      isActive: true,
      memberCount: 1,
      openRequests: 0,
    });
  });

  it('refuses a duplicate slug inside the same tenant', async () => {
    const organization = await createOrganization();
    const admin = await createStaff('PLATFORM_ADMIN');
    await createPod(organization.id, admin.token, { name: 'Data Platform' });

    const duplicate = await authPost(
      PODS,
      admin.token,
      { name: 'Data Platform' },
      organization.id,
    ).expect(409);

    expect(duplicate.body.error.code).toBe('CONFLICT');
  });

  it('allows the same pod name in a different tenant', async () => {
    const admin = await createStaff('PLATFORM_ADMIN');
    const first = await createOrganization({ name: 'Pod Tenant One' });
    const second = await createOrganization({ name: 'Pod Tenant Two' });

    await createPod(first.id, admin.token, { name: 'Shared Name' });
    await createPod(second.id, admin.token, { name: 'Shared Name' });
  });

  it('rejects a member id that does not exist', async () => {
    const organization = await createOrganization();
    const admin = await createStaff('PLATFORM_ADMIN');

    const response = await authPost(
      PODS,
      admin.token,
      { name: 'Ghost Pod', memberIds: ['11111111-1111-4111-8111-111111111111'] },
      organization.id,
    ).expect(400);

    expect(response.body.error.message).toMatch(/Unknown user/);
  });

  it('is staff-only: a pod manager cannot create, a client cannot even list', async () => {
    const organization = await createOrganization();
    const podManager = await createStaff('POD_MANAGER');
    const owner = await createMember({ organizationId: organization.id, roles: ['CLIENT_OWNER'] });

    await authPost(PODS, podManager.token, { name: 'Nope Pod' }, organization.id).expect(403);
    await authGet(PODS, owner.token, organization.id).expect(403);
  });

  it('lists only this tenant’s pods', async () => {
    const admin = await createStaff('OPERATIONS_MANAGER');
    const alpha = await createOrganization({ name: 'List Alpha' });
    const beta = await createOrganization({ name: 'List Beta' });

    await createPod(alpha.id, admin.token, { name: 'Alpha Pod' });
    await createPod(beta.id, admin.token, { name: 'Beta Pod' });

    const response = await authGet(PODS, admin.token, alpha.id).expect(200);

    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0].name).toBe('Alpha Pod');
  });
});

describe('PATCH /service-requests/:id/assign — routing', () => {
  it('routes a request into a pod', async () => {
    const organization = await createOrganization();
    const admin = await createStaff('PLATFORM_ADMIN');
    const specialist = await createStaff('SPECIALIST');
    const pod = await createPod(organization.id, admin.token);
    const request = await seedRequest(organization.id, admin.token);

    const assigned = await authPatch(
      `${API}/service-requests/${request.id}/assign`,
      admin.token,
      { podId: pod.id },
      organization.id,
    ).expect(200);

    expect(assigned.body.data.podId).toBe(pod.id);

    const reread = await authGet(
      `${API}/service-requests/${request.id}`,
      admin.token,
      organization.id,
    ).expect(200);
    expect(reread.body.data.podId).toBe(pod.id);

    // Pod load and the request's human owner are independent.
    const withBoth = await authPatch(
      `${API}/service-requests/${request.id}/assign`,
      admin.token,
      { assigneeId: specialist.userId },
      organization.id,
    ).expect(200);
    expect(withBoth.body.data).toMatchObject({ podId: pod.id, assigneeId: specialist.userId });
  });

  it('refuses a pod from another tenant', async () => {
    const admin = await createStaff('PLATFORM_ADMIN');
    const alpha = await createOrganization({ name: 'Foreign Alpha' });
    const beta = await createOrganization({ name: 'Foreign Beta' });
    const betaPod = await createPod(beta.id, admin.token, { name: 'Beta Only Pod' });
    const request = await seedRequest(alpha.id, admin.token);

    const response = await authPatch(
      `${API}/service-requests/${request.id}/assign`,
      admin.token,
      { podId: betaPod.id },
      alpha.id,
    ).expect(404);

    expect(response.body.error.message).toMatch(/Pod not found/);

    const reread = await authGet(
      `${API}/service-requests/${request.id}`,
      admin.token,
      alpha.id,
    ).expect(200);
    expect(reread.body.data.podId).toBeNull();
  });

  it('refuses an unknown assignee', async () => {
    const organization = await createOrganization();
    const admin = await createStaff('PLATFORM_ADMIN');
    const request = await seedRequest(organization.id, admin.token);

    const response = await authPatch(
      `${API}/service-requests/${request.id}/assign`,
      admin.token,
      { assigneeId: '99999999-9999-4999-8999-999999999999' },
      organization.id,
    ).expect(404);

    expect(response.body.error.message).toMatch(/Assignee not found/);
  });

  it('clears an assignment with an explicit null', async () => {
    const organization = await createOrganization();
    const admin = await createStaff('PLATFORM_ADMIN');
    const pod = await createPod(organization.id, admin.token);
    const request = await seedRequest(organization.id, admin.token);

    await authPatch(
      `${API}/service-requests/${request.id}/assign`,
      admin.token,
      { podId: pod.id },
      organization.id,
    ).expect(200);

    const cleared = await authPatch(
      `${API}/service-requests/${request.id}/assign`,
      admin.token,
      { podId: null },
      organization.id,
    ).expect(200);

    expect(cleared.body.data.podId).toBeNull();
  });

  it('rejects an empty payload and a bad pod id', async () => {
    const organization = await createOrganization();
    const admin = await createStaff('PLATFORM_ADMIN');
    const request = await seedRequest(organization.id, admin.token);

    const empty = await authPatch(
      `${API}/service-requests/${request.id}/assign`,
      admin.token,
      {},
      organization.id,
    ).expect(400);
    expect(empty.body.error.code).toBe('VALIDATION_ERROR');

    await authPatch(
      `${API}/service-requests/${request.id}/assign`,
      admin.token,
      { podId: 'not-a-uuid' },
      organization.id,
    ).expect(400);
  });

  it('is closed to clients and to staff without request:assign', async () => {
    const organization = await createOrganization();
    const admin = await createStaff('PLATFORM_ADMIN');
    const owner = await createMember({ organizationId: organization.id, roles: ['CLIENT_OWNER'] });
    const specialist = await createStaff('SPECIALIST');
    const pod = await createPod(organization.id, admin.token);
    const request = await seedRequest(organization.id, admin.token);

    await authPatch(
      `${API}/service-requests/${request.id}/assign`,
      owner.token,
      { podId: pod.id },
      organization.id,
    ).expect(403);

    await authPatch(
      `${API}/service-requests/${request.id}/assign`,
      specialist.token,
      { podId: pod.id },
      organization.id,
    ).expect(403);
  });

  it('lets a pod manager route work and shows the load in the pod list', async () => {
    const organization = await createOrganization();
    const admin = await createStaff('PLATFORM_ADMIN');
    const podManager = await createStaff('POD_MANAGER');
    const pod = await createPod(organization.id, admin.token);
    const first = await seedRequest(organization.id, admin.token, 'Route me one');
    const second = await seedRequest(organization.id, admin.token, 'Route me two');

    for (const request of [first, second]) {
      await authPatch(
        `${API}/service-requests/${request.id}/assign`,
        podManager.token,
        { podId: pod.id },
        organization.id,
      ).expect(200);
    }

    const pods = await authGet(PODS, podManager.token, organization.id).expect(200);
    expect(pods.body.data[0]).toMatchObject({ id: pod.id, openRequests: 2 });
  });

  it('moves the request out of the operations queue once routed', async () => {
    const organization = await createOrganization({ name: 'Routing Tenant' });
    const admin = await createStaff('OPERATIONS_MANAGER');
    const pod = await createPod(organization.id, admin.token);
    const request = await seedRequest(organization.id, admin.token);

    const before = await authGet(
      `${API}/ops/dashboard?organizationId=${organization.id}`,
      admin.token,
    ).expect(200);
    expect(before.body.data.organizations[0].unassignedRequests).toBe(1);
    expect(before.body.data.totals.unassignedRequests).toBe(1);

    await authPatch(
      `${API}/service-requests/${request.id}/assign`,
      admin.token,
      { podId: pod.id, assigneeId: admin.userId },
      organization.id,
    ).expect(200);

    const after = await authGet(
      `${API}/ops/dashboard?organizationId=${organization.id}`,
      admin.token,
    ).expect(200);

    expect(after.body.data.organizations[0].unassignedRequests).toBe(0);
    expect(after.body.data.organizations[0].podCount).toBe(1);
    expect(after.body.data.pods[0]).toMatchObject({
      id: pod.id,
      organizationName: 'Routing Tenant',
      openRequests: 1,
    });
  });
});
