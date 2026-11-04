import { Router } from 'express';
import type { ApiSuccess, DeliveryHistory } from '@gc3/types';
import { deliveryHistoryQuerySchema, formatIssues } from '@gc3/validation';
import { ApiError } from '../../lib/api-error';
import { requireAuth, requirePermission } from '../../middleware/auth';
import { requireTenantScope } from '../../middleware/tenant-scope';
import { deliverableRepository } from '../../repositories/deliverable.repository';

/**
 * Workspace-level delivery views. Tenant-scoped like everything else: the client
 * sees exactly the assets released inside their own organization.
 */
export const deliverablesRouter: Router = Router();

deliverablesRouter.use(requireAuth, requireTenantScope);

/**
 * GET /deliverables/history
 *
 * The client-facing receipt: released assets across every request in the
 * workspace, newest release first, with the request each one fulfils. Anything not
 * released is absent by design — approval alone is not delivery.
 */
deliverablesRouter.get(
  '/history',
  requirePermission('deliverable:read'),
  async (request, response) => {
    const query = deliveryHistoryQuerySchema.safeParse(request.query);

    if (!query.success) {
      throw ApiError.badRequest('Invalid query', formatIssues(query.error));
    }

    const organizationId = request.organizationId;

    if (!organizationId) {
      throw ApiError.tenantScopeRequired();
    }

    const history = await deliverableRepository.listHistoryScoped(
      organizationId,
      query.data.limit,
    );

    const payload: ApiSuccess<DeliveryHistory> = { success: true, data: history };
    response.status(200).json(payload);
  },
);
