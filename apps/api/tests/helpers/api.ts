import type { Express } from 'express';
import request from 'supertest';
import type { ClientRole, Organization, StaffRole } from '@gc3/types';
import { createApp } from '../../src/app';
import { hashPassword } from '../../src/auth/password';
import { prisma } from '../../src/db/client';

export const app: Express = createApp();

/** The header that scopes a request to a tenant. */
export const ORG_HEADER = 'x-organization-id';

/** Shared fixture password. Long enough to satisfy the bootstrap policy. */
export const TEST_PASSWORD = 'Correct-Horse-9-Battery';

export const API = '/api/v1';

let counter = 0;
function uniqueEmail(prefix: string): string {
  counter += 1;
  return `${prefix}-${counter}-${Date.now().toString(36)}@gc3.test`;
}

// ---------------------------------------------------------------------------
// Staff (global platform roles)
// ---------------------------------------------------------------------------

export interface StaffFixture {
  readonly userId: string;
  readonly email: string;
  readonly password: string;
  readonly token: string;
}

/**
 * Staff accounts have no public creation path by design (no self-registration),
 * so fixtures are inserted directly with a real scrypt digest; the token is then
 * obtained through the actual login endpoint.
 */
export async function createStaff(
  platformRole: StaffRole = 'PLATFORM_ADMIN',
  overrides: { email?: string; password?: string; status?: 'ACTIVE' | 'SUSPENDED' } = {},
): Promise<StaffFixture> {
  const email = overrides.email ?? uniqueEmail('staff');
  const password = overrides.password ?? TEST_PASSWORD;

  const created = await prisma.user.create({
    data: {
      email,
      fullName: `Staff ${platformRole}`,
      passwordHash: await hashPassword(password),
      platformRole,
      status: overrides.status ?? 'ACTIVE',
    },
  });

  const token = await login(email, password);

  return { userId: created.id, email, password, token };
}

// ---------------------------------------------------------------------------
// Client users (tenant members)
// ---------------------------------------------------------------------------

export interface MemberFixture {
  readonly userId: string;
  readonly email: string;
  readonly password: string;
  readonly token: string;
  readonly membershipId: string;
}

export async function createMember(options: {
  organizationId: string;
  roles: readonly ClientRole[];
  status?: 'ACTIVE' | 'INVITED' | 'REVOKED';
  email?: string;
  password?: string;
}): Promise<MemberFixture> {
  const email = options.email ?? uniqueEmail('member');
  const password = options.password ?? TEST_PASSWORD;
  const membershipStatus = options.status ?? 'ACTIVE';

  const user = await prisma.user.create({
    data: {
      email,
      fullName: `Member ${options.roles.join('+')}`,
      passwordHash: await hashPassword(password),
      status: 'ACTIVE',
    },
  });

  const membership = await prisma.membership.create({
    data: {
      organizationId: options.organizationId,
      userId: user.id,
      roles: [...options.roles],
      status: membershipStatus,
    },
  });

  const token = await login(email, password);

  return {
    userId: user.id,
    email,
    password,
    token,
    membershipId: membership.id,
  };
}

// ---------------------------------------------------------------------------
// Auth helpers
// ---------------------------------------------------------------------------

/** Performs a real login and returns the access token. */
export async function login(email: string, password: string): Promise<string> {
  const response = await request(app)
    .post(`${API}/auth/login`)
    .send({ email, password })
    .expect(200);

  return response.body.data.accessToken as string;
}

/** Bearer-authenticated GET, optionally tenant-scoped. */
export function authGet(path: string, token: string, organizationId?: string) {
  const req = request(app).get(path).set('authorization', `Bearer ${token}`);
  return organizationId ? req.set(ORG_HEADER, organizationId) : req;
}

/** Bearer-authenticated POST, optionally tenant-scoped. */
export function authPost(path: string, token: string, body: unknown, organizationId?: string) {
  const req = request(app)
    .post(path)
    .set('authorization', `Bearer ${token}`)
    .send(body as object);
  return organizationId ? req.set(ORG_HEADER, organizationId) : req;
}

/** Bearer-authenticated PATCH, optionally tenant-scoped. */
export function authPatch(path: string, token: string, body: unknown, organizationId?: string) {
  const req = request(app)
    .patch(path)
    .set('authorization', `Bearer ${token}`)
    .send(body as object);
  return organizationId ? req.set(ORG_HEADER, organizationId) : req;
}

/** Bearer-authenticated DELETE, optionally tenant-scoped. */
export function authDelete(path: string, token: string, organizationId?: string) {
  const req = request(app).delete(path).set('authorization', `Bearer ${token}`);
  return organizationId ? req.set(ORG_HEADER, organizationId) : req;
}

/** Bearer-authenticated raw upload: the file bytes are the whole body. */
export function authPutRaw(
  path: string,
  token: string,
  body: Buffer,
  contentType: string,
  organizationId?: string,
) {
  const req = request(app)
    .put(path)
    .set('authorization', `Bearer ${token}`)
    .set('content-type', contentType)
    .send(body);

  return organizationId ? req.set(ORG_HEADER, organizationId) : req;
}

// ---------------------------------------------------------------------------
// Tenants
// ---------------------------------------------------------------------------

/**
 * Creates a tenant through the public API as a PLATFORM_ADMIN, so the fixture
 * exercises the same path the product will.
 */
export async function createOrganization(
  overrides: Partial<{ name: string; slug: string }> = {},
): Promise<Organization> {
  counter += 1;
  const slug = overrides.slug ?? `tenant-${counter}-${Date.now().toString(36)}`;
  const admin = await createStaff('PLATFORM_ADMIN');

  const response = await authPost(`${API}/organizations`, admin.token, {
    name: overrides.name ?? `Tenant ${counter}`,
    slug,
  }).expect(201);

  return response.body.data as Organization;
}

/** GET with a tenant scope header only (no auth) — used by negative tests. */
export function getScoped(path: string, organizationId: string) {
  return request(app).get(path).set(ORG_HEADER, organizationId);
}

// ---------------------------------------------------------------------------
// Invitations
// ---------------------------------------------------------------------------

export interface InvitationFixture {
  readonly membershipId: string;
  readonly userId: string;
  readonly email: string;
  readonly inviteToken: string;
  readonly inviteExpiresAt: string;
}

/** Invites a member through the API and returns the one-time invite token. */
export async function inviteMember(params: {
  organizationId: string;
  adminToken: string;
  email?: string;
  fullName?: string;
  roles?: readonly ClientRole[];
}): Promise<InvitationFixture> {
  const email = params.email ?? uniqueEmail('invitee');

  const response = await authPost(
    `${API}/organizations/${params.organizationId}/memberships`,
    params.adminToken,
    {
      email,
      fullName: params.fullName ?? 'Invited Person',
      roles: params.roles ?? ['CLIENT_TEAM_MEMBER'],
    },
    params.organizationId,
  ).expect(201);

  const data = response.body.data as {
    id: string;
    userId: string;
    inviteToken?: string;
    inviteExpiresAt?: string;
  };

  if (!data.inviteToken) {
    throw new Error(
      'inviteToken missing from the membership response — the API only exposes it outside production',
    );
  }

  return {
    membershipId: data.id,
    userId: data.userId,
    email,
    inviteToken: data.inviteToken,
    inviteExpiresAt: data.inviteExpiresAt ?? '',
  };
}
