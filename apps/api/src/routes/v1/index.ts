import { Router } from 'express';
import type { ApiSuccess, HealthReport } from '@gc3/types';
import { SERVICE_NAME, SERVICE_VERSION, env } from '../../config/env';
import { requireTenantScope } from '../../middleware/tenant-scope';
import { organizationsRouter } from './organizations';

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
      implemented: ['/health', '/meta', '/tenant-context', '/organizations'],
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
 * Tenant-scoped domain routers. Each router owns its own guard chain, so the
 * version prefix and the isolation rules are applied in exactly one place.
 */
v1Router.use('/organizations', organizationsRouter);
