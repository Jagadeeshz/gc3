import { Router } from 'express';
import type { ApiSuccess, CapabilityPod } from '@gc3/types';
import { prisma } from '../../db/client';

/**
 * The commercial catalogue, public.
 *
 * Deliberately unauthenticated: a price list is a document you hand to a prospect,
 * and putting it behind a login would make the marketing site unable to state its
 * own prices. It exposes nothing tenant-scoped — no counts, no names, no usage.
 */
export const pricingRouter: Router = Router();

pricingRouter.get('/pods', async (_request, response) => {
  const rows = await prisma.capabilityPod.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: 'asc' },
    select: {
      id: true,
      code: true,
      name: true,
      tagline: true,
      description: true,
      monthlyPriceCents: true,
      creditRateCents: true,
      currency: true,
      creditsIncluded: true,
      hoursIncluded: true,
      peakHoursIncluded: true,
      managers: true,
      specialists: true,
      agents: true,
      teamSummary: true,
      includesCodes: true,
      perks: true,
      minTermMonths: true,
      isCustomPriced: true,
      isActive: true,
      sortOrder: true,
    },
  });

  const payload: ApiSuccess<readonly CapabilityPod[]> = {
    success: true,
    data: rows as readonly CapabilityPod[],
  };

  response.status(200).json(payload);
});
