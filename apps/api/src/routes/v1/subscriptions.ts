import { Router } from 'express';
import type { ApiSuccess, OrganizationSubscription, SubscriptionOverview, SubscriptionTier } from '@gc3/types';
import { changeTierSchema, formatIssues } from '@gc3/validation';
import { ApiError } from '../../lib/api-error';
import { requireAuth, requirePermission } from '../../middleware/auth';
import { requireTenantScope } from '../../middleware/tenant-scope';
import { financeRepository } from '../../repositories/finance.repository';

/**
 * The tenant's subscription.
 *
 * Read is open to anyone who can see money in this tenant (`finance:read`);
 * changing tier is `finance:manage`, which no client role holds — a client cannot
 * upgrade itself into a bigger plan any more than it can cancel one.
 */
export const subscriptionsRouter: Router = Router();

subscriptionsRouter.use(requireAuth, requireTenantScope);

function scopeOf(organizationId: string | undefined): string {
  if (!organizationId) {
    throw ApiError.badRequest('Tenant scope is required', [
      { path: 'x-organization-id', message: 'Missing tenant scope' },
    ]);
  }

  return organizationId;
}

/** GET /subscription — plan, allowances and this period's usage. */
subscriptionsRouter.get('/', requirePermission('finance:read'), async (request, response) => {
  const overview = await financeRepository.overview(scopeOf(request.organizationId));

  const payload: ApiSuccess<SubscriptionOverview> = { success: true, data: overview };
  response.status(200).json(payload);
});

/** GET /subscription/tiers — the catalogue, so a pricing page has a source. */
subscriptionsRouter.get('/tiers', requirePermission('finance:read'), async (_request, response) => {
  const tiers = await financeRepository.listTiers();

  const payload: ApiSuccess<SubscriptionTier[]> = { success: true, data: tiers };
  response.status(200).json(payload);
});

/**
 * PATCH /subscription — move the tenant onto another tier.
 *
 * A commercial action: audited with the actor and both tier codes, and it never
 * touches invoices. Billing catches up at the next generation.
 */
subscriptionsRouter.patch('/', requirePermission('finance:manage'), async (request, response) => {
  const body = changeTierSchema.safeParse(request.body);

  if (!body.success) {
    throw ApiError.badRequest('Invalid subscription payload', formatIssues(body.error));
  }

  try {
    const result = await financeRepository.changeTier(
      scopeOf(request.organizationId),
      body.data.tierCode,
      request.actor?.userId ?? null,
    );

    const payload: ApiSuccess<{
      subscription: OrganizationSubscription;
      tier: SubscriptionTier;
      previousTierCode: string;
    }> = { success: true, data: result };

    response.status(200).json(payload);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Unknown or inactive tier')) {
      throw ApiError.notFound(error.message);
    }

    throw error;
  }
});
