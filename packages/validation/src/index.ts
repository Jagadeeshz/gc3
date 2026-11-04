/**
 * @gc3/validation — Zod schemas shared by the API and the web client.
 *
 * Rule: schemas live here, never inline in a route handler, so the
 * request contract has exactly one definition.
 */
import { z } from 'zod';
import type { ClientRole, OrganizationStatus, Role } from '@gc3/types';

export const uuidSchema = z.uuid('Must be a valid UUID');
export const emailSchema = z.email('Must be a valid email address').max(254);

export const organizationStatusSchema = z.enum([
  'PROSPECT',
  'ONBOARDING',
  'ACTIVE',
  'SUSPENDED',
  'CHURNED',
]) satisfies z.ZodType<OrganizationStatus>;

export const clientRoleSchema = z.enum([
  'CLIENT_OWNER',
  'CLIENT_TEAM_MEMBER',
  'CLIENT_APPROVER',
]) satisfies z.ZodType<ClientRole>;

export const roleSchema = z.enum([
  'CLIENT_OWNER',
  'CLIENT_TEAM_MEMBER',
  'CLIENT_APPROVER',
  'ACCOUNT_MANAGER',
  'OPERATIONS_MANAGER',
  'POD_MANAGER',
  'SPECIALIST',
  'FINANCE_MANAGER',
  'PLATFORM_ADMIN',
  'AI_AGENT',
]) satisfies z.ZodType<Role>;

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type PaginationInput = z.infer<typeof paginationSchema>;

/** Query contract shared by every list endpoint. */
export const listQuerySchema = paginationSchema.extend({
  search: z.string().trim().min(1).max(120).optional(),
  sort: z.enum(['createdAt', 'updatedAt', 'name']).default('createdAt'),
  direction: z.enum(['asc', 'desc']).default('desc'),
});

export type ListQueryInput = z.infer<typeof listQuerySchema>;

// ---------------------------------------------------------------------------
// Organizations (Phase 1)
// ---------------------------------------------------------------------------

export const organizationSlugSchema = z
  .string()
  .trim()
  .min(2)
  .max(60)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and single hyphens');

/** Login contract. Password length is only bounded here; policy lives at set-password. */
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required').max(200),
});

export type LoginInput = z.infer<typeof loginSchema>;

/**
 * Password policy for credential *creation* (invite acceptance, resets).
 * Login stays permissive so policy changes never lock an existing user out.
 */
export const passwordPolicySchema = z
  .string()
  .min(12, 'Use at least 12 characters')
  .max(200, 'Use at most 200 characters')
  .refine((value) => /[A-Za-z]/.test(value), 'Include at least one letter')
  .refine((value) => /[0-9]/.test(value), 'Include at least one number');

/** Invite tokens are 32 random bytes, base64url encoded. */
export const inviteTokenSchema = z
  .string()
  .trim()
  .min(20, 'Invite token is too short')
  .max(200, 'Invite token is too long')
  .regex(/^[A-Za-z0-9_-]+$/, 'Invite token has an invalid format');

/** Route params for invite lifecycle operations: /organizations/:organizationId/memberships/:userId/invite. */
export const inviteLifecycleParamsSchema = z.object({
  organizationId: uuidSchema,
  userId: uuidSchema,
});

export type InviteLifecycleParams = z.infer<typeof inviteLifecycleParamsSchema>;

export const acceptInviteSchema = z.object({
  token: inviteTokenSchema,
  password: passwordPolicySchema,
});

export type AcceptInviteInput = z.infer<typeof acceptInviteSchema>;

export const createOrganizationSchema = z.object({
  name: z.string().trim().min(2).max(120),
  slug: organizationSlugSchema,
  timezone: z.string().trim().min(3).max(64).default('Asia/Kolkata'),
  region: z.string().trim().min(2).max(64).default('global'),
});

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;

export const updateOrganizationSchema = createOrganizationSchema
  .partial()
  .extend({ status: organizationStatusSchema.optional() });

export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;

/** Route param contract for `/api/v1/organizations/:organizationId`. */
export const organizationIdParamsSchema = z.object({
  organizationId: uuidSchema,
});

// ---------------------------------------------------------------------------
// Tenant scope (Development Brief §12 — mandatory isolation input)
// ---------------------------------------------------------------------------

/** Header that carries the tenant scope for a request. */
export const ORGANIZATION_HEADER = 'x-organization-id' as const;

/**
 * Tenant scope is supplied by a header, not the body or the query string,
 * so it can be validated once in middleware and never trusted from a payload.
 */
export const tenantScopeSchema = z.object({
  [ORGANIZATION_HEADER]: uuidSchema,
});

export type TenantScopeInput = z.infer<typeof tenantScopeSchema>;

// ---------------------------------------------------------------------------
// Users & membership (Phase 1)
// ---------------------------------------------------------------------------

export const inviteUserSchema = z.object({
  email: emailSchema,
  fullName: z.string().trim().min(2).max(120),
  roles: z.array(clientRoleSchema).min(1).max(3),
});

export type InviteUserInput = z.infer<typeof inviteUserSchema>;

/**
 * Flattens a ZodError into the `details` array of the API error envelope.
 */
export function formatIssues(error: z.ZodError): { path: string; message: string }[] {
  return error.issues.map((issue) => ({
    path: issue.path.join('.') || '(root)',
    message: issue.message,
  }));
}
