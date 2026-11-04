/**
 * @gc3/types — shared domain contracts.
 *
 * Every tenant-owned entity extends `TenantScoped`. The API layer
 * enforces isolation; the client never decides tenancy.
 */

/** Canonical identifier format for all GC3 primary keys. */
export type Uuid = string;

/** ISO-8601 timestamp string, e.g. `2026-11-04T11:25:00.000Z`. */
export type IsoDateTime = string;

/** Discriminator for soft-deleted records. */
export interface SoftDeletable {
  readonly deletedAt: IsoDateTime | null;
}

/** Timestamp contract shared by all persisted entities. */
export interface Timestamps {
  readonly createdAt: IsoDateTime;
  readonly updatedAt: IsoDateTime;
}

/**
 * Mandatory tenant scope. Any record derived from client data carries
 * `organizationId`, and every query must filter on it.
 */
export interface TenantScoped {
  readonly organizationId: Uuid;
}

// ---------------------------------------------------------------------------
// Roles (Development Brief §3)
// ---------------------------------------------------------------------------

/** Client-side roles — scoped to a single organization. */
export type ClientRole = 'CLIENT_OWNER' | 'CLIENT_TEAM_MEMBER' | 'CLIENT_APPROVER';

/** Internal GC3 roles. */
export type InternalRole =
  | 'ACCOUNT_MANAGER'
  | 'OPERATIONS_MANAGER'
  | 'POD_MANAGER'
  | 'SPECIALIST'
  | 'FINANCE_MANAGER'
  | 'PLATFORM_ADMIN';

/** AI agent actor role — never a human approver. */
export type AgentRole = 'AI_AGENT';

export type Role = ClientRole | InternalRole | AgentRole;

/** Actors that must be authorised by organization membership. */
export const CLIENT_ROLES: readonly ClientRole[] = [
  'CLIENT_OWNER',
  'CLIENT_TEAM_MEMBER',
  'CLIENT_APPROVER',
];

/** Actors employed by GC3; they access tenants through assignment, not membership. */
export const INTERNAL_ROLES: readonly InternalRole[] = [
  'ACCOUNT_MANAGER',
  'OPERATIONS_MANAGER',
  'POD_MANAGER',
  'SPECIALIST',
  'FINANCE_MANAGER',
  'PLATFORM_ADMIN',
];

/** Actions an AI agent may never perform without human sign-off (Brief §8.3). */
export const AGENT_PROHIBITED_ACTIONS = [
  'PAYMENT_EXECUTION',
  'CONTRACT_TERM_CHANGE',
  'PRICING_CHANGE',
  'REFUND_ISSUANCE',
  'DELIVERABLE_RELEASE',
] as const;

export type AgentProhibitedAction = (typeof AGENT_PROHIBITED_ACTIONS)[number];

// ---------------------------------------------------------------------------
// Core entities (Development Brief §9)
// ---------------------------------------------------------------------------

export type OrganizationStatus = 'PROSPECT' | 'ONBOARDING' | 'ACTIVE' | 'SUSPENDED' | 'CHURNED';

/** A tenant. The unit of isolation for every other record. */
export interface Organization extends Timestamps, SoftDeletable {
  readonly id: Uuid;
  readonly name: string;
  readonly slug: string;
  readonly status: OrganizationStatus;
  readonly timezone: string;
  readonly region: string;
}

export type UserStatus = 'INVITED' | 'ACTIVE' | 'SUSPENDED';

/** A human identity. Users are global; access is granted via membership. */
export interface User extends Timestamps, SoftDeletable {
  readonly id: Uuid;
  readonly email: string;
  readonly fullName: string;
  readonly status: UserStatus;
  readonly lastSeenAt: IsoDateTime | null;
}

export type MembershipStatus = 'INVITED' | 'ACTIVE' | 'REVOKED';

/** Binds a user to a tenant with one or more client roles. */
export interface Membership extends Timestamps, TenantScoped {
  readonly id: Uuid;
  readonly userId: Uuid;
  readonly roles: readonly ClientRole[];
  readonly status: MembershipStatus;
}

// ---------------------------------------------------------------------------
// API envelope (Development Brief §11)
// ---------------------------------------------------------------------------

export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'TENANT_SCOPE_REQUIRED'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'NOT_IMPLEMENTED'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR';

export interface ApiErrorBody {
  readonly code: ApiErrorCode;
  readonly message: string;
  /** Field-level detail for VALIDATION_ERROR responses. */
  readonly details?: readonly { readonly path: string; readonly message: string }[];
  /** Correlation id echoed from the `x-request-id` request header. */
  readonly requestId: string;
}

export type ApiSuccess<T> = { readonly success: true; readonly data: T };
export type ApiFailure = { readonly success: false; readonly error: ApiErrorBody };
export type ApiResponse<T> = ApiSuccess<T> | ApiFailure;

export interface Paginated<T> {
  readonly items: readonly T[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
}

/** Liveness payload returned by `GET /api/v1/health`. */
export interface HealthReport {
  readonly status: 'ok';
  readonly service: 'gc3-api';
  readonly version: string;
  readonly environment: string;
  readonly uptimeSeconds: number;
  readonly timestamp: IsoDateTime;
}
