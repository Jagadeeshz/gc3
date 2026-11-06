import { Router } from 'express';
import type {
  AnalyticsReport,
  ApiSuccess,
  AuditLogPage,
  FinanceOverview,
  OpsCatalogueRow,
  OpsDashboard,
  OpsDeliverableRow,
  OpsNotificationRow,
  OpsRequestRow,
  OpsStaffRow,
  OpsTaskRow,
  OpsTenantRow,
  OpsWorkloadRow,
  QueueHealth,
  SlaSweepReport,
} from '@gc3/types';
import {
  analyticsQuerySchema,
  auditQuerySchema,
  formatIssues,
  opsBoardQuerySchema,
  opsDashboardQuerySchema,
  opsDeliverableQuerySchema,
  opsListQuerySchema,
  opsTaskQuerySchema,
} from '@gc3/validation';
import { ApiError } from '../../lib/api-error';
import { requireAuth, requirePermission } from '../../middleware/auth';
import { auditRepository } from '../../audit/audit-log';
import { queueHealth } from '../../observability/queue-health';
import { analyticsRepository } from '../../repositories/analytics.repository';
import { opsDirectoryRepository } from '../../repositories/ops-directory.repository';
import { staffPermissions } from '../../auth/permissions';
import { invoiceRepository } from '../../repositories/invoice.repository';
import { opsRepository } from '../../repositories/ops.repository';
import { runSlaSweep } from '../../sla/monitor';

/**
 * Staff operations console (Phase 3).
 *
 * Deliberately mounted WITHOUT `requireTenantScope`: this is the one summary that
 * spans organizations, so the boundary is the permission (`ops:read`, held only by
 * PLATFORM_ADMIN and OPERATIONS_MANAGER) rather than a tenant header. An operator
 * can narrow it to a single tenant with `?organizationId=`, but they cannot widen
 * anything else in the platform this way.
 */
export const opsRouter: Router = Router();

opsRouter.use(requireAuth);

/** GET /ops/dashboard — cross-tenant operational summary. */
opsRouter.get('/dashboard', requirePermission('ops:read'), async (request, response) => {
  const query = opsDashboardQuerySchema.safeParse(request.query);

  if (!query.success) {
    throw ApiError.badRequest('Invalid dashboard query', formatIssues(query.error));
  }

  const dashboard = await opsRepository.dashboard({
    queueLimit: query.data.queueLimit,
    ...(query.data.organizationId ? { organizationId: query.data.organizationId } : {}),
  });

  const payload: ApiSuccess<OpsDashboard> = { success: true, data: dashboard };
  response.status(200).json(payload);
});

/**
 * GET /ops/audit — the security log: role changes, tenant edits, invoice and
 * subscription movements, newest first.
 *
 * Cross-tenant by design (a security review needs to see everything), narrowed
 * with `?organizationId=`; the boundary is `ops:read`.
 */
opsRouter.get('/audit', requirePermission('security:read'), async (request, response) => {
  const query = auditQuerySchema.safeParse(request.query);

  if (!query.success) {
    throw ApiError.badRequest('Invalid audit query', formatIssues(query.error));
  }

  const page = await auditRepository.list({
    organizationId: query.data.organizationId ?? null,
    ...(query.data.action ? { action: query.data.action } : {}),
    ...(query.data.actorId ? { actorId: query.data.actorId } : {}),
    ...(query.data.since ? { since: new Date(query.data.since) } : {}),
    page: query.data.page,
    pageSize: query.data.pageSize,
  });

  const payload: ApiSuccess<AuditLogPage> = { success: true, data: page };
  response.status(200).json(payload);
});

/**
 * GET /ops/analytics — the platform report: turnaround, throughput, pod
 * efficiency and tenant growth.
 *
 * `?windowDays=` bounds the flow figures (7–365, default 90); totals describe the
 * platform as it stands, which is not a time-boxed question.
 */
opsRouter.get('/analytics', requirePermission('ops:read'), async (request, response) => {
  const query = analyticsQuerySchema.safeParse(request.query);

  if (!query.success) {
    throw ApiError.badRequest('Invalid analytics query', formatIssues(query.error));
  }

  const report = await analyticsRepository.report({ windowDays: query.data.windowDays });

  const payload: ApiSuccess<AnalyticsReport> = { success: true, data: report };
  response.status(200).json(payload);
});

/**
 * GET /ops/queue/stats — is the background work actually running?
 *
 * Counts alone cannot answer that: a worker that died leaves jobs in `waiting`
 * and looks busy. The heartbeat is the part that tells the truth, which is why a
 * missing beat is CRITICAL and a deep backlog is only WARNING.
 */
opsRouter.get('/queue/stats', requirePermission('ops:read'), async (_request, response) => {
  const health = await queueHealth();

  const payload: ApiSuccess<QueueHealth> = { success: true, data: health };
  response.status(200).json(payload);
});

/**
 * GET /ops/billing — platform money view: MRR, tier mix, invoice counts.
 *
 * Gated on `finance:read` rather than `ops:read`: it is a revenue report, and the
 * roles that may see money should be the ones that may see this.
 */
opsRouter.get('/billing', requirePermission('finance:read'), async (_request, response) => {
  const overview = await invoiceRepository.overview();

  const payload: ApiSuccess<FinanceOverview> = { success: true, data: overview };
  response.status(200).json(payload);
});

/**
 * POST /ops/sla/sweep — run the risk engine now.
 *
 * The same pass the interval worker runs; exposed so operations can act on a
 * moment that matters rather than waiting for the next tick, and so the behaviour
 * is testable without a clock.
 */
opsRouter.post('/sla/sweep', requirePermission('ops:read'), async (request, response) => {
  const query = opsDashboardQuerySchema.safeParse(request.query);

  if (!query.success) {
    throw ApiError.badRequest('Invalid sweep query', formatIssues(query.error));
  }

  const report = await runSlaSweep(
    query.data.organizationId ? { organizationId: query.data.organizationId } : {},
  );

  const payload: ApiSuccess<SlaSweepReport> = { success: true, data: report };
  response.status(200).json(payload);
});

/**
 * The staff dashboards (Phase 7).
 *
 * Every route below states which cross-tenant boundary it crosses:
 *
 *   directory:read  — who our clients are and who works here. Held by the sales
 *                     desk and the executive seat as well as operations.
 *   ops:read        — what is in flight, across every tenant. Operations,
 *                     management and the platform administrator only.
 *   task:read       — the internal board, narrowed to the caller's own work
 *                     unless they also hold ops:read.
 *
 * A caller never chooses their own scope from the query string: `mine` is a flag,
 * and the id it resolves to comes from the verified token.
 */

/** GET /ops/organizations — the client directory, with live counts and plan. */
opsRouter.get(
  '/organizations',
  requirePermission('directory:read'),
  async (request, response) => {
    const query = opsListQuerySchema.safeParse(request.query);

    if (!query.success) {
      throw ApiError.badRequest('Invalid directory query', formatIssues(query.error));
    }

    const rows = await opsDirectoryRepository.listTenants(query.data.limit);

    const payload: ApiSuccess<readonly OpsTenantRow[]> = { success: true, data: rows };
    response.status(200).json(payload);
  },
);

/** GET /ops/staff — the internal directory: role, pods and live task load. */
opsRouter.get('/staff', requirePermission('directory:read'), async (request, response) => {
  const query = opsListQuerySchema.safeParse(request.query);

  if (!query.success) {
    throw ApiError.badRequest('Invalid directory query', formatIssues(query.error));
  }

  const rows = await opsDirectoryRepository.listStaff(query.data.limit);

  const payload: ApiSuccess<readonly OpsStaffRow[]> = { success: true, data: rows };
  response.status(200).json(payload);
});

/** GET /ops/requests — the cross-tenant delivery board. */
opsRouter.get('/requests', requirePermission('ops:read'), async (request, response) => {
  const query = opsBoardQuerySchema.safeParse(request.query);

  if (!query.success) {
    throw ApiError.badRequest('Invalid board query', formatIssues(query.error));
  }

  const rows = await opsDirectoryRepository.listRequests({
    status: query.data.status,
    organizationId: query.data.organizationId,
    podId: query.data.podId,
    limit: query.data.limit,
  });

  const payload: ApiSuccess<readonly OpsRequestRow[]> = { success: true, data: rows };
  response.status(200).json(payload);
});

/** GET /ops/deliverables — the review and release queue, tenant-resolved. */
opsRouter.get('/deliverables', requirePermission('ops:read'), async (request, response) => {
  const query = opsDeliverableQuerySchema.safeParse(request.query);

  if (!query.success) {
    throw ApiError.badRequest('Invalid deliverable query', formatIssues(query.error));
  }

  const rows = await opsDirectoryRepository.listDeliverables({
    status: query.data.status,
    organizationId: query.data.organizationId,
    limit: query.data.limit,
  });

  const payload: ApiSuccess<readonly OpsDeliverableRow[]> = { success: true, data: rows };
  response.status(200).json(payload);
});

/**
 * Resolves the task board's scope.
 *
 * `ops:read` sees the platform; a pod manager sees the pods they are seated in;
 * a specialist sees only their own name. `mine=true` narrows any of them to the
 * caller, and the id comes from the token — never from the query string.
 */
async function taskScopeFor(
  actorUserId: string | undefined,
  platformRole: string | null | undefined,
  mine: boolean,
): Promise<{ assigneeId?: string | null; podIds?: readonly string[] | null }> {
  if (!actorUserId) {
    return { assigneeId: '__none__' };
  }

  if (mine) {
    return { assigneeId: actorUserId };
  }

  const permissions = staffPermissions(
    (platformRole ?? null) as Parameters<typeof staffPermissions>[0],
  );

  if (permissions.includes('ops:read')) {
    return {};
  }

  if (platformRole === 'POD_MANAGER') {
    const podIds = await opsDirectoryRepository.podIdsForUser(actorUserId);

    return podIds.length > 0 ? { podIds } : { assigneeId: actorUserId };
  }

  return { assigneeId: actorUserId };
}

/** GET /ops/tasks — the internal task board, scoped to what the caller may see. */
opsRouter.get('/tasks', requirePermission('task:read'), async (request, response) => {
  const query = opsTaskQuerySchema.safeParse(request.query);

  if (!query.success) {
    throw ApiError.badRequest('Invalid task query', formatIssues(query.error));
  }

  const scope = await taskScopeFor(
    request.actor?.userId,
    request.actor?.platformRole ?? null,
    query.data.mine === true,
  );

  const rows = await opsDirectoryRepository.listTasks({
    ...scope,
    status: query.data.status,
    organizationId: query.data.organizationId,
    limit: query.data.limit,
  });

  const payload: ApiSuccess<readonly OpsTaskRow[]> = { success: true, data: rows };
  response.status(200).json(payload);
});

/** GET /ops/workload — open, overdue and due-today counts per person. */
opsRouter.get('/workload', requirePermission('task:read'), async (request, response) => {
  const permissions = staffPermissions(
    (request.actor?.platformRole ?? null) as Parameters<typeof staffPermissions>[0],
  );

  let podIds: readonly string[] | null = null;

  if (!permissions.includes('ops:read')) {
    const seated = request.actor?.userId
      ? await opsDirectoryRepository.podIdsForUser(request.actor.userId)
      : [];

    if (seated.length === 0) {
      const empty: ApiSuccess<readonly OpsWorkloadRow[]> = { success: true, data: [] };
      response.status(200).json(empty);
      return;
    }

    podIds = seated;
  }

  const rows = await opsDirectoryRepository.workload({ podIds });

  const payload: ApiSuccess<readonly OpsWorkloadRow[]> = { success: true, data: rows };
  response.status(200).json(payload);
});

/** GET /ops/catalogue — every tenant's service catalogue, for administration. */
opsRouter.get('/catalogue', requirePermission('ops:read'), async (request, response) => {
  const query = opsListQuerySchema.safeParse(request.query);

  if (!query.success) {
    throw ApiError.badRequest('Invalid catalogue query', formatIssues(query.error));
  }

  const rows = await opsDirectoryRepository.listCatalogue({ limit: query.data.limit });

  const payload: ApiSuccess<readonly OpsCatalogueRow[]> = { success: true, data: rows };
  response.status(200).json(payload);
});

/** GET /ops/notifications — recent delivery attempts, including failures. */
opsRouter.get('/notifications', requirePermission('ops:read'), async (request, response) => {
  const query = opsListQuerySchema.safeParse(request.query);

  if (!query.success) {
    throw ApiError.badRequest('Invalid notification query', formatIssues(query.error));
  }

  const rows = await opsDirectoryRepository.listNotifications({ limit: query.data.limit });

  const payload: ApiSuccess<readonly OpsNotificationRow[]> = { success: true, data: rows };
  response.status(200).json(payload);
});

/**
 * The pod member's boards.
 *
 * `task:read` is the only permission needed, because the row set is derived from
 * the caller's own tasks — a specialist sees the requests their work belongs to,
 * and nothing else. A pod manager's scope is their pods. Neither can widen it:
 * there is no query parameter here that names a tenant.
 */
async function personalScopeFor(
  actorUserId: string | undefined,
  platformRole: string | null | undefined,
): Promise<readonly string[]> {
  if (!actorUserId) {
    return [];
  }

  const permissions = staffPermissions(
    (platformRole ?? null) as Parameters<typeof staffPermissions>[0],
  );

  if (permissions.includes('ops:read')) {
    return [];
  }

  const podIds =
    platformRole === 'POD_MANAGER'
      ? await opsDirectoryRepository.podIdsForUser(actorUserId)
      : null;

  return opsDirectoryRepository.requestIdsForUser(actorUserId, podIds);
}

/** GET /ops/my/requests — the requests behind the caller's own work. */
opsRouter.get('/my/requests', requirePermission('task:read'), async (request, response) => {
  const query = opsBoardQuerySchema.safeParse(request.query);

  if (!query.success) {
    throw ApiError.badRequest('Invalid board query', formatIssues(query.error));
  }

  const requestIds = await personalScopeFor(
    request.actor?.userId,
    request.actor?.platformRole ?? null,
  );

  const rows = await opsDirectoryRepository.listRequests({
    ...(requestIds.length > 0 ? { requestIds } : {}),
    status: query.data.status,
    limit: query.data.limit,
  });

  const payload: ApiSuccess<readonly OpsRequestRow[]> = { success: true, data: rows };
  response.status(200).json(payload);
});

/** GET /ops/my/deliverables — deliverables produced against the caller's work. */
opsRouter.get('/my/deliverables', requirePermission('task:read'), async (request, response) => {
  const query = opsDeliverableQuerySchema.safeParse(request.query);

  if (!query.success) {
    throw ApiError.badRequest('Invalid deliverable query', formatIssues(query.error));
  }

  const requestIds = await personalScopeFor(
    request.actor?.userId,
    request.actor?.platformRole ?? null,
  );

  const rows = await opsDirectoryRepository.listDeliverables({
    ...(requestIds.length > 0 ? { requestIds } : {}),
    status: query.data.status,
    limit: query.data.limit,
  });

  const payload: ApiSuccess<readonly OpsDeliverableRow[]> = { success: true, data: rows };
  response.status(200).json(payload);
});
