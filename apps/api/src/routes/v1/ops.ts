import { Router } from 'express';
import type { ApiSuccess, OpsDashboard } from '@gc3/types';
import { formatIssues, opsDashboardQuerySchema } from '@gc3/validation';
import { ApiError } from '../../lib/api-error';
import { requireAuth, requirePermission } from '../../middleware/auth';
import { opsRepository } from '../../repositories/ops.repository';

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
