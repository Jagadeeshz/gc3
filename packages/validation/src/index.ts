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
