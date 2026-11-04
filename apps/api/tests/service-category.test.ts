import { describe, expect, it } from 'vitest';
import {
  API,
  app,
  authDelete,
  authGet,
  authPatch,
  authPost,
  createMember,
  createOrganization,
  createStaff,
} from './helpers/api';
import request from 'supertest';

let seq = 0;
function uniq(prefix: string): string {
  seq += 1;
  return `${prefix}-${seq}`;
}

async function seedCategory(organizationId: string, staffToken: string, name: string) {
  const response = await authPost(
    `${API}/service-categories`,
    staffToken,
    { name },
    organizationId,
  ).expect(201);

  return response.body.data as { id: string; name: string; slug: string; isActive: boolean };
}

describe('service categories', () => {
  it('creates a category and derives the slug from the name', async () => {
    const organization = await createOrganization();
    const staff = await createStaff('PLATFORM_ADMIN');

    const response = await authPost(
      `${API}/service-categories`,
      staff.token,
      { name: 'Cloud Migration & Ops', description: 'Lift-and-shift and re-platform work' },
      organization.id,
    ).expect(201);

    expect(response.body.data).toMatchObject({
      name: 'Cloud Migration & Ops',
      slug: 'cloud-migration-ops',
      isActive: true,
      organizationId: organization.id,
    });
    expect(response.body.data.deletedAt).toBeNull();
  });

  it('accepts a missing description as null or omitted', async () => {
    const organization = await createOrganization();
    const staff = await createStaff('PLATFORM_ADMIN');

    const explicitNull = await authPost(
      `${API}/service-categories`,
      staff.token,
      { name: 'Null Description', description: null },
      organization.id,
    ).expect(201);

    expect(explicitNull.body.data.description).toBeNull();

    const omitted = await authPost(
      `${API}/service-categories`,
      staff.token,
      { name: 'Omitted Description' },
      organization.id,
    ).expect(201);

    expect(omitted.body.data.description).toBeNull();
  });

  it('accepts an explicit slug', async () => {
    const organization = await createOrganization();
    const staff = await createStaff('PLATFORM_ADMIN');

    const response = await authPost(
      `${API}/service-categories`,
      staff.token,
      { name: 'Data Platform', slug: 'data-platform-v2' },
      organization.id,
    ).expect(201);

    expect(response.body.data.slug).toBe('data-platform-v2');
  });

  it('rejects a duplicate slug within the tenant with 409', async () => {
    const organization = await createOrganization();
    const staff = await createStaff('PLATFORM_ADMIN');

    await seedCategory(organization.id, staff.token, 'FinOps');

    const duplicate = await authPost(
      `${API}/service-categories`,
      staff.token,
      { name: 'FinOps', slug: 'finops' },
      organization.id,
    ).expect(409);

    expect(duplicate.body.error.code).toBe('CONFLICT');
  });

  it('rejects an invalid payload with 400', async () => {
    const organization = await createOrganization();
    const staff = await createStaff('PLATFORM_ADMIN');

    const response = await authPost(
      `${API}/service-categories`,
      staff.token,
      { name: 'X' },
      organization.id,
    ).expect(400);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('lists active categories only, unless inactive ones are requested', async () => {
    const organization = await createOrganization();
    const staff = await createStaff('PLATFORM_ADMIN');

    const keeper = await seedCategory(organization.id, staff.token, 'Keep Me');
    const retired = await seedCategory(organization.id, staff.token, 'Retire Me');

    await authPatch(
      `${API}/service-categories/${retired.id}`,
      staff.token,
      { isActive: false },
      organization.id,
    ).expect(200);

    const activeOnly = await authGet(
      `${API}/service-categories`,
      staff.token,
      organization.id,
    ).expect(200);

    const ids = (activeOnly.body.data as { id: string }[]).map((category) => category.id);
    expect(ids).toContain(keeper.id);
    expect(ids).not.toContain(retired.id);

    const withInactive = await authGet(
      `${API}/service-categories?includeInactive=true`,
      staff.token,
      organization.id,
    ).expect(200);

    expect((withInactive.body.data as { id: string }[]).map((c) => c.id)).toContain(retired.id);
  });

  it('renames and re-describes a category', async () => {
    const organization = await createOrganization();
    const staff = await createStaff('PLATFORM_ADMIN');
    const category = await seedCategory(organization.id, staff.token, 'Old Name');

    const response = await authPatch(
      `${API}/service-categories/${category.id}`,
      staff.token,
      { name: 'New Name', description: 'Now with a description' },
      organization.id,
    ).expect(200);

    expect(response.body.data).toMatchObject({
      id: category.id,
      name: 'New Name',
      description: 'Now with a description',
      slug: 'old-name',
    });
  });

  it('refuses to re-slug onto an existing slug', async () => {
    const organization = await createOrganization();
    const staff = await createStaff('PLATFORM_ADMIN');

    await seedCategory(organization.id, staff.token, 'Alpha');
    const beta = await seedCategory(organization.id, staff.token, 'Beta');

    const response = await authPatch(
      `${API}/service-categories/${beta.id}`,
      staff.token,
      { slug: 'alpha' },
      organization.id,
    ).expect(409);

    expect(response.body.error.code).toBe('CONFLICT');
  });

  it('rejects an empty update body', async () => {
    const organization = await createOrganization();
    const staff = await createStaff('PLATFORM_ADMIN');
    const category = await seedCategory(organization.id, staff.token, 'No-Op');

    await authPatch(
      `${API}/service-categories/${category.id}`,
      staff.token,
      {},
      organization.id,
    ).expect(400);
  });

  it('soft-deletes a category and then reports it as gone', async () => {
    const organization = await createOrganization();
    const staff = await createStaff('PLATFORM_ADMIN');
    const category = await seedCategory(organization.id, staff.token, 'Temporary');

    await authDelete(
      `${API}/service-categories/${category.id}`,
      staff.token,
      organization.id,
    ).expect(204);

    const list = await authGet(`${API}/service-categories`, staff.token, organization.id).expect(200);
    expect((list.body.data as { id: string }[]).map((c) => c.id)).not.toContain(category.id);

    await authPatch(
      `${API}/service-categories/${category.id}`,
      staff.token,
      { name: 'Resurrected' },
      organization.id,
    ).expect(404);

    await authDelete(
      `${API}/service-categories/${category.id}`,
      staff.token,
      organization.id,
    ).expect(404);
  });

  it('keeps categories inside their tenant', async () => {
    const mine = await createOrganization();
    const theirs = await createOrganization();
    const staff = await createStaff('PLATFORM_ADMIN');

    const category = await seedCategory(mine.id, staff.token, 'Mine Only');

    const foreignList = await authGet(
      `${API}/service-categories`,
      staff.token,
      theirs.id,
    ).expect(200);
    expect(foreignList.body.data).toEqual([]);

    await authPatch(
      `${API}/service-categories/${category.id}`,
      staff.token,
      { name: 'Hijacked' },
      theirs.id,
    ).expect(404);

    await authDelete(`${API}/service-categories/${category.id}`, staff.token, theirs.id).expect(404);
  });

  it('lets a client read the catalogue but not change it', async () => {
    const organization = await createOrganization();
    const staff = await createStaff('PLATFORM_ADMIN');
    const category = await seedCategory(organization.id, staff.token, 'Visible To Clients');

    const owner = await createMember({
      organizationId: organization.id,
      roles: ['CLIENT_OWNER'],
    });

    const list = await authGet(`${API}/service-categories`, owner.token, organization.id).expect(200);
    expect((list.body.data as { id: string }[]).map((c) => c.id)).toEqual([category.id]);

    await authPost(
      `${API}/service-categories`,
      owner.token,
      { name: 'Client Made This' },
      organization.id,
    ).expect(403);

    await authPatch(
      `${API}/service-categories/${category.id}`,
      owner.token,
      { name: 'Client Renamed' },
      organization.id,
    ).expect(403);

    await authDelete(
      `${API}/service-categories/${category.id}`,
      owner.token,
      organization.id,
    ).expect(403);
  });

  it('requires authentication and a tenant scope', async () => {
    const staff = await createStaff('PLATFORM_ADMIN');

    await request(app).get(`${API}/service-categories`).expect(401);
    await authGet(`${API}/service-categories`, staff.token).expect(400);
  });
});
