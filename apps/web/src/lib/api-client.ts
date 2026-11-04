import type {
  AccessibleOrganization,
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
