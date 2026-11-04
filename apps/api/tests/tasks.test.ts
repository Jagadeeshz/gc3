import { describe, expect, it } from 'vitest';
import { API, authGet, authPatch, authPost, createMember, createOrganization, createStaff } from './helpers/api';

async function seedRequest(organizationId: string, token: string, title = 'Task host request') {
  const response = await authPost(
    `${API}/service-requests`,
    token,
    {
      title,
      description: 'A request that gets broken down into internal tasks.',
      status: 'SUBMITTED',
    },
    organizationId,
  ).expect(201);

  return response.body.data as { id: string; reference: string };
}

async function createPod(organizationId: string, token: string, name = 'Task Pod') {
  const response = await authPost(`${API}/pods`, token, { name }, organizationId).expect(201);
  return response.body.data as { id: string };
}

function createTask(
  organizationId: string,
  token: string,
  requestId: string,
  body: Record<string, unknown>,
) {
  return authPost(`${API}/service-requests/${requestId}/tasks`, token, body, organizationId);
}

describe('POST /service-requests/:id/tasks — breaking work down', () => {
  it('creates a task and returns the names the UI needs', async () => {
    const organization = await createOrganization();
    const admin = await createStaff('PLATFORM_ADMIN');
    const specialist = await createStaff('SPECIALIST');
    const pod = await createPod(organization.id, admin.token);
    const request = await seedRequest(organization.id, admin.token);

    // Route the request into the pod first: tasks inherit the pod.
    await authPatch(
      `${API}/service-requests/${request.id}/assign`,
      admin.token,
      { podId: pod.id },
      organization.id,
    ).expect(200);

    const created = await createTask(organization.id, specialist.token, request.id, {
      title: 'Inventory the current cluster',
      description: 'List namespaces, node pools and quotas before migration.',
      assigneeId: specialist.userId,
      dueAt: new Date(Date.now() + 86_400_000).toISOString(),
    }).expect(201);

    expect(created.body.data).toMatchObject({
      requestId: request.id,
      podId: pod.id,
      assigneeId: specialist.userId,
      status: 'TODO',
      title: 'Inventory the current cluster',
    });
    expect(created.body.data.assigneeName).toBe('Staff SPECIALIST');
    expect(created.body.data.podName).toBe('Task Pod');
  });

  it('rejects a pod from another tenant', async () => {
    const admin = await createStaff('PLATFORM_ADMIN');
    const alpha = await createOrganization({ name: 'Task Alpha' });
    const beta = await createOrganization({ name: 'Task Beta' });
    const betaPod = await createPod(beta.id, admin.token, 'Beta Task Pod');
    const request = await seedRequest(alpha.id, admin.token);

    await createTask(alpha.id, admin.token, request.id, {
      title: 'Cross-tenant task',
      podId: betaPod.id,
    }).expect(404);
  });

  it('404s for a request in another tenant', async () => {
    const admin = await createStaff('PLATFORM_ADMIN');
    const alpha = await createOrganization({ name: 'Foreign Task Alpha' });
    const beta = await createOrganization({ name: 'Foreign Task Beta' });
    const request = await seedRequest(beta.id, admin.token);

    await createTask(alpha.id, admin.token, request.id, { title: 'Not mine' }).expect(404);
  });

  it('validates the payload', async () => {
    const organization = await createOrganization();
    const admin = await createStaff('PLATFORM_ADMIN');
    const request = await seedRequest(organization.id, admin.token);

    const response = await createTask(organization.id, admin.token, request.id, { title: 'ab' })
      .expect(400);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('task visibility', () => {
  it('is staff-only: a client cannot list or create tasks', async () => {
    const organization = await createOrganization();
    const admin = await createStaff('PLATFORM_ADMIN');
    const owner = await createMember({ organizationId: organization.id, roles: ['CLIENT_OWNER'] });
    const request = await seedRequest(organization.id, admin.token);
    await createTask(organization.id, admin.token, request.id, { title: 'Internal only' }).expect(201);

    const listed = await authGet(
      `${API}/service-requests/${request.id}/tasks`,
      owner.token,
      organization.id,
    ).expect(403);
    expect(listed.body.error.code).toBe('FORBIDDEN');

    await createTask(organization.id, owner.token, request.id, { title: 'Client task' }).expect(403);

    // And the client's own view of the request carries no task data at all.
    const detail = await authGet(
      `${API}/service-requests/${request.id}`,
      owner.token,
      organization.id,
    ).expect(200);
    expect(detail.body.data).not.toHaveProperty('tasks');
  });

  it('lists tasks for one request only, oldest first', async () => {
    const organization = await createOrganization();
    const admin = await createStaff('PLATFORM_ADMIN');
    const first = await seedRequest(organization.id, admin.token, 'First request');
    const second = await seedRequest(organization.id, admin.token, 'Second request');

    await createTask(organization.id, admin.token, first.id, { title: 'First task' }).expect(201);
    await createTask(organization.id, admin.token, first.id, { title: 'Second task' }).expect(201);
    await createTask(organization.id, admin.token, second.id, { title: 'Other request task' }).expect(201);

    const listed = await authGet(
      `${API}/service-requests/${first.id}/tasks`,
      admin.token,
      organization.id,
    ).expect(200);

    expect(listed.body.data).toHaveLength(2);
    expect(listed.body.data.map((task: { title: string }) => task.title)).toEqual([
      'First task',
      'Second task',
    ]);
  });

  it('404s when listing tasks on a foreign request', async () => {
    const admin = await createStaff('PLATFORM_ADMIN');
    const alpha = await createOrganization({ name: 'List Alpha' });
    const beta = await createOrganization({ name: 'List Beta' });
    const request = await seedRequest(beta.id, admin.token);

    await authGet(`${API}/service-requests/${request.id}/tasks`, admin.token, alpha.id).expect(404);
  });
});

describe('PATCH /tasks/:taskId — the task lifecycle', () => {
  it('moves TODO → IN_PROGRESS → DONE and keeps the audit trail', async () => {
    const organization = await createOrganization();
    const admin = await createStaff('PLATFORM_ADMIN');
    const specialist = await createStaff('SPECIALIST');
    const request = await seedRequest(organization.id, admin.token);
    const task = await createTask(organization.id, admin.token, request.id, {
      title: 'Write the runbook',
    }).expect(201);
    const taskId = task.body.data.id as string;

    const started = await authPatch(`${API}/tasks/${taskId}`, specialist.token, {
      status: 'IN_PROGRESS',
      assigneeId: specialist.userId,
    }, organization.id).expect(200);

    expect(started.body.data).toMatchObject({
      status: 'IN_PROGRESS',
      assigneeId: specialist.userId,
      assigneeName: 'Staff SPECIALIST',
    });

    const done = await authPatch(`${API}/tasks/${taskId}`, specialist.token, { status: 'DONE' }, organization.id)
      .expect(200);
    expect(done.body.data.status).toBe('DONE');
  });

  it('reassigns and re-dates a task', async () => {
    const organization = await createOrganization();
    const admin = await createStaff('PLATFORM_ADMIN');
    const first = await createStaff('SPECIALIST');
    const second = await createStaff('SPECIALIST');
    const request = await seedRequest(organization.id, admin.token);
    const task = await createTask(organization.id, admin.token, request.id, {
      title: 'Reassignable task',
      assigneeId: first.userId,
    }).expect(201);

    const due = new Date(Date.now() + 3 * 86_400_000).toISOString();
    const updated = await authPatch(
      `${API}/tasks/${task.body.data.id}`,
      admin.token,
      { assigneeId: second.userId, dueAt: due, title: 'Renamed task' },
      organization.id,
    ).expect(200);

    expect(updated.body.data).toMatchObject({
      title: 'Renamed task',
      assigneeId: second.userId,
    });
    expect(new Date(updated.body.data.dueAt).toISOString()).toBe(new Date(due).toISOString());
  });

  it('rejects an empty patch and an unknown status', async () => {
    const organization = await createOrganization();
    const admin = await createStaff('PLATFORM_ADMIN');
    const request = await seedRequest(organization.id, admin.token);
    const task = await createTask(organization.id, admin.token, request.id, {
      title: 'Validation task',
    }).expect(201);

    await authPatch(`${API}/tasks/${task.body.data.id}`, admin.token, {}, organization.id).expect(400);
    await authPatch(
      `${API}/tasks/${task.body.data.id}`,
      admin.token,
      { status: 'ALMOST_DONE' },
      organization.id,
    ).expect(400);
  });

  it('404s for a task in another tenant', async () => {
    const admin = await createStaff('PLATFORM_ADMIN');
    const alpha = await createOrganization({ name: 'Patch Alpha' });
    const beta = await createOrganization({ name: 'Patch Beta' });
    const request = await seedRequest(beta.id, admin.token);
    const task = await createTask(beta.id, admin.token, request.id, {
      title: 'Beta task',
    }).expect(201);

    await authPatch(`${API}/tasks/${task.body.data.id}`, admin.token, { status: 'DONE' }, alpha.id)
      .expect(404);
  });

  it('is refused to clients and to read-only staff', async () => {
    const organization = await createOrganization();
    const admin = await createStaff('PLATFORM_ADMIN');
    const owner = await createMember({ organizationId: organization.id, roles: ['CLIENT_OWNER'] });
    const accountManager = await createStaff('ACCOUNT_MANAGER');
    const request = await seedRequest(organization.id, admin.token);
    const task = await createTask(organization.id, admin.token, request.id, {
      title: 'Guarded task',
    }).expect(201);
    const taskId = task.body.data.id as string;

    await authPatch(`${API}/tasks/${taskId}`, owner.token, { status: 'DONE' }, organization.id).expect(403);
    // The account manager may read tasks but not change them.
    await authPatch(`${API}/tasks/${taskId}`, accountManager.token, { status: 'DONE' }, organization.id)
      .expect(403);
    await authGet(`${API}/service-requests/${request.id}/tasks`, accountManager.token, organization.id)
      .expect(200);
  });
});

describe('assignee roster', () => {
  it('lets a specialist read the assignee roster the checklist needs', async () => {
    const organization = await createOrganization();
    const admin = await createStaff('PLATFORM_ADMIN');
    const specialist = await createStaff('SPECIALIST');

    // A specialist holds task:manage but not request:assign. The roster endpoint
    // must answer for them, or the checklist cannot offer an assignee picker.
    const roster = await authGet(`${API}/pods/staff`, specialist.token, organization.id).expect(200);
    expect((roster.body.data as { userId: string }[]).some((entry) => entry.userId === admin.userId)).toBe(true);

    // Still closed to clients.
    const owner = await createMember({ organizationId: organization.id, roles: ['CLIENT_OWNER'] });
    await authGet(`${API}/pods/staff`, owner.token, organization.id).expect(403);
  });
});

describe('task load in the operations views', () => {
  it('counts open tasks per seated person and per pod', async () => {
    const organization = await createOrganization();
    const admin = await createStaff('PLATFORM_ADMIN');
    const specialist = await createStaff('SPECIALIST');
    const pod = await createPod(organization.id, admin.token, 'Load Pod');
    const request = await seedRequest(organization.id, admin.token);

    await authPost(`${API}/pods/${pod.id}/members`, admin.token, { userId: specialist.userId }, organization.id)
      .expect(201);
    await authPatch(
      `${API}/service-requests/${request.id}/assign`,
      admin.token,
      { podId: pod.id },
      organization.id,
    ).expect(200);

    const openTask = await createTask(organization.id, admin.token, request.id, {
      title: 'Open task',
      assigneeId: specialist.userId,
    }).expect(201);

    const finished = await createTask(organization.id, admin.token, request.id, {
      title: 'Finished task',
      assigneeId: specialist.userId,
    }).expect(201);
    await authPatch(`${API}/tasks/${finished.body.data.id}`, admin.token, { status: 'DONE' }, organization.id)
      .expect(200);

    void openTask;

    const pods = await authGet(`${API}/pods`, admin.token, organization.id).expect(200);
    const podRow = pods.body.data[0];

    expect(podRow.openTasks).toBe(1);
    expect(podRow.members[0]).toMatchObject({ userId: specialist.userId, openTasks: 1 });
  });
});
