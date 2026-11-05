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
  | 'LIMIT_EXCEEDED'
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
  | 'deliverable:review'
  | 'notification:read'
  | 'notification:manage'
  | 'request:assign'
  | 'pod:manage'
  | 'task:read'
  | 'task:manage'
  | 'finance:read'
  | 'finance:manage'
  | 'ops:read';

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

/**
 * Where a request stands against its delivery commitment.
 *
 * NONE      — no obligation is being judged (draft, cancelled, or no target)
 * ON_TRACK  — comfortably inside the window
 * AT_RISK   — inside the warning window, not yet late
 * BREACHED  — past the target and still open
 * MET       — closed at or before the target
 * MISSED    — closed after the target
 */
export type SlaState = 'NONE' | 'ON_TRACK' | 'AT_RISK' | 'BREACHED' | 'MET' | 'MISSED';

/** Outcome of one SLA sweep. */
export interface SlaSweepReport {
  /** Open requests with a target that the sweep looked at. */
  readonly scanned: number;
  readonly atRisk: number;
  readonly breached: number;
  /** Alerts actually dispatched this run (state changed since the last one). */
  readonly alerted: number;
  /** Risky requests with nobody to tell — assignee, pod lead both absent. */
  readonly skipped: number;
}

/** Internal work item states. A task is open while TODO, IN_PROGRESS or BLOCKED. */
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE' | 'CANCELLED';
export const OPEN_TASK_STATUSES: readonly TaskStatus[] = ['TODO', 'IN_PROGRESS', 'BLOCKED'];

/**
 * A unit of internal work carved out of a request. Tasks are staff-only: they are
 * the pod's own breakdown, never part of what the client sees.
 */
export interface Task extends Timestamps, TenantScoped, SoftDeletable {
  readonly id: Uuid;
  readonly requestId: Uuid;
  /** Pod that owns the work item; usually inherited from the request. */
  readonly podId: Uuid | null;
  readonly assigneeId: Uuid | null;
  readonly createdById: Uuid | null;
  readonly title: string;
  readonly description: string | null;
  readonly status: TaskStatus;
  readonly dueAt: IsoDateTime | null;
}
/** A task as the API returns it, with the names the UI needs to render. */
export interface TaskListItem extends Task {
  readonly assigneeName: string | null;
  readonly podName: string | null;
}

/** A service a tenant can raise requests under. Tenant-owned, never global. */
export interface ServiceCategory extends Timestamps, TenantScoped, SoftDeletable {
  readonly id: Uuid;
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  readonly isActive: boolean;
  /** Service-specific delivery commitment in hours; null uses the priority default. */
  readonly slaDeliveryHours: number | null;
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
  /** Delivery pod that owns execution. Set by the routing handler. */
  readonly podId: Uuid | null;
  readonly dueAt: IsoDateTime | null;
  readonly submittedAt: IsoDateTime | null;
  readonly closedAt: IsoDateTime | null;
  /** Materialised delivery commitment; null means no obligation is tracked. */
  readonly slaTargetAt: IsoDateTime | null;
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

/** Result of re-reading a stored file from disk and comparing its digest with the
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

/** One row of the delivery audit, as the administrative API returns it. */
export interface NotificationDeliveryRecord {
  readonly id: Uuid;
  readonly organizationId: Uuid;
  readonly membershipId: Uuid | null;
  readonly userId: Uuid;
  readonly kind:
    | 'INVITATION'
    | 'RESENT'
    | 'DELIVERABLE_RELEASED'
    | 'REQUEST_STATUS_UPDATED'
    | 'SLA_RISK';
  readonly channel: string;
  readonly driver: string;
  readonly status: 'SENT' | 'FAILED' | 'SKIPPED';
  readonly recipient: string;
  readonly messageId: string | null;
  readonly error: string | null;
  /** 1 for the original attempt, incrementing with each retry in the chain. */
  readonly attempt: number;
  /** Set on a failed attempt that is still scheduled for another try. */
  readonly nextAttemptAt: IsoDateTime | null;
  readonly lastAttemptAt: IsoDateTime | null;
  readonly createdAt: IsoDateTime;
}

export interface NotificationDeliverySummary {
  readonly sent: number;
  readonly failed: number;
  readonly skipped: number;
  /** Failed rows currently waiting on a scheduled retry. */
  readonly pendingRetry: number;
}

export interface NotificationDeliveryPage {
  readonly items: readonly NotificationDeliveryRecord[];
  readonly page: number;
  readonly pageSize: number;
  readonly total: number;
  readonly summary: NotificationDeliverySummary;
}

/** Outcome of one retry sweep. */
export interface RetrySweepReport {
  /** Failed rows that were due and picked up. */
  readonly processed: number;
  readonly sent: number;
  /** Retried again but still failing; they are back in the queue. */
  readonly failed: number;
  /** Failed and out of attempts — the chain is over. */
  readonly exhausted: number;
  /** Could not be retried because the invitation is no longer outstanding. */
  readonly skipped: number;
}

/**
 * A delivery pod: the standing team inside one tenant that owns execution of
 * requests. Tenant-owned like everything else — pods never span organizations.
 */
export interface Pod extends Timestamps, TenantScoped, SoftDeletable {
  readonly id: Uuid;
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  /** Staff user who leads the pod. */
  readonly leadId: Uuid | null;
  readonly isActive: boolean;
}

/** A pod with the numbers an operations view needs beside it. */
export interface PodSummary extends Pod {
  readonly memberCount: number;
  readonly openRequests: number;
  /** Open internal tasks belonging to this pod. */
  readonly openTasks: number;
  readonly members: readonly PodMemberSummary[];
}

/** One person seated in a pod, with the load they are carrying. */
export interface PodMemberSummary {
  readonly userId: Uuid;
  readonly fullName: string;
  readonly email: string;
  readonly platformRole: StaffRole | null;
  /** Open work items (TODO, IN_PROGRESS, BLOCKED) assigned to this person. */
  readonly openTasks: number;
  /** Open service requests this person owns. */
  readonly openRequests: number;
  readonly seatedAt: IsoDateTime;
}

/** A staff account that can be seated in a pod. */
export interface StaffCandidate {
  readonly userId: Uuid;
  readonly fullName: string;
  readonly email: string;
  readonly platformRole: StaffRole;
  /** Pods this person already sits in, inside the current tenant. */
  readonly podCount: number;
}

/** Per-tenant row of the operations dashboard. */
export interface OpsOrganizationSummary {
  readonly organizationId: Uuid;
  readonly name: string;
  readonly slug: string;
  readonly status: OrganizationStatus;
  readonly openRequests: number;
  readonly blockedRequests: number;
  readonly overdueRequests: number;
  readonly unassignedRequests: number;
  readonly podCount: number;
  readonly memberCount: number;
  readonly releasedDeliverables: number;
  /** Open requests inside the SLA warning window. */
  readonly slaAtRisk: number;
  /** Open requests already past their delivery commitment. */
  readonly slaBreached: number;
}

/** A request waiting on a routing decision. */
export interface OpsQueueItem {
  readonly requestId: Uuid;
  readonly reference: string;
  readonly title: string;
  readonly organizationId: Uuid;
  readonly organizationName: string;
  readonly status: ServiceRequestStatus;
  readonly priority: ServiceRequestPriority;
  readonly dueAt: IsoDateTime | null;
  readonly podId: Uuid | null;
  readonly podName: string | null;
  readonly assigneeId: Uuid | null;
  readonly assigneeName: string | null;
  /** Where this request stands against its delivery commitment. */
  readonly slaTargetAt: IsoDateTime | null;
  readonly slaState: SlaState;
}

export interface OpsPodSummary extends PodSummary {
  readonly organizationName: string;
}

/**
 * Cross-tenant operations summary. Platform-scoped by definition: it is only
 * served to callers holding `ops:read`, and never takes a tenant header.
 */
export interface OpsDashboard {
  readonly generatedAt: IsoDateTime;
  readonly totals: {
    readonly organizations: number;
    readonly openRequests: number;
    readonly blockedRequests: number;
    readonly overdueRequests: number;
    readonly unassignedRequests: number;
    readonly pods: number;
    readonly releasedDeliverables: number;
    readonly slaAtRisk: number;
    readonly slaBreached: number;
  };
  readonly organizations: readonly OpsOrganizationSummary[];
  readonly pods: readonly OpsPodSummary[];
  readonly queue: readonly OpsQueueItem[];
}

// ---------------------------------------------------------------------------
// Phase 4 — Finance: subscriptions, usage and invoices
//
// All money is integer minor units (paise). Nothing in this section is a float,
// so an invoice totals the same on every machine.
// ---------------------------------------------------------------------------

export type SubscriptionStatus = 'ACTIVE' | 'PAST_DUE' | 'SUSPENDED' | 'CANCELLED';
export type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'PAID' | 'OVERDUE' | 'VOID';
export type InvoiceLineItemKind = 'TIER_FEE' | 'USAGE' | 'ADJUSTMENT';
/** What the platform meters. Storage is counted in KB to stay inside int range. */
export type UsageMeterKey = 'REQUESTS' | 'STORAGE_KB' | 'API_CALLS';

/**
 * The platform's price list. Global by design — every tenant is offered the same
 * tiers, which is why this is the one entity here without an organizationId.
 */
export interface SubscriptionTier extends Timestamps {
  readonly id: Uuid;
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
  readonly monthlyPriceCents: number;
  readonly currency: string;
  readonly requestsIncluded: number;
  readonly storageMbIncluded: number;
  readonly apiCallsIncluded: number;
  readonly seatsIncluded: number;
  readonly requestOverageCents: number;
  readonly storageMbOverageCents: number;
  readonly apiCallsOverageCentsPer1k: number;
  readonly isActive: boolean;
  readonly sortOrder: number;
}

export interface OrganizationSubscription extends Timestamps {
  readonly id: Uuid;
  readonly organizationId: Uuid;
  readonly tierId: Uuid;
  readonly status: SubscriptionStatus;
  readonly currentPeriodStart: IsoDateTime;
  readonly currentPeriodEnd: IsoDateTime;
  readonly startedAt: IsoDateTime;
  readonly cancelledAt: IsoDateTime | null;
}

/** One meter against its allowance. */
export interface UsageMeterSnapshot {
  readonly key: UsageMeterKey;
  /** Used in this period, in the meter's own unit (requests, MB, calls). */
  readonly quantity: number;
  readonly included: number;
  /** Hard stop, or null when the meter is not capped. */
  readonly limit: number | null;
  readonly remaining: number;
  readonly percentUsed: number;
  readonly state: 'OK' | 'WARNING' | 'EXCEEDED';
  readonly unit: 'requests' | 'MB' | 'calls';
}

/** What a tenant sees on its billing page. */
export interface SubscriptionOverview {
  readonly subscription: OrganizationSubscription;
  readonly tier: SubscriptionTier;
  readonly period: { readonly start: IsoDateTime; readonly end: IsoDateTime; readonly label: string };
  readonly usage: readonly UsageMeterSnapshot[];
}

export interface InvoiceLineItem {
  readonly id: Uuid;
  readonly invoiceId: Uuid;
  readonly kind: InvoiceLineItemKind;
  readonly description: string;
  readonly quantity: number;
  readonly unitAmountCents: number;
  readonly amountCents: number;
  /** Which meter produced this line, when it came from usage. */
  readonly meterKey: string | null;
}

export interface Invoice extends Timestamps, TenantScoped {
  readonly id: Uuid;
  /** Per-tenant sequence: INV-2026-11-0001. */
  readonly number: string;
  readonly status: InvoiceStatus;
  readonly periodStart: IsoDateTime;
  readonly periodEnd: IsoDateTime;
  readonly currency: string;
  readonly subtotalCents: number;
  readonly taxCents: number;
  readonly totalCents: number;
  readonly notes: string | null;
  readonly issuedAt: IsoDateTime | null;
  readonly dueAt: IsoDateTime | null;
  readonly paidAt: IsoDateTime | null;
  readonly paidByUserId: Uuid | null;
  readonly voidedAt: IsoDateTime | null;
}

export interface InvoiceDetail extends Invoice {
  readonly lineItems: readonly InvoiceLineItem[];
}

/** Platform-wide finance view for the operations console. */
export interface FinanceOverview {
  readonly generatedAt: IsoDateTime;
  /** Recurring revenue from active subscriptions, in minor units. */
  readonly mrrCents: number;
  readonly organizations: number;
  readonly byTier: readonly {
    readonly tierCode: string;
    readonly tierName: string;
    readonly organizations: number;
    readonly mrrCents: number;
  }[];
  readonly invoices: {
    readonly draft: number;
    readonly issued: number;
    readonly paid: number;
    readonly overdue: number;
    readonly void: number;
    /** Issued + overdue, i.e. billed but not settled. */
    readonly outstandingCents: number;
    readonly paidCents: number;
  };
  readonly recent: readonly (Invoice & { readonly organizationName: string })[];
  /** Every tenant with its plan, so finance can bill from one screen. */
  readonly tenants: readonly {
    readonly id: Uuid;
    readonly name: string;
    readonly tierCode: string | null;
    readonly tierName: string | null;
    readonly status: SubscriptionStatus | null;
    readonly mrrCents: number;
    readonly requestsThisPeriod: number;
    readonly storageMbThisPeriod: number;
  }[];
}

// ---------------------------------------------------------------------------
// Phase 5 — Operational observability
// ---------------------------------------------------------------------------

export type QueueAlertLevel = 'INFO' | 'WARNING' | 'CRITICAL';

/** Why a queue is flagged. Each code maps to one operational action. */
export type QueueAlertCode =
  | 'DURABLE_DISPATCH_DISABLED'
  | 'WORKER_HEARTBEAT_MISSING'
  | 'WORKER_HEARTBEAT_STALE'
  | 'QUEUE_PAUSED'
  | 'QUEUE_BACKLOG'
  | 'JOBS_FAILING'
  | 'SCHEDULER_MISSING';

export interface QueueAlert {
  readonly code: QueueAlertCode;
  readonly level: QueueAlertLevel;
  /** What is wrong, in one sentence an operator can act on. */
  readonly message: string;
}

export interface QueueSchedulerInfo {
  readonly id: string;
  readonly everyMs: number | null;
  /** Epoch ms of the next scheduled run, when the driver knows it. */
  readonly nextRunAt: number | null;
}

export type WorkerStatus = 'UP' | 'STALE' | 'ABSENT' | 'INLINE';

export interface WorkerHeartbeatInfo {
  /** UP = beats in time, STALE = missed its window, ABSENT = never beat, INLINE = in-process timers. */
  readonly status: WorkerStatus;
  readonly lastSeenAt: IsoDateTime | null;
  readonly ageSeconds: number | null;
  readonly pid: number | null;
  readonly hostname: string | null;
  readonly startedAt: IsoDateTime | null;
  readonly intervalSeconds: number;
}

export interface QueueHealth {
  /** Which driver is actually running: the durable queue or in-process timers. */
  readonly driver: 'redis' | 'memory';
  readonly queueName: string;
  readonly counts: {
    readonly waiting: number;
    readonly active: number;
    readonly delayed: number;
    readonly failed: number;
    readonly completed: number;
  };
  readonly paused: boolean;
  readonly schedulers: readonly QueueSchedulerInfo[];
  readonly worker: WorkerHeartbeatInfo;
  readonly alerts: readonly QueueAlert[];
  readonly checkedAt: IsoDateTime;
}

// ---------------------------------------------------------------------------
// Phase 5 — Executive analytics
// ---------------------------------------------------------------------------

/** One time bucket of request flow: what came in, what went out. */
export interface ThroughputBucket {
  /** ISO date (or YYYY-MM-DD) the bucket starts on. */
  readonly bucket: string;
  /** Short human label: "03 Nov" or "Nov". */
  readonly label: string;
  readonly created: number;
  readonly closed: number;
}

/** How well one pod is turning work around. */
export interface PodEfficiencyRow {
  readonly podId: Uuid;
  readonly podName: string;
  readonly openRequests: number;
  readonly closedRequests: number;
  /** Mean age of the work still open, in hours. Null when nothing is open. */
  readonly avgOpenAgeHours: number | null;
  /** Closed inside its SLA commitment. Only counted where a target exists. */
  readonly onTime: number;
  readonly late: number;
  /** onTime / (onTime + late), or null when nothing measurable has closed. */
  readonly onTimeRate: number | null;
}

export interface TenantGrowthRow {
  /** YYYY-MM. */
  readonly month: string;
  readonly label: string;
  readonly newTenants: number;
  /** Tenants on the platform by the end of that month. */
  readonly cumulative: number;
}

export interface AnalyticsReport {
  readonly generatedAt: IsoDateTime;
  readonly windowDays: number;
  readonly windowStart: IsoDateTime;
  readonly totals: {
    readonly requests: number;
    readonly openRequests: number;
    readonly closedRequests: number;
    readonly tenants: number;
    /** Tenants that have raised at least one request. */
    readonly activeTenants: number;
    readonly pods: number;
  };
  readonly turnaround: {
    /** Requests that closed inside the window — the sample the numbers come from. */
    readonly sampled: number;
    readonly avgHours: number | null;
    readonly medianHours: number | null;
    readonly p90Hours: number | null;
    readonly onTime: number;
    readonly late: number;
    /** Of the closed requests with an SLA target. Null when none had one. */
    readonly onTimeRate: number | null;
  };
  readonly throughput: readonly ThroughputBucket[];
  readonly pods: readonly PodEfficiencyRow[];
  readonly tenantGrowth: readonly TenantGrowthRow[];
}
