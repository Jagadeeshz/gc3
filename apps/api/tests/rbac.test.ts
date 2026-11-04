import { describe, expect, it } from 'vitest';
import { API, authGet, authPost, createMember, createOrganization, createStaff } from './helpers/api';
import { prisma } from '../src/db/client';
import {
  CLIENT_ROLE_PERMISSIONS,
  STAFF_ROLE_PERMISSIONS,
  hasPermission,
} from '../src/auth/permissions';

/**
 * Route-level authorization: the ClientRole → Permission mapping (Development
 * Brief §3) and the PLATFORM_ADMIN gate on tenant creation.
 */
describe('role → permission map', () => {
  it('grants tenant creation only to admin-level staff roles', () => {
    expect(hasPermission(STAFF_ROLE_PERMISSIONS.PLATFORM_ADMIN, 'organization:create')).toBe(true);
    expect(hasPermission(STAFF_ROLE_PERMISSIONS.OPERATIONS_MANAGER, 'organization:create')).toBe(
      true,
    );
    expect(hasPermission(STAFF_ROLE_PERMISSIONS.ACCOUNT_MANAGER, 'organization:create')).toBe(
      false,
    );
    expect(hasPermission(STAFF_ROLE_PERMISSIONS.SPECIALIST, 'organization:create')).toBe(false);
  });

  it('lets only the client owner manage members', () => {
    expect(hasPermission(CLIENT_ROLE_PERMISSIONS.CLIENT_OWNER, 'membership:invite')).toBe(true);
    expect(hasPermission(CLIENT_ROLE_PERMISSIONS.CLIENT_TEAM_MEMBER, 'membership:invite')).toBe(
      false,
    );
    expect(hasPermission(CLIENT_ROLE_PERMISSIONS.CLIENT_APPROVER, 'membership:invite')).toBe(false);
  });

  it('gives every client role read access to its own tenant', () => {
    for (const role of ['CLIENT_OWNER', 'CLIENT_TEAM_MEMBER', 'CLIENT_APPROVER'] as const) {
      expect(hasPermission(CLIENT_ROLE_PERMISSIONS[role], 'organization:read')).toBe(true);
    }
  });
});

describe('POST /api/v1/organizations — PLATFORM_ADMIN gate', () => {
  it('rejects an unauthenticated caller with 401', async () => {
    const response = await authPost(`${API}/organizations`, '', {
      name: 'No Auth Co',
      slug: 'no-auth-co',
    }).expect(401);

    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('rejects a client user with 403 — a tenant cannot create a tenant', async () => {
    const organization = await createOrganization({ slug: 'parent-co' });
    const owner = await createMember({ organizationId: organization.id, roles: ['CLIENT_OWNER'] });

    const response = await authPost(`${API}/organizations`, owner.token, {
      name: 'Upline Co',
      slug: 'upline-co',
    }).expect(403);

    expect(response.body.error.code).toBe('FORBIDDEN');
    expect(response.body.error.message).toContain('organization:create');
  });

  it('rejects a staff role without tenant-creation permission', async () => {
    const specialist = await createStaff('SPECIALIST');

    await authPost(`${API}/organizations`, specialist.token, {
      name: 'Specialist Co',
      slug: 'specialist-co',
    }).expect(403);
  });

  it('allows PLATFORM_ADMIN', async () => {
    const admin = await createStaff('PLATFORM_ADMIN');

    const response = await authPost(`${API}/organizations`, admin.token, {
      name: 'Admin Co',
      slug: 'admin-co',
    }).expect(201);

    expect(response.body.data.slug).toBe('admin-co');
  });

  it('allows OPERATIONS_MANAGER', async () => {
    const operations = await createStaff('OPERATIONS_MANAGER');

    await authPost(`${API}/organizations`, operations.token, {
      name: 'Ops Co',
      slug: 'ops-co',
    }).expect(201);
  });
});

describe('GET /organizations/:id — client role rules', () => {
  it.each([
    ['CLIENT_OWNER'],
    ['CLIENT_TEAM_MEMBER'],
    ['CLIENT_APPROVER'],
  ] as const)('allows %s to read their own tenant', async (role) => {
    const organization = await createOrganization();
    const member = await createMember({ organizationId: organization.id, roles: [role] });

    const response = await authGet(
      `${API}/organizations/${organization.id}`,
      member.token,
      organization.id,
    ).expect(200);

    expect(response.body.data.id).toBe(organization.id);
  });

  it('allows an assigned staff role to read a tenant it does not belong to', async () => {
    const organization = await createOrganization();
    const accountManager = await createStaff('ACCOUNT_MANAGER');

    await authGet(
      `${API}/organizations/${organization.id}`,
      accountManager.token,
      organization.id,
    ).expect(200);
  });

  it('rejects a member whose membership is only INVITED', async () => {
    const organization = await createOrganization();
    const invited = await createMember({
      organizationId: organization.id,
      roles: ['CLIENT_OWNER'],
      status: 'INVITED',
    });

    const response = await authGet(
      `${API}/organizations/${organization.id}`,
      invited.token,
      organization.id,
    ).expect(403);

    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('rejects a member whose membership was REVOKED, immediately', async () => {
    const organization = await createOrganization();
    const member = await createMember({ organizationId: organization.id, roles: ['CLIENT_OWNER'] });

    // Same token, membership revoked after issuance.
    await prisma.membership.update({
      where: { id: member.membershipId },
      data: { status: 'REVOKED' },
    });

    await authGet(
      `${API}/organizations/${organization.id}`,
      member.token,
      organization.id,
    ).expect(403);
  });
});

describe('memberships — client role rules', () => {
  it('lets CLIENT_OWNER list members', async () => {
    const organization = await createOrganization();
    const owner = await createMember({ organizationId: organization.id, roles: ['CLIENT_OWNER'] });

    await authGet(
      `${API}/organizations/${organization.id}/memberships`,
      owner.token,
      organization.id,
    ).expect(200);
  });

  it.each([['CLIENT_TEAM_MEMBER'], ['CLIENT_APPROVER']] as const)(
    'rejects %s from listing members',
    async (role) => {
      const organization = await createOrganization();
      const member = await createMember({ organizationId: organization.id, roles: [role] });

      const response = await authGet(
        `${API}/organizations/${organization.id}/memberships`,
        member.token,
        organization.id,
      ).expect(403);

      expect(response.body.error.message).toContain('membership:read');
    },
  );

  it('lets CLIENT_OWNER invite a member', async () => {
    const organization = await createOrganization();
    const owner = await createMember({ organizationId: organization.id, roles: ['CLIENT_OWNER'] });

    await authPost(
      `${API}/organizations/${organization.id}/memberships`,
      owner.token,
      { email: 'newhire@acme.example', fullName: 'New Hire', roles: ['CLIENT_TEAM_MEMBER'] },
      organization.id,
    ).expect(201);
  });

  it('rejects CLIENT_APPROVER from inviting a member', async () => {
    const organization = await createOrganization();
    const approver = await createMember({
      organizationId: organization.id,
      roles: ['CLIENT_APPROVER'],
    });

    await authPost(
      `${API}/organizations/${organization.id}/memberships`,
      approver.token,
      { email: 'blocked@acme.example', fullName: 'Blocked Person', roles: ['CLIENT_TEAM_MEMBER'] },
      organization.id,
    ).expect(403);
  });
});

describe('bearer token lifecycle against routes', () => {
  it('rejects every tenant route for a suspended account', async () => {
    const organization = await createOrganization();
    const owner = await createMember({ organizationId: organization.id, roles: ['CLIENT_OWNER'] });

    await prisma.user.update({ where: { id: owner.userId }, data: { status: 'SUSPENDED' } });

    await authGet(
      `${API}/organizations/${organization.id}`,
      owner.token,
      organization.id,
    ).expect(401);

    await authGet(
      `${API}/organizations/${organization.id}/memberships`,
      owner.token,
      organization.id,
    ).expect(401);
  });
});
