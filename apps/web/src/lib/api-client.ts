import type {
  AccessibleOrganization,
  AnalyticsReport,
  AuthActor,
  CapabilityPod,
  Membership,
  OpsCatalogueRow,
  OpsDeliverableRow,
  OpsNotificationRow,
  OpsRequestRow,
  OpsStaffRow,
  OpsTaskRow,
  OpsTenantRow,
  OpsWorkloadRow,
  ApiErrorBody,
  AuthSession,
  Deliverable,
  Paginated,
  RequestComment,
  ServiceRequest,
  ServiceRequestPriority,
  ServiceRequestStatus,
  ServiceCategory,
  DeliverableVersion,
  DeliveryHistory,
  FileIntegrityReport,
  OpsDashboard,
  PodSummary,
  QueueHealth,
  StaffCandidate,
  SlaSweepReport,
  TaskListItem,
  TaskStatus,
  FinanceOverview,
  Invoice,
  InvoiceDetail,
  InvoiceStatus,
  SubscriptionOverview,
  SubscriptionTier,
} from '@gc3/types';
import { API_BASE_URL } from './config';

/** Thrown for any non-2xx response, carrying the API's error envelope. */
export class ApiClientError extends Error {
  readonly status: number;
  readonly code: ApiErrorBody['code'];

  constructor(status: number, body: ApiErrorBody) {
    super(body.message);
    this.name = 'ApiClientError';
    this.status = status;
    this.code = body.code;
  }
}

export interface RequestOptions {
  readonly method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  readonly body?: unknown;
  /** Bearer token; omit for public endpoints. */
  readonly token?: string;
  /** Tenant scope, sent as `x-organization-id` on tenant routes. */
  readonly organizationId?: string | null;
}

/**
 * The single place that talks to the API from the browser.
 *
 * Both headers live here on purpose: if a caller forgets the tenant header the
 * API answers 400, and if the token is missing it answers 401 — but there is no
 * code path where a component builds its own fetch and silently drops one.
 */
async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { accept: 'application/json' };

  if (options.body !== undefined) {
    headers['content-type'] = 'application/json';
  }

  if (options.token) {
    headers.authorization = `Bearer ${options.token}`;
  }

  if (options.organizationId) {
    headers['x-organization-id'] = options.organizationId;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    headers,
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
    cache: 'no-store',
  });

  const payload = (await response.json().catch(() => null)) as
    | { success: true; data: T }
    | { success: false; error: ApiErrorBody }
    | null;

  // 204 has no body by design (DELETE), so there is nothing to unwrap.
  if (response.status === 204) {
    return undefined as T;
  }

  if (!response.ok || !payload || payload.success === false) {
    const error: ApiErrorBody = payload && payload.success === false
      ? payload.error
      : {
          code: 'INTERNAL_ERROR',
          message: `Request failed with HTTP ${response.status}`,
          requestId: 'unknown',
        };

    throw new ApiClientError(response.status, error);
  }

  return payload.data;
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export async function login(email: string, password: string): Promise<AuthSession> {
  return request<AuthSession>('/auth/login', { method: 'POST', body: { email, password } });
}

export async function fetchOrganizations(token: string): Promise<AccessibleOrganization[]> {
  return request<AccessibleOrganization[]>('/auth/organizations', { token });
}

// ---------------------------------------------------------------------------
// Service requests (all tenant-scoped)
// ---------------------------------------------------------------------------

export interface ListRequestsParams {
  status?: ServiceRequestStatus;
  priority?: ServiceRequestPriority;
  page?: number;
  pageSize?: number;
}

export async function listRequests(
  token: string,
  organizationId: string,
  params: ListRequestsParams = {},
): Promise<Paginated<ServiceRequest>> {
  const search = new URLSearchParams();

  if (params.status) search.set('status', params.status);
  if (params.priority) search.set('priority', params.priority);
  if (params.page) search.set('page', String(params.page));
  if (params.pageSize) search.set('pageSize', String(params.pageSize));

  const query = search.toString();
  return request<Paginated<ServiceRequest>>(`/service-requests${query ? `?${query}` : ''}`, {
    token,
    organizationId,
  });
}

export async function getRequest(
  token: string,
  organizationId: string,
  requestId: string,
): Promise<ServiceRequest> {
  return request<ServiceRequest>(`/service-requests/${requestId}`, { token, organizationId });
}

export interface CreateRequestInput {
  title: string;
  description: string;
  priority: ServiceRequestPriority;
  status: 'DRAFT' | 'SUBMITTED';
}

export async function createRequest(
  token: string,
  organizationId: string,
  input: CreateRequestInput,
): Promise<ServiceRequest> {
  return request<ServiceRequest>('/service-requests', {
    method: 'POST',
    token,
    organizationId,
    body: input,
  });
}

export async function changeRequestStatus(
  token: string,
  organizationId: string,
  requestId: string,
  status: ServiceRequestStatus,
  note?: string,
): Promise<ServiceRequest> {
  return request<ServiceRequest>(`/service-requests/${requestId}/status`, {
    method: 'POST',
    token,
    organizationId,
    body: note ? { status, note } : { status },
  });
}

export async function listComments(
  token: string,
  organizationId: string,
  requestId: string,
): Promise<RequestComment[]> {
  return request<RequestComment[]>(`/service-requests/${requestId}/comments`, {
    token,
    organizationId,
  });
}

export async function addComment(
  token: string,
  organizationId: string,
  requestId: string,
  body: string,
  isInternal = false,
): Promise<RequestComment> {
  return request<RequestComment>(`/service-requests/${requestId}/comments`, {
    method: 'POST',
    token,
    organizationId,
    // The API downgrades isInternal for client actors; sending it is safe.
    body: { body, isInternal },
  });
}

export interface CreateDeliverableInput {
  title: string;
  description?: string;
  fileUrl?: string;
}

/** Staff-only: the API requires `deliverable:create`. */
export async function createDeliverable(
  token: string,
  organizationId: string,
  requestId: string,
  input: CreateDeliverableInput,
): Promise<Deliverable> {
  return request<Deliverable>(`/service-requests/${requestId}/deliverables`, {
    method: 'POST',
    token,
    organizationId,
    body: input,
  });
}

export async function listDeliverables(
  token: string,
  organizationId: string,
  requestId: string,
): Promise<Deliverable[]> {
  return request<Deliverable[]>(`/service-requests/${requestId}/deliverables`, {
    token,
    organizationId,
  });
}

export async function updateDeliverableStatus(
  token: string,
  organizationId: string,
  requestId: string,
  deliverableId: string,
  status: Deliverable['status'],
): Promise<Deliverable> {
  return request<Deliverable>(
    `/service-requests/${requestId}/deliverables/${deliverableId}/status`,
    { method: 'PATCH', token, organizationId, body: { status } },
  );
}

export interface UpdateDeliverableFields {
  title?: string;
  description?: string | null;
  fileUrl?: string | null;
  changeNote?: string;
}

/**
 * Edits or replaces deliverable content. The API answers with the new deliverable
 * plus `approvalReset`, which is true when a prior approval was invalidated.
 */
export async function updateDeliverable(
  token: string,
  organizationId: string,
  requestId: string,
  deliverableId: string,
  input: UpdateDeliverableFields,
): Promise<{ deliverable: Deliverable; approvalReset: boolean }> {
  return request<{ deliverable: Deliverable; approvalReset: boolean }>(
    `/service-requests/${requestId}/deliverables/${deliverableId}`,
    { method: 'PATCH', token, organizationId, body: input },
  );
}

export async function listDeliverableVersions(
  token: string,
  organizationId: string,
  requestId: string,
  deliverableId: string,
): Promise<DeliverableVersion[]> {
  return request<DeliverableVersion[]>(
    `/service-requests/${requestId}/deliverables/${deliverableId}/versions`,
    { token, organizationId },
  );
}

/** Released assets across the workspace — the client-facing delivery history. */
export async function fetchDeliveryHistory(
  token: string,
  organizationId: string,
  limit = 25,
): Promise<DeliveryHistory> {
  return request<DeliveryHistory>(`/deliverables/history?limit=${limit}`, {
    token,
    organizationId,
  });
}

export interface UpdateRequestInput {
  title?: string;
  description?: string;
  priority?: ServiceRequestPriority;
  categoryId?: string | null;
  dueAt?: string | null;
}

/** PATCH /service-requests/:id — content edits while the request is still live. */
export async function updateRequest(
  token: string,
  organizationId: string,
  requestId: string,
  input: UpdateRequestInput,
): Promise<ServiceRequest> {
  return request<ServiceRequest>(`/service-requests/${requestId}`, {
    method: 'PATCH',
    token,
    organizationId,
    body: input,
  });
}

// ---------------------------------------------------------------------------
// Service categories (per-tenant catalogue)
// ---------------------------------------------------------------------------

export async function listCategories(
  token: string,
  organizationId: string,
  includeInactive = false,
): Promise<ServiceCategory[]> {
  const query = includeInactive ? '?includeInactive=true' : '';
  return request<ServiceCategory[]>(`/service-categories${query}`, { token, organizationId });
}

export interface CategoryInput {
  name?: string;
  slug?: string;
  description?: string | null;
  isActive?: boolean;
}

export async function createCategory(
  token: string,
  organizationId: string,
  input: CategoryInput & { name: string },
): Promise<ServiceCategory> {
  return request<ServiceCategory>('/service-categories', {
    method: 'POST',
    token,
    organizationId,
    body: input,
  });
}

export async function updateCategory(
  token: string,
  organizationId: string,
  categoryId: string,
  input: CategoryInput,
): Promise<ServiceCategory> {
  return request<ServiceCategory>(`/service-categories/${categoryId}`, {
    method: 'PATCH',
    token,
    organizationId,
    body: input,
  });
}

export async function deleteCategory(
  token: string,
  organizationId: string,
  categoryId: string,
): Promise<void> {
  await request<void>(`/service-categories/${categoryId}`, {
    method: 'DELETE',
    token,
    organizationId,
  });
}

// ---------------------------------------------------------------------------
// Stored deliverable files
//
// These three bypass the shared `request()` helper on purpose: the payload is
// bytes rather than JSON, so the body and the content-type are set by hand.
// ---------------------------------------------------------------------------

export interface UploadReceipt {
  deliverable: Deliverable;
  approvalReset: boolean;
  integrity: { sha256: string; sizeBytes: number; mimeType: string; fileKey: string };
}

/** Uploads the file's bytes as the request body (no multipart layer). */
export async function uploadDeliverableFile(
  token: string,
  organizationId: string,
  requestId: string,
  deliverableId: string,
  file: File,
  note?: string,
): Promise<UploadReceipt> {
  const query = note ? `?note=${encodeURIComponent(note)}` : '';

  const response = await fetch(
    `${API_BASE_URL}/service-requests/${requestId}/deliverables/${deliverableId}/file${query}`,
    {
      method: 'PUT',
      headers: {
        authorization: `Bearer ${token}`,
        'x-organization-id': organizationId,
        'content-type': file.type || 'application/octet-stream',
      },
      body: file,
    },
  );

  const payload = (await response.json().catch(() => null)) as
    | { success: true; data: UploadReceipt }
    | { success: false; error: ApiErrorBody }
    | null;

  if (!response.ok || !payload || payload.success === false) {
    throw new ApiClientError(
      response.status,
      payload && payload.success === false
        ? payload.error
        : {
            code: 'INTERNAL_ERROR',
            message: `Upload failed with HTTP ${response.status}`,
            requestId: 'unknown',
          },
    );
  }

  return payload.data;
}

/** Fetches the stored bytes as a Blob, ready to save from the browser. */
export async function downloadDeliverableFile(
  token: string,
  organizationId: string,
  deliverableId: string,
): Promise<Blob> {
  const response = await fetch(`${API_BASE_URL}/deliverables/${deliverableId}/file`, {
    headers: {
      authorization: `Bearer ${token}`,
      'x-organization-id': organizationId,
    },
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { success: false; error: ApiErrorBody }
      | null;

    throw new ApiClientError(
      response.status,
      payload?.error ?? {
        code: 'INTERNAL_ERROR',
        message: `Download failed with HTTP ${response.status}`,
        requestId: 'unknown',
      },
    );
  }

  return response.blob();
}

/** Re-reads the stored file and compares its digest with the recorded one. */
export async function fetchFileIntegrity(
  token: string,
  organizationId: string,
  deliverableId: string,
): Promise<FileIntegrityReport> {
  return request<FileIntegrityReport>(`/deliverables/${deliverableId}/file/integrity`, {
    token,
    organizationId,
  });
}

// ---------------------------------------------------------------------------
// Operations console (Phase 3)
// ---------------------------------------------------------------------------

/**
 * The cross-tenant summary. No `organizationId` on purpose — this call is
 * platform-scoped, and the API refuses it for anyone without `ops:read`.
 */
export async function fetchOpsDashboard(
  token: string,
  options: { organizationId?: string; queueLimit?: number } = {},
): Promise<OpsDashboard> {
  const query = new URLSearchParams();

  if (options.organizationId) {
    query.set('organizationId', options.organizationId);
  }

  if (options.queueLimit) {
    query.set('queueLimit', String(options.queueLimit));
  }

  const suffix = query.toString() ? `?${query.toString()}` : '';
  return request<OpsDashboard>(`/ops/dashboard${suffix}`, { token });
}

/** Pods in the active tenant, with member and load counts. */
export async function listPods(token: string, organizationId: string): Promise<PodSummary[]> {
  return request<PodSummary[]>('/pods', { token, organizationId });
}

export interface CreatePodInput {
  readonly name: string;
  readonly description?: string;
  readonly memberIds?: readonly string[];
}

export async function createPod(
  token: string,
  organizationId: string,
  input: CreatePodInput,
): Promise<PodSummary> {
  return request<PodSummary>('/pods', { method: 'POST', body: input, token, organizationId });
}

/** The routing decision: send a request into a pod, or clear the assignment. */
export async function assignRequest(
  token: string,
  organizationId: string,
  requestId: string,
  input: { podId?: string | null; assigneeId?: string | null },
): Promise<ServiceRequest> {
  return request<ServiceRequest>(`/service-requests/${requestId}/assign`, {
    method: 'PATCH',
    body: input,
    token,
    organizationId,
  });
}

/** Staff accounts that can be seated in a pod, with how many pods they are in. */
export async function fetchStaffCandidates(
  token: string,
  organizationId: string,
): Promise<StaffCandidate[]> {
  return request<StaffCandidate[]>('/pods/staff', { token, organizationId });
}

/** Seat a person in a pod; returns the updated pod roster. */
export async function addPodMember(
  token: string,
  organizationId: string,
  podId: string,
  userId: string,
): Promise<PodSummary | null> {
  return request<PodSummary | null>(`/pods/${podId}/members`, {
    method: 'POST',
    body: { userId },
    token,
    organizationId,
  });
}

/** Remove a person from a pod (204, so nothing comes back). */
export async function removePodMember(
  token: string,
  organizationId: string,
  podId: string,
  userId: string,
): Promise<void> {
  return request<void>(`/pods/${podId}/members/${userId}`, {
    method: 'DELETE',
    token,
    organizationId,
  });
}

// ---------------------------------------------------------------------------
// Internal tasks (Phase 3)
// ---------------------------------------------------------------------------

/** Staff-only: the internal checklist for one request. A client gets 403. */export async function listTasks(
  token: string,
  organizationId: string,
  requestId: string,
): Promise<TaskListItem[]> {
  return request<TaskListItem[]>(`/service-requests/${requestId}/tasks`, { token, organizationId });
}

export interface CreateTaskInput {
  readonly title: string;
  readonly description?: string;
  readonly assigneeId?: string;
  readonly dueAt?: string;
}

export async function createTask(
  token: string,
  organizationId: string,
  requestId: string,
  input: CreateTaskInput,
): Promise<TaskListItem> {
  return request<TaskListItem>(`/service-requests/${requestId}/tasks`, {
    method: 'POST',
    body: input,
    token,
    organizationId,
  });
}

export interface UpdateTaskInput {
  readonly title?: string;
  readonly status?: TaskStatus;
  readonly assigneeId?: string | null;
  readonly dueAt?: string | null;
}

export async function updateTask(
  token: string,
  organizationId: string,
  taskId: string,
  input: UpdateTaskInput,
): Promise<TaskListItem> {
  return request<TaskListItem>(`/tasks/${taskId}`, {
    method: 'PATCH',
    body: input,
    token,
    organizationId,
  });
}

/**
 * Runs the SLA risk engine now. The same pass the interval worker runs — this is
 * a platform action, so no tenant header, and the API gates it on `ops:read`.
 */
export async function runSlaSweep(
  token: string,
  organizationId?: string,
): Promise<SlaSweepReport> {
  const suffix = organizationId ? `?organizationId=${organizationId}` : '';
  return request<SlaSweepReport>(`/ops/sla/sweep${suffix}`, { method: 'POST', token });
}

// ---------------------------------------------------------------------------
// Finance (Phase 4)
// ---------------------------------------------------------------------------

/** The tenant's plan, allowances and this period's metered usage. */
export async function fetchSubscription(
  token: string,
  organizationId: string,
): Promise<SubscriptionOverview> {
  return request<SubscriptionOverview>('/subscription', { token, organizationId });
}

export async function fetchTiers(token: string, organizationId: string): Promise<SubscriptionTier[]> {
  return request<SubscriptionTier[]>('/subscription/tiers', { token, organizationId });
}

export async function listInvoices(
  token: string,
  organizationId: string,
  params: { status?: InvoiceStatus; page?: number; pageSize?: number } = {},
): Promise<Paginated<Invoice>> {
  const query = new URLSearchParams();

  if (params.status) {
    query.set('status', params.status);
  }

  if (params.page) {
    query.set('page', String(params.page));
  }

  if (params.pageSize) {
    query.set('pageSize', String(params.pageSize));
  }

  const suffix = query.toString() ? `?${query.toString()}` : '';
  return request<Paginated<Invoice>>(`/invoices${suffix}`, { token, organizationId });
}

export async function fetchInvoice(
  token: string,
  organizationId: string,
  invoiceId: string,
): Promise<InvoiceDetail> {
  return request<InvoiceDetail>(`/invoices/${invoiceId}`, { token, organizationId });
}

export async function generateInvoice(
  token: string,
  organizationId: string,
  body: { period?: string; notes?: string | null } = {},
): Promise<InvoiceDetail> {
  return request<InvoiceDetail>('/invoices/generate', {
    method: 'POST',
    body,
    token,
    organizationId,
  });
}

export async function changeInvoiceStatus(
  token: string,
  organizationId: string,
  invoiceId: string,
  status: 'ISSUED' | 'PAID' | 'VOID',
  note?: string,
): Promise<InvoiceDetail> {
  return request<InvoiceDetail>(`/invoices/${invoiceId}/status`, {
    method: 'PATCH',
    body: note ? { status, note } : { status },
    token,
    organizationId,
  });
}

/** Platform money view: MRR, tier mix, invoice counts, recent bills. */
export async function fetchFinanceOverview(token: string): Promise<FinanceOverview> {
  return request<FinanceOverview>('/ops/billing', { token });
}

/**
 * Downloads the printable invoice.
 *
 * Fetched rather than linked: the endpoint needs the bearer token, and a plain
 * `<a href>` cannot send one. The bytes come back as text, become a Blob, and are
 * handed to the browser as a file so the user gets the same document the API
 * renders.
 */
export async function downloadInvoice(
  token: string,
  organizationId: string,
  invoice: { id: string; number: string },
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/invoices/${invoice.id}/download`, {
    headers: { authorization: `Bearer ${token}`, 'x-organization-id': organizationId },
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new ApiClientError(response.status, {
      code: 'INTERNAL_ERROR',
      message: `Could not download ${invoice.number}`,
      requestId: 'client',
    });
  }

  const text = await response.text();
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${invoice.number}.txt`;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Operational observability (Phase 5)
// ---------------------------------------------------------------------------

/**
 * Queue depth, worker heartbeat and alert flags.
 *
 * Read on the operations console because a queue that has stopped working looks
 * exactly like a queue with nothing to do — until you ask for the heartbeat.
 */
export async function fetchQueueHealth(token: string): Promise<QueueHealth> {
  return request<QueueHealth>('/ops/queue/stats', { token });
}

/**
 * The executive report: turnaround, throughput, pod efficiency, tenant growth.
 *
 * `windowDays` bounds the flow figures (7–365). Totals are current, not windowed.
 */
export async function fetchAnalytics(
  token: string,
  windowDays = 90,
): Promise<AnalyticsReport> {
  return request<AnalyticsReport>(`/ops/analytics?windowDays=${windowDays}`, { token });
}

// ---------------------------------------------------------------------------
// Client workspace (Phase 6 — client owner & member surfaces)
// ---------------------------------------------------------------------------

/** The authenticated actor, as the API sees it. Used by Profile / Settings. */
export async function fetchMe(token: string): Promise<AuthActor> {
  // The endpoint answers `{ actor, permissions }`; callers want the actor, and
  // assuming a flat body here is exactly how a profile screen renders blanks.
  const payload = await request<{ readonly actor: AuthActor }>('/auth/me', { token });

  return payload.actor;
}

/**
 * A roster row as the API returns it: the membership flattened, with the person's
 * email and name alongside. The endpoint wraps these in a `Paginated` envelope,
 * so `listMemberships` unwraps that and callers get an array they can map.
 */
export type MembershipListItem = Membership & {
  readonly user: { readonly email: string; readonly fullName: string };
};

/** Team roster for one tenant. Requires `membership:read` (client owners hold it). */
export async function listMemberships(
  token: string,
  organizationId: string,
): Promise<readonly MembershipListItem[]> {
  const page = await request<Paginated<MembershipListItem>>(
    `/organizations/${organizationId}/memberships`,
    { token, organizationId },
  );

  return page.items;
}

// ---------------------------------------------------------------------------
// Staff dashboards (Phase 7) — the cross-tenant reads behind /ops
// ---------------------------------------------------------------------------

export async function opsOrganizations(token: string): Promise<readonly OpsTenantRow[]> {
  return request<readonly OpsTenantRow[]>('/ops/organizations', { token });
}

export async function opsStaff(token: string): Promise<readonly OpsStaffRow[]> {
  return request<readonly OpsStaffRow[]>('/ops/staff', { token });
}

export async function opsRequests(
  token: string,
  options: { status?: string; limit?: number } = {},
): Promise<readonly OpsRequestRow[]> {
  const query = new URLSearchParams();
  if (options.status) query.set('status', options.status);
  if (options.limit) query.set('limit', String(options.limit));

  const suffix = query.size > 0 ? `?${query.toString()}` : '';

  return request<readonly OpsRequestRow[]>(`/ops/requests${suffix}`, { token });
}

export async function opsDeliverables(
  token: string,
  options: { status?: string; limit?: number } = {},
): Promise<readonly OpsDeliverableRow[]> {
  const query = new URLSearchParams();
  if (options.status) query.set('status', options.status);
  if (options.limit) query.set('limit', String(options.limit));

  const suffix = query.size > 0 ? `?${query.toString()}` : '';

  return request<readonly OpsDeliverableRow[]>(`/ops/deliverables${suffix}`, { token });
}

export async function opsTasks(
  token: string,
  options: { status?: string; mine?: boolean; limit?: number } = {},
): Promise<readonly OpsTaskRow[]> {
  const query = new URLSearchParams();
  if (options.status) query.set('status', options.status);
  if (options.mine) query.set('mine', 'true');
  if (options.limit) query.set('limit', String(options.limit));

  const suffix = query.size > 0 ? `?${query.toString()}` : '';

  return request<readonly OpsTaskRow[]>(`/ops/tasks${suffix}`, { token });
}

export async function opsWorkload(token: string): Promise<readonly OpsWorkloadRow[]> {
  return request<readonly OpsWorkloadRow[]>('/ops/workload', { token });
}

export async function opsCatalogue(token: string): Promise<readonly OpsCatalogueRow[]> {
  return request<readonly OpsCatalogueRow[]>('/ops/catalogue', { token });
}

export async function opsNotifications(token: string): Promise<readonly OpsNotificationRow[]> {
  return request<readonly OpsNotificationRow[]>('/ops/notifications', { token });
}

/** Requests behind the caller's own work — no tenant parameter exists. */
export async function opsMyRequests(token: string): Promise<readonly OpsRequestRow[]> {
  return request<readonly OpsRequestRow[]>('/ops/my/requests', { token });
}

/** Deliverables produced against the caller's own work. */
export async function opsMyDeliverables(token: string): Promise<readonly OpsDeliverableRow[]> {
  return request<readonly OpsDeliverableRow[]>('/ops/my/deliverables', { token });
}

export async function opsPods(token: string, organizationId: string): Promise<readonly PodSummary[]> {
  return request<readonly PodSummary[]>('/pods', { token, organizationId });
}

/**
 * The commercial catalogue. Public — a price list is a document you hand to a
 * prospect, so this call works with no session at all.
 */
export async function fetchPods(token?: string | null): Promise<readonly CapabilityPod[]> {
  return request<readonly CapabilityPod[]>('/pricing/pods', token ? { token } : {});
}

export interface DemoRequestInput {
  readonly email: string;
  readonly fullName: string;
  readonly companyName: string;
  readonly companySize: '1-10' | '11-50' | '51-200' | '201-1000' | '1000+';
  readonly message?: string;
  readonly source?: string;
}

/**
 * Public: the "Book a demo" form. No token, because the person filling it in has no
 * account yet — which is the whole point of the form.
 */
export async function requestDemo(input: DemoRequestInput): Promise<{ id: string }> {
  return request<{ id: string }>('/demo-requests', { method: 'POST', body: input });
}
