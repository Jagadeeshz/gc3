import type { RequestHandler } from 'express';
import { ORGANIZATION_HEADER, formatIssues, tenantScopeSchema } from '@gc3/validation';
import { ApiError } from '../lib/api-error';

/**
 * Tenant isolation gate (Development Brief §12).
 *
 * Tenant scope is taken from a validated header and nowhere else — never from
 * the body, query string or a client-supplied "current org" cookie. Handlers
 * downstream read `request.organizationId` and are required to filter on it.
 * A request without a valid scope never reaches business logic.
 */
export const requireTenantScope: RequestHandler = (request, _response, next) => {
  const parsed = tenantScopeSchema.safeParse({
    [ORGANIZATION_HEADER]: request.header(ORGANIZATION_HEADER),
  });

  if (!parsed.success) {
    next(
      ApiError.tenantScopeRequired(
        `A valid ${ORGANIZATION_HEADER} header is required to scope this request to a tenant`,
      ),
    );
    return;
  }

  request.organizationId = parsed.data[ORGANIZATION_HEADER];
  next();
};

/**
 * Asserts the scoped tenant matches the tenant addressed by the route, so an
 * authenticated caller cannot reach another organization by editing the path.
 */
export const requireMatchingTenant: RequestHandler = (request, _response, next) => {
  const { organizationId: scoped } = request;
  const target = request.params.organizationId;

  if (!scoped) {
    next(ApiError.tenantScopeRequired());
    return;
  }

  if (target && target !== scoped) {
    next(ApiError.forbidden('Route organization does not match the request tenant scope'));
    return;
  }

  next();
};

/**
 * Guardrail for AI-actor routes (Development Brief §8.3): agents may draft and
 * propose, never execute commercially binding actions without human sign-off.
 */
export const forbidAgentCommercialAction: RequestHandler = (request, _response, next) => {
  const actor = request.header('x-actor-type');

  if (actor === 'AI_AGENT' && request.method !== 'GET') {
    next(
      ApiError.forbidden(
        'AI agents cannot perform commercial actions; a human must approve this operation',
      ),
    );
    return;
  }

  next();
};

export { formatIssues };
