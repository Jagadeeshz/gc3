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

interface RequestFixture {
  id: string;
  reference: string;
  title: string;
  categoryId: string | null;
}

async function seedRequest(
  organizationId: string,
  token: string,
  overrides: Partial<{ title: string; categoryId: string }> = {},
): Promise<RequestFixture> {
  const response = await authPost(
    `${API}/service-requests`,
    token,
    {
      title: overrides.title ?? 'Original title for editing',
      description: 'A description long enough to satisfy the contract.',
      priority: 'NORMAL',
      status: 'SUBMITTED',
      ...(overrides.categoryId ? { categoryId: overrides.categoryId } : {}),
    },
    organizationId,
  ).expect(201);

  return response.body.data as RequestFixture;
}

async function seedCategory(organizationId: string, staffToken: string, name: string) {
  const response = await authPost(
    `${API}/service-categories`,
    staffToken,
    { name },
    organizationId,
  ).expect(201);

  return response.body.data as { id: string; slug: string };
}

describe('PATCH /api/v1/service-requests/:requestId', () => {
  it('updates fields as the client owner and persists them', async () => {
    const organization = await createOrganization();
    const owner = await createMember({
      organizationId: organization.id,
      roles: ['CLIENT_OWNER'],
    });
    const created = await seedRequest(organization.id, owner.token);

    const updated = await authPatch(
      `${API}/service-requests/${created.id}`,
      owner.token,
      { title: 'Revised scope after kickoff', priority: 'URGENT' },
      organization.id,
    ).expect(200);

    expect(updated.body.data).toMatchObject({
      id: created.id,
      title: 'Revised scope after kickoff',
      priority: 'URGENT',
    });

    const reread = await authGet(
      `${API}/service-requests/${created.id}`,
      owner.token,
      organization.id,
    ).expect(200);

    expect(reread.body.data.title).toBe('Revised scope after kickoff');
    expect(reread.body.data.priority).toBe('URGENT');
  });

  it('attaches and clears a category', async () => {
    const organization = await createOrganization();
    const staff = await createStaff('PLATFORM_ADMIN');
    const owner = await createMember({
      organizationId: organization.id,
      roles: ['CLIENT_OWNER'],
    });
    const category = await seedCategory(organization.id, staff.token, 'Platform Engineering');
    const created = await seedRequest(organization.id, owner.token);

    const attached = await authPatch(
      `${API}/service-requests/${created.id}`,
      owner.token,
      { categoryId: category.id },
      organization.id,
    ).expect(200);

    expect(attached.body.data.categoryId).toBe(category.id);

    const cleared = await authPatch(
      `${API}/service-requests/${created.id}`,
      owner.token,
      { categoryId: null },
      organization.id,
    ).expect(200);

    expect(cleared.body.data.categoryId).toBeNull();
  });

  it('refuses a category that belongs to another tenant', async () => {
    const mine = await createOrganization();
    const theirs = await createOrganization();
    const staff = await createStaff('PLATFORM_ADMIN');
    const owner = await createMember({ organizationId: mine.id, roles: ['CLIENT_OWNER'] });

    const foreignCategory = await seedCategory(theirs.id, staff.token, 'Their Catalogue');
    const created = await seedRequest(mine.id, owner.token);

    await authPatch(
      `${API}/service-requests/${created.id}`,
      owner.token,
      { categoryId: foreignCategory.id },
      mine.id,
    ).expect(404);
  });

  it('rejects an empty body with 400', async () => {
    const organization = await createOrganization();
    const owner = await createMember({
      organizationId: organization.id,
      roles: ['CLIENT_OWNER'],
    });
    const created = await seedRequest(organization.id, owner.token);

    const response = await authPatch(
      `${API}/service-requests/${created.id}`,
      owner.token,
      {},
      organization.id,
    ).expect(400);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 404 for a request in another tenant', async () => {
    const mine = await createOrganization();
    const theirs = await createOrganization();
    const owner = await createMember({ organizationId: mine.id, roles: ['CLIENT_OWNER'] });
    const foreignOwner = await createMember({
      organizationId: theirs.id,
      roles: ['CLIENT_OWNER'],
    });

    const theirRequest = await seedRequest(theirs.id, foreignOwner.token);

    await authPatch(
      `${API}/service-requests/${theirRequest.id}`,
      owner.token,
      { title: 'Cross-tenant edit attempt' },
      mine.id,
    ).expect(404);
  });

  it('refuses a client member without request:update', async () => {
    const organization = await createOrganization();
    const teamMember = await createMember({
      organizationId: organization.id,
      roles: ['CLIENT_TEAM_MEMBER'],
    });
    const created = await seedRequest(organization.id, teamMember.token);

    const response = await authPatch(
      `${API}/service-requests/${created.id}`,
      teamMember.token,
      { title: 'Team member edit attempt' },
      organization.id,
    ).expect(403);

    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('refuses to edit a closed request', async () => {
    const organization = await createOrganization();
    const owner = await createMember({
      organizationId: organization.id,
      roles: ['CLIENT_OWNER'],
    });
    const created = await seedRequest(organization.id, owner.token);

    await prisma.serviceRequest.update({
      where: { id: created.id },
      data: { status: 'CLOSED', closedAt: new Date() },
    });

    const response = await authPatch(
      `${API}/service-requests/${created.id}`,
      owner.token,
      { title: 'Editing history' },
      organization.id,
    ).expect(409);

    expect(response.body.error.code).toBe('CONFLICT');
    expect(response.body.error.message).toMatch(/closed/i);
  });
});
