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

// ---------------------------------------------------------------------------
// Phase 2 — service requests (Development Brief §5.2)
// ---------------------------------------------------------------------------

export const serviceRequestStatusSchema = z.enum([
  'DRAFT',
  'SUBMITTED',
  'TRIAGE',
  'IN_PROGRESS',
  'BLOCKED',
  'IN_REVIEW',
  'DELIVERED',
  'CLOSED',
  'CANCELLED',
]);

export const serviceRequestPrioritySchema = z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']);

export const deliverableStatusSchema = z.enum([
  'PENDING',
  'IN_PROGRESS',
  'IN_REVIEW',
  'APPROVED',
  'REJECTED',
  'RELEASED',
]);

export const serviceRequestIdParamsSchema = z.object({ requestId: uuidSchema });

export const deliverableParamsSchema = z.object({
  requestId: uuidSchema,
  deliverableId: uuidSchema,
});

/** Lowercase, hyphen-separated. Stable in URLs and safe to derive from a name. */
export const categorySlugSchema = z
  .string()
  .trim()
  .min(2, 'Slug is too short')
  .max(60)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and single hyphens');

export const createServiceCategorySchema = z.object({
  name: z.string().trim().min(2, 'Give the category a name').max(120),
  /** Optional: derived from the name when omitted. */
  slug: categorySlugSchema.optional(),
  /** `null` is treated the same as omitted — an empty description. */
  description: z.string().trim().max(500).nullable().optional(),
  isActive: z.boolean().default(true),
});

export type CreateServiceCategoryInput = z.infer<typeof createServiceCategorySchema>;

export const updateServiceCategorySchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    slug: categorySlugSchema.optional(),
    description: z.string().trim().max(500).nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Provide at least one field to update',
  });

export type UpdateServiceCategoryInput = z.infer<typeof updateServiceCategorySchema>;

export const serviceCategoryIdParamsSchema = z.object({ categoryId: uuidSchema });

/** `GET /deliverables/:deliverableId/...` — workspace-level deliverable routes. */
export const deliverableIdParamsSchema = z.object({ deliverableId: uuidSchema });

export const listServiceCategoriesQuerySchema = z.object({
  /** `?includeInactive=true` also returns retired categories. */
  includeInactive: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
});

export const createServiceRequestSchema = z.object({
  title: z.string().trim().min(3, 'Give the request a title').max(200),
  description: z.string().trim().min(10, 'Describe the work in a little more detail').max(20_000),
  categoryId: uuidSchema.optional(),
  assigneeId: uuidSchema.optional(),
  priority: serviceRequestPrioritySchema.default('NORMAL'),
  dueAt: z.coerce.date().optional(),
  /** Clients may submit straight away; DRAFT is the default. */
  status: z.enum(['DRAFT', 'SUBMITTED']).default('DRAFT'),
});

export type CreateServiceRequestInput = z.infer<typeof createServiceRequestSchema>;

/** Partial update. `.refine` stops an empty body from being a silent no-op. */
export const updateServiceRequestSchema = z
  .object({
    title: z.string().trim().min(3).max(200).optional(),
    description: z.string().trim().min(10).max(20_000).optional(),
    categoryId: uuidSchema.nullable().optional(),
    assigneeId: uuidSchema.nullable().optional(),
    priority: serviceRequestPrioritySchema.optional(),
    dueAt: z.coerce.date().nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Provide at least one field to update',
  });

export type UpdateServiceRequestInput = z.infer<typeof updateServiceRequestSchema>;

export const changeServiceRequestStatusSchema = z.object({
  status: serviceRequestStatusSchema,
  note: z.string().trim().max(1_000).optional(),
});

export const createRequestCommentSchema = z.object({
  body: z.string().trim().min(1, 'Write a comment').max(5_000),
  /** Staff-only note. Ignored for client actors by the route. */
  isInternal: z.boolean().default(false),
});

export const listServiceRequestsQuerySchema = paginationSchema.extend({
  status: serviceRequestStatusSchema.optional(),
  priority: serviceRequestPrioritySchema.optional(),
  categoryId: uuidSchema.optional(),
  requesterId: uuidSchema.optional(),
});

export type ListServiceRequestsQuery = z.infer<typeof listServiceRequestsQuerySchema>;

export const createDeliverableSchema = z.object({
  title: z.string().trim().min(3).max(200),
  description: z.string().trim().max(1_000).optional(),
  fileUrl: z.url().max(500).optional(),
});

/**
 * Editing a deliverable always produces a new version. `changeNote` is the
 * optional "why" that lands on the version row rather than on the deliverable.
 */
export const updateDeliverableSchema = z
  .object({
    title: z.string().trim().min(3).max(200).optional(),
    description: z.string().trim().max(1_000).nullable().optional(),
    fileUrl: z.url().max(500).nullable().optional(),
    changeNote: z.string().trim().max(500).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Provide at least one field to update',
  });

export type UpdateDeliverableInput = z.infer<typeof updateDeliverableSchema>;

/** `GET /deliverables/history` — released assets across the workspace. */
export const deliveryHistoryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export const changeDeliverableStatusSchema = z.object({
  status: deliverableStatusSchema,
});

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
