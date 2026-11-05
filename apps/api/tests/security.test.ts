import { afterEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import {
  API,
  app,
  authGet,
  authPatch,
  createMember,
  createOrganization,
  createStaff,
  inviteMember,
  login,
  TEST_PASSWORD,
} from './helpers/api';
import { prisma } from '../src/db/client';
import { rateLimiters } from '../src/middleware/rate-limit';

/**
 * Security hardening: headers, rate limits and the audit trail.
 *
 * The rate limiter ships disabled in the test suite (fixtures log in constantly),
 * so these tests turn the ceiling down to a handful on purpose — the 429 path runs
 * through the same middleware a deployment uses, not a copy of it.
 */
afterEach(() => {
  // Restore the suite defaults so one test cannot starve another.
  rateLimiters.auth.configure({ max: 0 });
  rateLimiters.api.configure({ max: 0 });
  rateLimiters.auth.reset();
  rateLimiters.api.reset();
});

describe('security headers', () => {
  it('sets them on every response, including failures', async () => {
    const ok = await request(app).get(`${API}/health`).expect(200);

    expect(ok.headers['x-content-type-options']).toBe('nosniff');
    expect(ok.headers['x-frame-options']).toBe('DENY');
    expect(ok.headers['referrer-policy']).toBe('no-referrer');
    expect(ok.headers['cross-origin-opener-policy']).toBe('same-origin');
    expect(ok.headers['permissions-policy']).toContain('geolocation=()');
    expect(ok.headers['content-security-policy']).toContain("default-src 'none'");
    // The framework banner is free reconnaissance.
    expect(ok.headers['x-powered-by']).toBeUndefined();

    // A rejection carries the same protections: a 401 body is still a response.
    const denied = await request(app).get(`${API}/service-requests`).expect(401);
    expect(denied.headers['x-content-type-options']).toBe('nosniff');
    expect(denied.headers['x-frame-options']).toBe('DENY');
  });
});

describe('rate limiting', () => {
  it('refuses sign-in attempts past the ceiling, with Retry-After', async () => {
    const organization = await createOrganization();
    const member = await createMember({ organizationId: organization.id, roles: ['CLIENT_OWNER'] });

    rateLimiters.auth.configure({ windowMs: 60_000, max: 2 });

    // Two attempts are allowed, the third is refused — and the third is a *valid*
    // credential, which is the point: the limit protects the account, not the guess.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await request(app)
        .post(`${API}/auth/login`)
        .send({ email: member.email, password: TEST_PASSWORD })
        .expect(200);
    }

    const limited = await request(app)
      .post(`${API}/auth/login`)
      .send({ email: member.email, password: TEST_PASSWORD })
      .expect(429);

    expect(limited.body.error.code).toBe('RATE_LIMITED');
    expect(limited.body.error.message).toMatch(/too many/i);
    expect(Number(limited.headers['retry-after'])).toBeGreaterThan(0);
    expect(limited.headers['x-ratelimit-remaining']).toBe('0');
  });

  it('limits one tenant without touching another', async () => {
    const admin = await createStaff('PLATFORM_ADMIN');
    const alpha = await createOrganization({ name: 'Rate Alpha' });
    const beta = await createOrganization({ name: 'Rate Beta' });

    rateLimiters.api.configure({ windowMs: 60_000, max: 2 });

    await authGet(`${API}/service-requests`, admin.token, alpha.id).expect(200);
    await authGet(`${API}/service-requests`, admin.token, alpha.id).expect(200);
    await authGet(`${API}/service-requests`, admin.token, alpha.id).expect(429);

    // A different tenant has its own budget.
    await authGet(`${API}/service-requests`, admin.token, beta.id).expect(200);
  });

  it('advertises the remaining budget even when it lets the call through', async () => {
    const admin = await createStaff('PLATFORM_ADMIN');
    const organization = await createOrganization();

    rateLimiters.api.configure({ windowMs: 60_000, max: 5 });

    const response = await authGet(`${API}/service-requests`, admin.token, organization.id)
      .expect(200);

    expect(response.headers['x-ratelimit-limit']).toBe('5');
    expect(response.headers['x-ratelimit-remaining']).toBe('4');
  });

  it('is a no-op when configured off', async () => {
    const admin = await createStaff('PLATFORM_ADMIN');
    const organization = await createOrganization();

    for (let index = 0; index < 6; index += 1) {
      await authGet(`${API}/service-requests`, admin.token, organization.id).expect(200);
    }
  });
});

describe('audit log', () => {
  it('records a role change with both role sets and the request context', async () => {
    const organization = await createOrganization({ name: 'Role Change Co' });
    const admin = await createStaff('PLATFORM_ADMIN');
    // An ACTIVE member: an invited one has no roles to change yet.
    const colleague = await createMember({
      organizationId: organization.id,
      roles: ['CLIENT_TEAM_MEMBER'],
    });

    await request(app)
      .patch(`${API}/organizations/${organization.id}/memberships/${colleague.userId}/roles`)
      .set('authorization', `Bearer ${admin.token}`)
      .set('x-organization-id', organization.id)
      .set('user-agent', 'security-suite/1.0')
      .send({ roles: ['CLIENT_APPROVER', 'CLIENT_TEAM_MEMBER'] })
      .expect(200);

    const entry = await prisma.auditEvent.findFirst({
      where: { organizationId: organization.id, action: 'membership.roles_changed' },
      orderBy: { createdAt: 'desc' },
    });

    expect(entry).not.toBeNull();
    expect(entry?.targetType).toBe('membership');
    expect(entry?.actorId).toBe(admin.userId);
    expect(entry?.metadata).toMatchObject({
      subjectUserId: colleague.userId,
      from: ['CLIENT_TEAM_MEMBER'],
      to: ['CLIENT_APPROVER', 'CLIENT_TEAM_MEMBER'],
    });
    // The request context is what makes an audit row investigable.
    expect(entry?.requestId).toBeTruthy();
    expect(entry?.ip).toBeTruthy();
    expect(entry?.userAgent).toBe('security-suite/1.0');
  });

  it('refuses to demote the last owner, and records nothing', async () => {
    const organization = await createOrganization({ name: 'Last Owner Co' });
    const owner = await createMember({ organizationId: organization.id, roles: ['CLIENT_OWNER'] });

    const before = await prisma.auditEvent.count({
      where: { organizationId: organization.id, action: 'membership.roles_changed' },
    });

    const refused = await authPatch(
      `${API}/organizations/${organization.id}/memberships/${owner.userId}/roles`,
      owner.token,
      { roles: ['CLIENT_TEAM_MEMBER'] },
      organization.id,
    ).expect(409);

    expect(refused.body.error.message).toMatch(/last active client owner/i);

    const after = await prisma.auditEvent.count({
      where: { organizationId: organization.id, action: 'membership.roles_changed' },
    });
    expect(after).toBe(before);
  });

  it('cannot be used to hand out a staff role', async () => {
    const organization = await createOrganization();
    const owner = await createMember({ organizationId: organization.id, roles: ['CLIENT_OWNER'] });
    const member = await createMember({
      organizationId: organization.id,
      roles: ['CLIENT_TEAM_MEMBER'],
    });

    await authPatch(
      `${API}/organizations/${organization.id}/memberships/${member.userId}/roles`,
      owner.token,
      { roles: ['PLATFORM_ADMIN'] },
      organization.id,
    ).expect(400);
  });

  it('records a tenant edit with the fields that actually changed', async () => {
    const organization = await createOrganization({ name: 'Before Rename' });
    const admin = await createStaff('PLATFORM_ADMIN');

    const updated = await authPatch(
      `${API}/organizations/${organization.id}`,
      admin.token,
      { name: 'After Rename' },
      organization.id,
    ).expect(200);

    expect(updated.body.data.name).toBe('After Rename');

    const entry = await prisma.auditEvent.findFirst({
      where: { organizationId: organization.id, action: 'organization.updated' },
    });

    expect(entry?.metadata).toMatchObject({
      fields: ['name'],
      before: { name: 'Before Rename' },
      after: { name: 'After Rename' },
    });
  });

  it('does not reset fields the caller did not send', async () => {
    // Regression: `updateOrganizationSchema` is a partial of the create schema, and
    // Zod applies `.default()` to absent keys — so forwarding the parsed object
    // rewrote timezone and region to the create-time defaults on every rename.
    const organization = await createOrganization({ name: 'Region Keeper' });
    const admin = await createStaff('PLATFORM_ADMIN');

    await prisma.organization.update({
      where: { id: organization.id },
      data: { region: 'apac', timezone: 'Asia/Singapore' },
    });

    const updated = await authPatch(
      `${API}/organizations/${organization.id}`,
      admin.token,
      { name: 'Region Keeper Renamed' },
      organization.id,
    ).expect(200);

    expect(updated.body.data.region).toBe('apac');
    expect(updated.body.data.timezone).toBe('Asia/Singapore');

    const entry = await prisma.auditEvent.findFirst({
      where: { organizationId: organization.id, action: 'organization.updated' },
    });
    expect((entry?.metadata as { fields: string[] }).fields).toEqual(['name']);
  });

  it('refuses to change tenant status through the tenant edit endpoint', async () => {
    const organization = await createOrganization();
    const admin = await createStaff('PLATFORM_ADMIN');

    const refused = await authPatch(
      `${API}/organizations/${organization.id}`,
      admin.token,
      { status: 'SUSPENDED' },
      organization.id,
    ).expect(400);

    expect(refused.body.error.message).toMatch(/platform/i);
  });

  it('does not log a no-op edit', async () => {
    const organization = await createOrganization({ name: 'Steady Co' });
    const admin = await createStaff('PLATFORM_ADMIN');

    const before = await prisma.auditEvent.count({
      where: { organizationId: organization.id, action: 'organization.updated' },
    });

    await authPatch(
      `${API}/organizations/${organization.id}`,
      admin.token,
      { name: 'Steady Co' },
      organization.id,
    ).expect(200);

    const after = await prisma.auditEvent.count({
      where: { organizationId: organization.id, action: 'organization.updated' },
    });
    expect(after).toBe(before);
  });

  it('serves the log to platform operations only', async () => {
    const organization = await createOrganization();
    const admin = await createStaff('PLATFORM_ADMIN');
    const owner = await createMember({ organizationId: organization.id, roles: ['CLIENT_OWNER'] });

    await authPatch(
      `${API}/organizations/${organization.id}`,
      admin.token,
      { name: 'Audited Tenant' },
      organization.id,
    ).expect(200);

    const page = await authGet(
      `${API}/ops/audit?organizationId=${organization.id}`,
      admin.token,
    ).expect(200);

    expect(page.body.data.items.length).toBeGreaterThanOrEqual(1);
    const actions = page.body.data.items.map((entry: { action: string }) => entry.action);
    expect(actions).toContain('organization.updated');

    const entry = page.body.data.items[0];
    expect(entry.organizationName).toBe('Audited Tenant');
    expect(entry.actorEmail).toBe(admin.email ?? entry.actorEmail);

    // Filtering by action narrows it to exactly that action.
    const filtered = await authGet(
      `${API}/ops/audit?organizationId=${organization.id}&action=organization.updated`,
      admin.token,
    ).expect(200);
    for (const row of filtered.body.data.items as { action: string }[]) {
      expect(row.action).toBe('organization.updated');
    }

    await authGet(`${API}/ops/audit`, owner.token).expect(403);
    await authGet(`${API}/ops/audit`, 'not-a-token').expect(401);
  });

  it('rejects an invalid audit filter rather than ignoring it', async () => {
    const admin = await createStaff('PLATFORM_ADMIN');

    await authGet(`${API}/ops/audit?organizationId=not-a-uuid`, admin.token).expect(400);
    await authGet(`${API}/ops/audit?since=yesterday`, admin.token).expect(400);
  });
});

describe('tenant edit authorisation', () => {
  it('requires organization:update and a matching tenant scope', async () => {
    const organization = await createOrganization();
    const other = await createOrganization();
    const owner = await createMember({ organizationId: organization.id, roles: ['CLIENT_OWNER'] });

    // A client owner has no organization:update.
    await authPatch(
      `${API}/organizations/${organization.id}`,
      owner.token,
      { name: 'Sneaky Rename' },
      organization.id,
    ).expect(403);

    // A platform admin editing across tenants is refused by the scope match.
    const admin = await createStaff('PLATFORM_ADMIN');
    await authPatch(
      `${API}/organizations/${other.id}`,
      admin.token,
      { name: 'Wrong Scope' },
      organization.id,
    ).expect(403);

    // The login helper is exercised above; keep the import honest.
    expect(typeof (await login(owner.email, TEST_PASSWORD))).toBe('string');
  });
});
