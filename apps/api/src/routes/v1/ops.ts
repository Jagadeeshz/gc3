import { Router } from 'express';
import type {
  AnalyticsReport,
  ApiSuccess,
  FinanceOverview,
  OpsDashboard,
  QueueHealth,
  SlaSweepReport,
} from '@gc3/types';
import { analyticsQuerySchema, formatIssues, opsDashboardQuerySchema } from '@gc3/validation';
import { ApiError } from '../../lib/api-error';
import { requireAuth, requirePermission } from '../../middleware/auth';
import { queueHealth } from '../../observability/queue-health';
import { analyticsRepository } from '../../repositories/analytics.repository';
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
