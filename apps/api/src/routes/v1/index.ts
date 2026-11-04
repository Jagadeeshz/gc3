import { Router } from 'express';
import type { ApiSuccess, HealthReport } from '@gc3/types';
import { formatIssues, organizationIdParamsSchema } from '@gc3/validation';
import { SERVICE_NAME, SERVICE_VERSION, env } from '../../config/env';
import { ApiError } from '../../lib/api-error';
import { requireMatchingTenant, requireTenantScope } from '../../middleware/tenant-scope';

/**
 * `/api/v1` route table (Development Brief §11).
 *
 * Implemented today: health, meta, and the tenant-scope probe — the Phase 0
 * foundation. Domain routers land per vertical slice, each mounted here so the
 * version prefix is never repeated in module code.
 */
export const v1Router: Router = Router();

v1Router.get('/health', (_request, response) => {
  const body: ApiSuccess<HealthReport> = {
    success: true,
    data: {
      status: 'ok',
      service: SERVICE_NAME,
      version: SERVICE_VERSION,
      environment: env.NODE_ENV,
      uptimeSeconds: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    },
  };
  response.status(200).json(body);
});

v1Router.get('/meta', (_request, response) => {
  response.status(200).json({
    success: true,
    data: {
      service: SERVICE_NAME,
      apiVersion: 'v1',
      tenantHeader: 'x-organization-id',
      implemented: ['/health', '/meta', '/tenant-context'],
      planned: [
        '/auth',
        '/users',
        '/organizations',
        '/roles',
        '/subscriptions',
        '/plans',
        '/services',
        '/requests',
        '/projects',
        '/tasks',
        '/pods',
        '/deliverables',
        '/approvals',
        '/messages',
        '/notifications',
        '/billing',
        '/support',
        '/agents',
        '/workflows',
        '/reports',
        '/audit',
      ],
    },
  });
});

/**
 * Proves the isolation chain end to end: a request without a validated
 * `x-organization-id` is rejected before reaching this handler.
 */
v1Router.get('/tenant-context', requireTenantScope, (request, response) => {
  response.status(200).json({
    success: true,
    data: {
      organizationId: request.organizationId,
      requestId: request.requestId,
    },
  });
});

/**
 * Route stub that exercises param validation + tenant matching. Returns 501 on
 * purpose: persistence arrives with Prisma in Phase 1, and a fabricated 200
 * would misrepresent the platform's state.
 */
v1Router.get<{ organizationId: string }>(
  '/organizations/:organizationId',
  requireTenantScope,
  requireMatchingTenant,
  (request, response, next) => {
    const parsed = organizationIdParamsSchema.safeParse(request.params);

    if (!parsed.success) {
      next(ApiError.badRequest('Invalid organization id', formatIssues(parsed.error)));
      return;
    }

    next(
      ApiError.notImplemented(
        `Organization ${parsed.data.organizationId} endpoint is not wired to persistence yet (Phase 1)`,
      ),
    );
  },
);
