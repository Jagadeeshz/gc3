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

/** GC3 internal role, stored on the user rather than on a membership. */
export type StaffRole =
  | 'PLATFORM_ADMIN'
  | 'OPERATIONS_MANAGER'
  | 'ACCOUNT_MANAGER'
  | 'POD_MANAGER'
  | 'SPECIALIST'
  | 'FINANCE_MANAGER';

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
  | 'INVITE_INVALID'
  | 'INVITE_EXPIRED'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'NOT_IMPLEMENTED'
  | 'PAYLOAD_TOO_LARGE'
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

// ---------------------------------------------------------------------------
// Auth & RBAC (Phase 1, slice 2)
// ---------------------------------------------------------------------------

/**
 * Granular capability checked at the route layer. Permissions are derived from
 * roles server-side; a client may read its own list but can never assert one.
 */
export type Permission =
  | 'organization:read'
  | 'organization:create'
  | 'organization:update'
  | 'membership:read'
  | 'membership:invite'
  | 'membership:revoke'
  | 'tenant:context'
  | 'request:read'
  | 'request:create'
  | 'request:update'
  | 'request:comment'
  | 'category:read'
  | 'category:manage'
  | 'deliverable:read'
  | 'deliverable:create'
  | 'deliverable:update'
  | 'deliverable:review';

/** The authenticated caller, resolved from a verified access token. */
export interface AuthActor {
  readonly userId: Uuid;
  readonly email: string;
  readonly fullName: string;
  /** STAFF act across tenants by role; CLIENT act inside a membership. */
  readonly kind: 'STAFF' | 'CLIENT';
  readonly platformRole: StaffRole | null;
}

/** Response body of `POST /api/v1/auth/login`. */
export interface AuthSession {
  readonly accessToken: string;
  readonly tokenType: 'Bearer';
  readonly expiresIn: number;
  readonly actor: AuthActor;
}

/** Response body of `GET /api/v1/auth/me`. */
export interface AuthProfile {
  readonly actor: AuthActor;
  /** Permissions the actor holds without any tenant scope applied. */
  readonly permissions: readonly Permission[];
}

/**
 * A tenant the caller can act in, with the roles that grant that access.
 * Powers the portal's organization switcher and the `x-organization-id` value
 * the client must send on every tenant-scoped request.
 */
export interface AccessibleOrganization {
  readonly id: Uuid;
  readonly name: string;
  readonly slug: string;
  readonly status: OrganizationStatus;
  /** Empty for staff, who act by platform role rather than membership. */
  readonly roles: readonly ClientRole[];
}

/** Safe, pre-authentication view of an invitation (email is masked). */
export interface InvitePreview {
  readonly email: string;
  readonly fullName: string;
  readonly organizationName: string;
  readonly roles: readonly ClientRole[];
  readonly expiresAt: IsoDateTime;
}

/** Response body of `POST /api/v1/auth/accept-invite`. */
export interface InviteAcceptance extends AuthSession {
  readonly organizationId: Uuid;
  readonly organizationName: string;
  readonly roles: readonly ClientRole[];
}

// ---------------------------------------------------------------------------
// Phase 2 — client portal & service requests (Development Brief §5.2, §9)
// ---------------------------------------------------------------------------

export type ServiceRequestStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'TRIAGE'
  | 'IN_PROGRESS'
  | 'BLOCKED'
  | 'IN_REVIEW'
  | 'DELIVERED'
  | 'CLOSED'
  | 'CANCELLED';

export type ServiceRequestPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export type DeliverableStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'IN_REVIEW'
  | 'APPROVED'
  | 'REJECTED'
  | 'RELEASED';

/** Statuses that close a request; the service stamps `closedAt` on entry. */
export const TERMINAL_REQUEST_STATUSES: readonly ServiceRequestStatus[] = ['CLOSED', 'CANCELLED'];

/**
 * Legal status transitions (Development Brief §5.2).
 *
 * Enforced at the HTTP layer, not in the repository: the repository stays a
 * permissive data primitive, and the API owns the workflow contract. A repeat of
 * the current status is treated as an idempotent no-op rather than an error, so
 * a retried request is safe.
 */
export const SERVICE_REQUEST_TRANSITIONS: Readonly<
  Record<ServiceRequestStatus, readonly ServiceRequestStatus[]>
> = {
  DRAFT: ['SUBMITTED', 'CANCELLED'],
  SUBMITTED: ['TRIAGE', 'IN_PROGRESS', 'CANCELLED'],
  TRIAGE: ['IN_PROGRESS', 'BLOCKED', 'CANCELLED'],
  IN_PROGRESS: ['BLOCKED', 'IN_REVIEW', 'CANCELLED'],
  BLOCKED: ['IN_PROGRESS', 'CANCELLED'],
  IN_REVIEW: ['IN_PROGRESS', 'DELIVERED', 'CANCELLED'],
  DELIVERED: ['CLOSED', 'IN_PROGRESS'],
  CLOSED: [],
  CANCELLED: [],
};

export function isAllowedRequestTransition(
  from: ServiceRequestStatus,
  to: ServiceRequestStatus,
): boolean {
  if (from === to) {
    return true;
  }

  return SERVICE_REQUEST_TRANSITIONS[from].includes(to);
}

/** A service a tenant can raise requests under. Tenant-owned, never global. */
export interface ServiceCategory extends Timestamps, TenantScoped, SoftDeletable {
  readonly id: Uuid;
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  readonly isActive: boolean;
}

export interface ServiceRequest extends Timestamps, TenantScoped, SoftDeletable {
  readonly id: Uuid;
  /** Human-facing reference, unique per tenant: `REQ-3F2A91BC`. */
  readonly reference: string;
  readonly categoryId: Uuid | null;
  readonly title: string;
  readonly description: string;
  readonly status: ServiceRequestStatus;
  readonly priority: ServiceRequestPriority;
  readonly requesterId: Uuid;
  readonly assigneeId: Uuid | null;
  readonly dueAt: IsoDateTime | null;
  readonly submittedAt: IsoDateTime | null;
  readonly closedAt: IsoDateTime | null;
}

/** A message on a request. `isInternal` notes are never shown to the client. */
export interface RequestComment extends Timestamps, TenantScoped {
  readonly id: Uuid;
  readonly requestId: Uuid;
  readonly authorId: Uuid;
  readonly body: string;
  readonly isInternal: boolean;
}

/** An output delivered against a request. RELEASED requires human sign-off. */
export interface Deliverable extends Timestamps, TenantScoped, SoftDeletable {
  readonly id: Uuid;
  readonly requestId: Uuid | null;
  readonly title: string;
  readonly description: string | null;
  readonly status: DeliverableStatus;
  readonly fileUrl: string | null;
  /** Storage key for an uploaded asset; null when the file is an external URL. */
  readonly fileKey: string | null;
  /** SHA-256 of the stored bytes, lowercase hex. */
  readonly fileSha256: string | null;
  readonly fileSize: number | null;
  readonly fileMimeType: string | null;
  /** Monotonic content version, starting at 1. Every edit bumps it. */
  readonly version: number;
  /** Staff member who produced this deliverable; null for legacy rows. */
  readonly createdById: Uuid | null;
  readonly approvedById: Uuid | null;
  readonly approvedAt: IsoDateTime | null;
  readonly releasedAt: IsoDateTime | null;
}

/**
 * An immutable snapshot of a deliverable at one version. Version 1 is written when
 * the deliverable is created, and every subsequent edit appends a row — so the
 * history survives even though the deliverable row only holds the current content.
 */
export interface DeliverableVersion extends TenantScoped {
  readonly id: Uuid;
  readonly deliverableId: Uuid;
  readonly version: number;
  readonly title: string;
  readonly description: string | null;
  readonly fileUrl: string | null;
  readonly fileKey: string | null;
  readonly fileSha256: string | null;
  readonly fileSize: number | null;
  readonly fileMimeType: string | null;
  readonly createdById: Uuid | null;
  /** Why the version changed, when the editor said so. */
  readonly changeNote: string | null;
  readonly createdAt: IsoDateTime;
}

/** A released deliverable joined to its request — the client's receipt line. */
export interface DeliveryHistoryEntry {
  readonly deliverableId: Uuid;
  readonly title: string;
  readonly description: string | null;
  readonly fileUrl: string | null;
  readonly version: number;
  readonly releasedAt: IsoDateTime | null;
  readonly requestId: Uuid | null;
  readonly requestReference: string | null;
  readonly requestTitle: string | null;
}

/** Workspace-wide summary of what has actually been handed over. */
export interface DeliveryHistory {
  readonly releasedCount: number;
  readonly requestCount: number;
  readonly latestReleasedAt: IsoDateTime | null;
  readonly entries: readonly DeliveryHistoryEntry[];
}

/**
 * Result of re-reading a stored file from disk and comparing its digest with the
 * one recorded when it was uploaded. `ok: false` means the bytes on disk no longer
 * match what was signed off.
 */
export interface FileIntegrityReport {
  readonly deliverableId: Uuid;
  readonly version: number;
  readonly fileKey: string;
  readonly ok: boolean;
  readonly expectedSha256: string;
  readonly actualSha256: string;
  readonly sizeBytes: number;
  readonly recordedSizeBytes: number | null;
}
