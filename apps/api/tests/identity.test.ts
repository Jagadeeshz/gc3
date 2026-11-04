import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { app, createOrganization, getScoped } from './helpers/api';
import { prisma } from '../src/db/client';
import { organizationRepository } from '../src/repositories/organization.repository';

/**
 * Identity slice: persistence, validation, and the multi-tenant isolation rule
 * that the whole platform depends on (Development Brief §12).
 */
describe('organizations — persistence and validation', () => {
  it('creates a tenant and persists it', async () => {
    const response = await request(app)
      .post('/api/v1/organizations')
      .send({ name: 'Northwind Cloud', slug: 'northwind-cloud' })
      .expect(201);

    expect(response.body.data).toMatchObject({
      name: 'Northwind Cloud',
      slug: 'northwind-cloud',
      status: 'PROSPECT',
      timezone: 'Asia/Kolkata',
      region: 'global',
    });

    const persisted = await prisma.organization.findUnique({
      where: { slug: 'northwind-cloud' },
    });
    expect(persisted?.id).toBe(response.body.data.id);
  });

  it('rejects a malformed payload with field-level detail', async () => {
    const response = await request(app)
      .post('/api/v1/organizations')
      .send({ name: 'X', slug: 'Not A Slug' })
      .expect(400);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'name' }),
        expect.objectContaining({ path: 'slug' }),
      ]),
    );
  });

  it('rejects a duplicate slug with 409', async () => {
    await createOrganization({ slug: 'duplicate-co' });

    const response = await request(app)
      .post('/api/v1/organizations')
      .send({ name: 'Duplicate Co', slug: 'duplicate-co' })
      .expect(409);

    expect(response.body.error.code).toBe('CONFLICT');
  });

  it('returns 404 for a well-formed id that does not exist in scope', async () => {
    const organization = await createOrganization();
    const ghost = '99999999-8888-4777-8666-555555555555';

    // Ghost id equals the scope, so it passes the tenant gate and misses in the DB.
    const response = await getScoped(`/api/v1/organizations/${ghost}`, ghost).expect(404);

    expect(response.body.error.code).toBe('NOT_FOUND');
    expect(response.body.data).toBeUndefined();
    expect(organization.id).not.toBe(ghost);
  });

  it('records an audit event when a tenant is created', async () => {
    const organization = await createOrganization({ slug: 'audited-co' });

    const events = await prisma.auditEvent.findMany({
      where: { organizationId: organization.id, action: 'organization.created' },
    });

    expect(events).toHaveLength(1);
    expect(events[0]?.actorType).toBe('SYSTEM');
  });
});

describe('memberships — tenant-owned child records', () => {
  it('invites a member and lists them back within the tenant', async () => {
    const organization = await createOrganization();

    const created = await request(app)
      .post(`/api/v1/organizations/${organization.id}/memberships`)
      .set('x-organization-id', organization.id)
      .send({
        email: 'owner@acme.example',
        fullName: 'Priya Raman',
        roles: ['CLIENT_OWNER'],
      })
      .expect(201);

    expect(created.body.data).toMatchObject({
      organizationId: organization.id,
      status: 'INVITED',
      roles: ['CLIENT_OWNER'],
      user: { email: 'owner@acme.example', fullName: 'Priya Raman' },
    });

    const list = await getScoped(
      `/api/v1/organizations/${organization.id}/memberships`,
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
    const payload = { email: 'dup@acme.example', fullName: 'Sam Rao', roles: ['CLIENT_APPROVER'] };

    await request(app)
      .post(`/api/v1/organizations/${organization.id}/memberships`)
      .set('x-organization-id', organization.id)
      .send(payload)
      .expect(201);

    const second = await request(app)
      .post(`/api/v1/organizations/${organization.id}/memberships`)
      .set('x-organization-id', organization.id)
      .send(payload)
      .expect(409);

    expect(second.body.error.code).toBe('CONFLICT');
  });

  it('rejects an invalid role value', async () => {
    const organization = await createOrganization();

    const response = await request(app)
      .post(`/api/v1/organizations/${organization.id}/memberships`)
      .set('x-organization-id', organization.id)
      .send({ email: 'bad@acme.example', fullName: 'Bad Role', roles: ['SUPERUSER'] })
      .expect(400);

    expect(response.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: 'roles.0' })]),
    );
  });
});

describe('tenant isolation', () => {
  it('does not leak one tenant membership list into another', async () => {
    const tenantA = await createOrganization({ slug: 'tenant-a' });
    const tenantB = await createOrganization({ slug: 'tenant-b' });

    await request(app)
      .post(`/api/v1/organizations/${tenantA.id}/memberships`)
      .set('x-organization-id', tenantA.id)
      .send({ email: 'a@example.com', fullName: 'A Member', roles: ['CLIENT_OWNER'] })
      .expect(201);

    await request(app)
      .post(`/api/v1/organizations/${tenantB.id}/memberships`)
      .set('x-organization-id', tenantB.id)
      .send({ email: 'b@example.com', fullName: 'B Member', roles: ['CLIENT_OWNER'] })
      .expect(201);

    const listForB = await getScoped(
      `/api/v1/organizations/${tenantB.id}/memberships`,
      tenantB.id,
    ).expect(200);

    expect(listForB.body.data.total).toBe(1);
    expect(listForB.body.data.items[0].user.email).toBe('b@example.com');
  });

  it('forbids reading another tenant membership list via the path', async () => {
    const tenantA = await createOrganization({ slug: 'path-a' });
    const tenantB = await createOrganization({ slug: 'path-b' });

    const response = await getScoped(
      `/api/v1/organizations/${tenantB.id}/memberships`,
      tenantA.id,
    ).expect(403);

    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('refuses a membership write with no tenant scope at all', async () => {
    const organization = await createOrganization();

    const response = await request(app)
      .post(`/api/v1/organizations/${organization.id}/memberships`)
      .send({ email: 'noscope@example.com', fullName: 'No Scope', roles: ['CLIENT_OWNER'] })
      .expect(400);

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
});
