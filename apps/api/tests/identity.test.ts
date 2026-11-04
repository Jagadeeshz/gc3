import { describe, expect, it } from 'vitest';
import request from 'supertest';
import {
  API,
  app,
  authGet,
  authPost,
  createMember,
  createOrganization,
  createStaff,
} from './helpers/api';
import { prisma } from '../src/db/client';
import { organizationRepository } from '../src/repositories/organization.repository';

/**
 * Identity slice: persistence, validation, and the multi-tenant isolation rule
 * that the whole platform depends on (Development Brief §12).
 *
 * Fixtures act as a PLATFORM_ADMIN so the tests below isolate the *tenant*
 * boundary rather than the auth boundary; auth/RBAC has its own suites.
 */
describe('organizations — persistence and validation', () => {
  it('creates a tenant and persists it', async () => {
    const admin = await createStaff('PLATFORM_ADMIN');

    const response = await authPost(`${API}/organizations`, admin.token, {
      name: 'Northwind Cloud',
      slug: 'northwind-cloud',
    }).expect(201);

    expect(response.body.data).toMatchObject({
      name: 'Northwind Cloud',
      slug: 'northwind-cloud',
      status: 'PROSPECT',
      timezone: 'Asia/Kolkata',
      region: 'global',
    });

    const persisted = await prisma.organization.findUnique({ where: { slug: 'northwind-cloud' } });
    expect(persisted?.id).toBe(response.body.data.id);
  });

  it('rejects a malformed payload with field-level detail', async () => {
    const admin = await createStaff('PLATFORM_ADMIN');

    const response = await authPost(`${API}/organizations`, admin.token, {
      name: 'X',
      slug: 'Not A Slug',
    }).expect(400);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'name' }),
        expect.objectContaining({ path: 'slug' }),
      ]),
    );
  });

  it('rejects a duplicate slug with 409', async () => {
    const admin = await createStaff('PLATFORM_ADMIN');
    const payload = { name: 'Duplicate Co', slug: 'duplicate-co' };

    await authPost(`${API}/organizations`, admin.token, payload).expect(201);
    const response = await authPost(`${API}/organizations`, admin.token, payload).expect(409);

    expect(response.body.error.code).toBe('CONFLICT');
  });

  it('returns 404 for a well-formed id that does not exist in scope', async () => {
    const admin = await createStaff('PLATFORM_ADMIN');
    const ghost = '99999999-8888-4777-8666-555555555555';

    // Ghost id equals the scope, so it passes the tenant gate and misses in the DB.
    const response = await authGet(`/api/v1/organizations/${ghost}`, admin.token, ghost).expect(404);

    expect(response.body.error.code).toBe('NOT_FOUND');
    expect(response.body.data).toBeUndefined();
  });

  it('records an audit event attributed to the creating actor', async () => {
    const admin = await createStaff('PLATFORM_ADMIN');
    const created = await authPost(`${API}/organizations`, admin.token, {
      name: 'Audited Co',
      slug: 'audited-co',
    }).expect(201);

    const events = await prisma.auditEvent.findMany({
      where: { organizationId: created.body.data.id, action: 'organization.created' },
    });

    expect(events).toHaveLength(1);
    expect(events[0]?.actorType).toBe('USER');
    expect(events[0]?.actorId).toBe(admin.userId);
  });
});

describe('memberships — tenant-owned child records', () => {
  it('invites a member and lists them back within the tenant', async () => {
    const organization = await createOrganization();
    const admin = await createStaff('PLATFORM_ADMIN');

    const created = await authPost(
      `${API}/organizations/${organization.id}/memberships`,
      admin.token,
      { email: 'owner@acme.example', fullName: 'Priya Raman', roles: ['CLIENT_OWNER'] },
      organization.id,
    ).expect(201);

    expect(created.body.data).toMatchObject({
      organizationId: organization.id,
      status: 'INVITED',
      roles: ['CLIENT_OWNER'],
      user: { email: 'owner@acme.example', fullName: 'Priya Raman' },
    });

    const list = await authGet(
      `${API}/organizations/${organization.id}/memberships`,
      admin.token,
      organization.id,
    ).expect(200);

    expect(list.body.data.total).toBe(1);
    expect(list.body.data.items[0]).toMatchObject({
      organizationId: organization.id,
      user: { email: 'owner@acme.example' },
    });
  });

  it('rejects a duplicate membership for the same user and tenant', async () => {
    const organization = await createOrganization();
    const admin = await createStaff('PLATFORM_ADMIN');
    const payload = { email: 'dup@acme.example', fullName: 'Sam Rao', roles: ['CLIENT_APPROVER'] };

    await authPost(
      `${API}/organizations/${organization.id}/memberships`,
      admin.token,
      payload,
      organization.id,
    ).expect(201);

    const second = await authPost(
      `${API}/organizations/${organization.id}/memberships`,
      admin.token,
      payload,
      organization.id,
    ).expect(409);

    expect(second.body.error.code).toBe('CONFLICT');
  });

  it('rejects an invalid role value', async () => {
    const organization = await createOrganization();
    const admin = await createStaff('PLATFORM_ADMIN');

    const response = await authPost(
      `${API}/organizations/${organization.id}/memberships`,
      admin.token,
      { email: 'bad@acme.example', fullName: 'Bad Role', roles: ['SUPERUSER'] },
      organization.id,
    ).expect(400);

    expect(response.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: 'roles.0' })]),
    );
  });
});

describe('tenant isolation', () => {
  it('does not leak one tenant membership list into another', async () => {
    const tenantA = await createOrganization({ slug: 'tenant-a' });
    const tenantB = await createOrganization({ slug: 'tenant-b' });
    const admin = await createStaff('PLATFORM_ADMIN');

    await authPost(
      `${API}/organizations/${tenantA.id}/memberships`,
      admin.token,
      { email: 'a@example.com', fullName: 'A Member', roles: ['CLIENT_OWNER'] },
      tenantA.id,
    ).expect(201);

    await authPost(
      `${API}/organizations/${tenantB.id}/memberships`,
      admin.token,
      { email: 'b@example.com', fullName: 'B Member', roles: ['CLIENT_OWNER'] },
      tenantB.id,
    ).expect(201);

    const listForB = await authGet(
      `${API}/organizations/${tenantB.id}/memberships`,
      admin.token,
      tenantB.id,
    ).expect(200);

    expect(listForB.body.data.total).toBe(1);
    expect(listForB.body.data.items[0].user.email).toBe('b@example.com');
  });

  it('forbids reading another tenant membership list via the path', async () => {
    const tenantA = await createOrganization({ slug: 'path-a' });
    const tenantB = await createOrganization({ slug: 'path-b' });
    const admin = await createStaff('PLATFORM_ADMIN');

    const response = await authGet(
      `${API}/organizations/${tenantB.id}/memberships`,
      admin.token,
      tenantA.id,
    ).expect(403);

    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('refuses a membership write with no tenant scope at all', async () => {
    const organization = await createOrganization();
    const admin = await createStaff('PLATFORM_ADMIN');

    const response = await authPost(
      `${API}/organizations/${organization.id}/memberships`,
      admin.token,
      { email: 'noscope@example.com', fullName: 'No Scope', roles: ['CLIENT_OWNER'] },
    ).expect(400);

    expect(response.body.error.code).toBe('TENANT_SCOPE_REQUIRED');

    const count = await prisma.membership.count();
    expect(count).toBe(0);
  });

  it('repository returns null for a foreign tenant id instead of the row', async () => {
    const mine = await createOrganization({ slug: 'repo-mine' });
    const theirs = await createOrganization({ slug: 'repo-theirs' });

    const leaked = await organizationRepository.findByIdScoped(mine.id, theirs.id);
    expect(leaked).toBeNull();

    const own = await organizationRepository.findByIdScoped(mine.id, mine.id);
    expect(own?.id).toBe(mine.id);
  });

  it('a client member cannot read a sibling tenant even with a valid token', async () => {
    const tenantA = await createOrganization({ slug: 'sibling-a' });
    const tenantB = await createOrganization({ slug: 'sibling-b' });
    const ownerA = await createMember({ organizationId: tenantA.id, roles: ['CLIENT_OWNER'] });

    const response = await authGet(
      `${API}/organizations/${tenantB.id}`,
      ownerA.token,
      tenantA.id,
    ).expect(403);

    expect(response.body.error.code).toBe('FORBIDDEN');
  });
});
