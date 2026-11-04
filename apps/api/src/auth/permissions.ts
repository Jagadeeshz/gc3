import type { ClientRole, Permission, StaffRole } from '@gc3/types';

/**
 * Role → permission mapping (Development Brief §3, §12).
 *
 * This table is the single source of truth for authorization. Routes declare the
 * permission they need, never a role name, so adding a role or re-scoping one is
 * a change to this file alone.
 *
 * Client roles are held per tenant (on Membership); staff roles are global.
 */

const ALL_PERMISSIONS: readonly Permission[] = [
  'organization:read',
  'organization:create',
  'organization:update',
  'membership:read',
  'membership:invite',
  'membership:revoke',
  'tenant:context',
  'request:read',
  'request:create',
  'request:update',
  'request:comment',
  'category:read',
  'category:manage',
  'deliverable:read',
  'deliverable:create',
  'deliverable:update',
  'deliverable:review',
  'notification:read',
  'notification:manage',
];

/**
 * `category:manage` is catalogue administration: it changes the list of services
 * a tenant can raise work under. Clients read the catalogue, staff own it.
 */

export const STAFF_ROLE_PERMISSIONS: Record<StaffRole, readonly Permission[]> = {
  // Full platform control, including tenant creation.
  PLATFORM_ADMIN: ALL_PERMISSIONS,
  // Runs delivery and onboarding; can stand up tenants but not administer the platform.
  OPERATIONS_MANAGER: [
    'organization:read',
    'organization:create',
    'organization:update',
    'membership:read',
    'membership:invite',
    'tenant:context',
    'request:read',
    'request:create',
    'request:update',
    'request:comment',
    'category:read',
    'category:manage',
    'deliverable:read',
    'deliverable:create',
    'deliverable:update',
    'deliverable:review',
    'notification:read',
    'notification:manage',
  ],
  // Owns the client relationship; read-only over membership and delivery output.
  ACCOUNT_MANAGER: [
    'organization:read',
    'membership:read',
    'tenant:context',
    'request:read',
    'request:comment',
    'category:read',
    'deliverable:read',
    'notification:read',
  ],
  // Runs the pod: assigns and progresses work, produces deliverables.
  POD_MANAGER: [
    'organization:read',
    'tenant:context',
    'request:read',
    'request:create',
    'request:update',
    'request:comment',
    'category:read',
    'deliverable:read',
    'deliverable:create',
    'deliverable:update',
    'deliverable:review',
  ],
  // Production team member: does the work, cannot move the workflow alone.
  SPECIALIST: [
    'organization:read',
    'tenant:context',
    'request:read',
    'request:comment',
    'category:read',
    'deliverable:read',
    'deliverable:create',
    'deliverable:update',
  ],
  FINANCE_MANAGER: [
    'organization:read',
    'tenant:context',
    'request:read',
    'category:read',
    'deliverable:read',
  ],
};

export const CLIENT_ROLE_PERMISSIONS: Record<ClientRole, readonly Permission[]> = {
  // The client's administrative owner inside their own organization.
  CLIENT_OWNER: [
    'organization:read',
    'membership:read',
    'membership:invite',
    'membership:revoke',
    'tenant:context',
    'request:read',
    'request:create',
    'request:update',
    'request:comment',
    'category:read',
    'deliverable:read',
    'deliverable:review',
  ],
  // Day-to-day contributor: raises requests, cannot manage people or approve.
  CLIENT_TEAM_MEMBER: [
    'organization:read',
    'tenant:context',
    'request:read',
    'request:create',
    'request:comment',
    'category:read',
    'deliverable:read',
  ],
  // Signs off on deliverables; deliberately cannot manage people.
  CLIENT_APPROVER: [
    'organization:read',
    'tenant:context',
    'request:read',
    'request:comment',
    'category:read',
    'deliverable:read',
    'deliverable:review',
  ],
};

/** Permissions a caller holds with no tenant in play. */
export function staffPermissions(role: StaffRole | null): readonly Permission[] {
  return role ? STAFF_ROLE_PERMISSIONS[role] : [];
}

/** Permissions granted by membership roles inside one tenant. */
export function clientPermissions(roles: readonly ClientRole[]): readonly Permission[] {
  return roles.flatMap((role) => CLIENT_ROLE_PERMISSIONS[role]);
}

export function hasPermission(
  held: readonly Permission[],
  required: Permission,
): boolean {
  return held.includes(required);
}
