import { describe, expect, it } from 'vitest';
import request from 'supertest';
import {
  app,
  authGet,
  createOrganization,
  createStaff,
  getScoped,
  ORG_HEADER,
} from './helpers/api';

/**
 * Regression suite for the API foundation contract.
 *
 * Phase 0 established seven behaviours. Phase 1 slice 2 (auth) tightened the
 * same routes: every tenant route now requires a bearer token first, and an
 * eighth behaviour — 401 without credentials — was added. The remaining seven
 * are otherwise unchanged.
 */
describe('API foundation contract', () => {
  const MISSING = '11111111-2222-4333-8444-555555555555';

  it('1. GET /health returns a liveness report without authentication', async () => {
    const response = await request(app).get('/api/v1/health').expect(200);

    expect(response.body).toMatchObject({
      success: true,
      data: {
        status: 'ok',
        service: 'gc3-api',
        version: expect.any(String),
        environment: 'test',
        uptimeSeconds: expect.any(Number),
        timestamp: expect.any(String),
      },
    });
  });

  it('2. GET /tenant-context without a tenant header is rejected', async () => {
    const staff = await createStaff('PLATFORM_ADMIN');
    const response = await authGet('/api/v1/tenant-context', staff.token).expect(400);

    expect(response.body).toMatchObject({
      success: false,
      error: { code: 'TENANT_SCOPE_REQUIRED', requestId: expect.any(String) },
    });
  });

  it('3. GET /tenant-context with a malformed tenant id is rejected', async () => {
    const staff = await createStaff('PLATFORM_ADMIN');

    const response = await request(app)
      .get('/api/v1/tenant-context')
      .set('authorization', `Bearer ${staff.token}`)
      .set(ORG_HEADER, 'not-a-uuid')
      .expect(400);

    expect(response.body.error.code).toBe('TENANT_SCOPE_REQUIRED');
  });

  it('4. GET /tenant-context with a valid scope echoes the resolved tenant', async () => {
    const staff = await createStaff('PLATFORM_ADMIN');
    const response = await authGet('/api/v1/tenant-context', staff.token, MISSING).expect(200);

    expect(response.body).toEqual({
      success: true,
      data: {
        organizationId: MISSING,
        requestId: expect.any(String),
        actorId: staff.userId,
      },
    });
  });

  it('5. GET /organizations/:id returns the organization when it matches the scope', async () => {
    const organization = await createOrganization({ name: 'Acme Cloud', slug: 'acme-cloud' });
    const staff = await createStaff('PLATFORM_ADMIN');

    const response = await authGet(
      `/api/v1/organizations/${organization.id}`,
      staff.token,
      organization.id,
    ).expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data).toMatchObject({
      id: organization.id,
      name: 'Acme Cloud',
      slug: 'acme-cloud',
      status: 'PROSPECT',
    });
  });

  it('6. GET /organizations/:id with a foreign organization id is forbidden', async () => {
    const mine = await createOrganization({ slug: 'mine-co' });
    const theirs = await createOrganization({ slug: 'theirs-co' });
    const staff = await createStaff('PLATFORM_ADMIN');

    const response = await authGet(
      `/api/v1/organizations/${theirs.id}`,
      staff.token,
      mine.id,
    ).expect(403);

    expect(response.body).toMatchObject({ success: false, error: { code: 'FORBIDDEN' } });
  });

  it('7. An unknown route returns a 404 in the error envelope', async () => {
    const response = await request(app).get('/api/v1/definitely-not-a-route').expect(404);

    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: expect.stringContaining('GET /api/v1/definitely-not-a-route'),
      },
    });
  });

  it('8. A tenant route without a bearer token is rejected with 401', async () => {
    const organization = await createOrganization();

    const response = await getScoped(
      `/api/v1/organizations/${organization.id}`,
      organization.id,
    ).expect(401);

    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('echoes an inbound correlation id back on the response', async () => {
    const response = await request(app)
      .get('/api/v1/health')
      .set('x-request-id', 'trace-abc-12345678')
      .expect(200);

    expect(response.headers['x-request-id']).toBe('trace-abc-12345678');
  });
});
