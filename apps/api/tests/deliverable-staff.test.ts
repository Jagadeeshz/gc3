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

async function seedRequest(organizationId: string, token: string, title = 'Deliverable host request') {
  const response = await authPost(
    `${API}/service-requests`,
    token,
    {
      title,
      description: 'A request that will carry deliverables.',
      priority: 'NORMAL',
      status: 'SUBMITTED',
    },
    organizationId,
  ).expect(201);

  return response.body.data as { id: string; reference: string };
}

describe('staff deliverable creation', () => {
  it('creates a deliverable stamped with the producing staff member', async () => {
    const organization = await createOrganization();
    const staff = await createStaff('POD_MANAGER');
    const actor = await createStaff('PLATFORM_ADMIN');
    const request = await seedRequest(organization.id, staff.token);

    const response = await authPost(
      `${API}/service-requests/${request.id}/deliverables`,
      actor.token,
      {
        title: 'Migration runbook',
        description: 'Cutover steps and rollback plan.',
        fileUrl: 'https://files.example.com/runbook-v3.pdf',
      },
      organization.id,
    ).expect(201);

    expect(response.body.data).toMatchObject({
      title: 'Migration runbook',
      description: 'Cutover steps and rollback plan.',
      fileUrl: 'https://files.example.com/runbook-v3.pdf',
      status: 'PENDING',
      requestId: request.id,
      organizationId: organization.id,
      createdById: actor.userId,
      approvedById: null,
      approvedAt: null,
      releasedAt: null,
    });
  });

  it('creates a deliverable without a file reference', async () => {
    const organization = await createOrganization();
    const admin = await createStaff('PLATFORM_ADMIN');
    const specialist = await createStaff('SPECIALIST');
    const request = await seedRequest(organization.id, admin.token);

    const response = await authPost(
      `${API}/service-requests/${request.id}/deliverables`,
      specialist.token,
      { title: 'Advisory session notes' },
      organization.id,
    ).expect(201);

    expect(response.body.data.fileUrl).toBeNull();
    expect(response.body.data.createdById).toBe(specialist.userId);
  });

  it('shows the deliverable in the request deliverable list', async () => {
    const organization = await createOrganization();
    const staff = await createStaff('PLATFORM_ADMIN');
    const request = await seedRequest(organization.id, staff.token);

    await authPost(
      `${API}/service-requests/${request.id}/deliverables`,
      staff.token,
      { title: 'Architecture decision record' },
      organization.id,
    ).expect(201);

    const list = await authGet(
      `${API}/service-requests/${request.id}/deliverables`,
      staff.token,
      organization.id,
    ).expect(200);

    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0].title).toBe('Architecture decision record');
  });

  it('refuses a client actor, who holds no deliverable:create', async () => {
    const organization = await createOrganization();
    const staff = await createStaff('PLATFORM_ADMIN');
    const request = await seedRequest(organization.id, staff.token);

    for (const role of ['CLIENT_OWNER', 'CLIENT_APPROVER', 'CLIENT_TEAM_MEMBER'] as const) {
      const member = await createMember({ organizationId: organization.id, roles: [role] });

      const response = await authPost(
        `${API}/service-requests/${request.id}/deliverables`,
        member.token,
        { title: `Made by ${role}` },
        organization.id,
      ).expect(403);

      expect(response.body.error.code).toBe('FORBIDDEN');
    }
  });

  it('rejects a malformed file reference', async () => {
    const organization = await createOrganization();
    const staff = await createStaff('PLATFORM_ADMIN');
    const request = await seedRequest(organization.id, staff.token);

    const response = await authPost(
      `${API}/service-requests/${request.id}/deliverables`,
      staff.token,
      { title: 'Bad link', fileUrl: 'not-a-url' },
      organization.id,
    ).expect(400);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 404 when the request belongs to another tenant', async () => {
    const mine = await createOrganization();
    const theirs = await createOrganization();
    const staff = await createStaff('PLATFORM_ADMIN');

    const theirRequest = await seedRequest(theirs.id, staff.token, 'Their request');

    await authPost(
      `${API}/service-requests/${theirRequest.id}/deliverables`,
      staff.token,
      { title: 'Cross-tenant delivery' },
      mine.id,
    ).expect(404);
  });

  it('keeps the author when the deliverable is approved and released', async () => {
    const organization = await createOrganization();
    const admin = await createStaff('PLATFORM_ADMIN');
    const producer = await createStaff('SPECIALIST');
    const approver = await createMember({
      organizationId: organization.id,
      roles: ['CLIENT_OWNER'],
    });
    // SPECIALIST produces the work but cannot raise requests, so an admin seeds it.
    const request = await seedRequest(organization.id, admin.token);

    const created = await authPost(
      `${API}/service-requests/${request.id}/deliverables`,
      producer.token,
      { title: 'Handover pack' },
      organization.id,
    ).expect(201);

    const deliverableId = created.body.data.id as string;

    await authPatch(
      `${API}/service-requests/${request.id}/deliverables/${deliverableId}/status`,
      approver.token,
      { status: 'APPROVED' },
      organization.id,
    ).expect(200);

    const released = await authPatch(
      `${API}/service-requests/${request.id}/deliverables/${deliverableId}/status`,
      approver.token,
      { status: 'RELEASED' },
      organization.id,
    ).expect(200);

    expect(released.body.data.createdById).toBe(producer.userId);
    expect(released.body.data.approvedById).toBe(approver.userId);
  });
});
