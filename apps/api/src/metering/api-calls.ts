import type { NextFunction, Request, Response } from 'express';
import { ApiError } from '../lib/api-error';
import { usageRepository } from '../repositories/usage.repository';
import { allowanceIfPlanned, isLimitExempt } from './limits';

/**
 * Meters API calls, and blocks work once the plan's call allowance is spent.
 *
 * Mounted on the `/api/v1` router, so `request.path` is already relative to the
 * version prefix and the exemption list can speak in plain route names.
 *
 * Two deliberate choices:
 *  - The counter is written on response `finish`, not up front, so a request that
 *    never reaches the API (or crashes the process) is not billed.
 *  - Enforcement only looks at callers that present a token, and never the
 *    bill-reading paths: a tenant that has run out of calls can still open its
 *    plan page and find out why. No subscription row is created here either — a
 *    tenant with no plan has no allowance to exceed.
 */
export async function meterApiCall(
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> {
  const organizationId = request.header('x-organization-id');
  const identified = Boolean(request.header('authorization'));

  if (!organizationId || !identified) {
    next();
    return;
  }

  if (!isLimitExempt(request.path)) {
    try {
      const allowance = await allowanceIfPlanned(organizationId, 'API_CALLS');

      if (allowance && allowance.used >= allowance.limit) {
        throw ApiError.limitExceeded({
          meter: 'API_CALLS',
          used: allowance.used,
          limit: allowance.limit,
          unit: 'API calls',
          tierCode: allowance.tierCode,
        });
      }
    } catch (error) {
      next(error);
      return;
    }
  }

  response.on('finish', () => {
    // Only authenticated work is counted: an anonymous request to a tenant's
    // routes is a 401 and must not move a tenant's meter.
    if (!request.actor) {
      return;
    }

    void usageRepository.increment(organizationId, 'API_CALLS', 1).catch(() => undefined);
  });

  next();
}
