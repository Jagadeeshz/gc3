import { Router } from 'express';
import type { ApiSuccess, HealthReport } from '@gc3/types';
import { SERVICE_NAME, SERVICE_VERSION, env } from '../../config/env';
import { requireTenantScope } from '../../middleware/tenant-scope';
import { requireAuth, requirePermission } from '../../middleware/auth';
import { authRouter } from './auth';
import { deliverablesRouter } from './deliverables';
import { invoicesRouter } from './invoices';
import { notificationsRouter } from './notifications';
import { opsRouter } from './ops';
import { organizationsRouter } from './organizations';
import { podsRouter } from './pods';
import { serviceCategoriesRouter } from './service-categories';
import { serviceRequestsRouter } from './service-requests';
import { subscriptionsRouter } from './subscriptions';
import { tasksRouter } from './tasks';

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
      implemented: [
        '/health',
        '/meta',
        '/auth',
        '/tenant-context',
        '/organizations',
        '/service-requests',
        '/service-categories',
        '/deliverables',
        '/notifications',
      ],
      planned: [
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
 * `x-organization-id` is rejected before reaching this handler, and only an
 * authenticated caller holding `tenant:context` gets here.
 */
v1Router.get(
  '/tenant-context',
  requireAuth,
  requireTenantScope,
  requirePermission('tenant:context'),
  (request, response) => {
    response.status(200).json({
      success: true,
      data: {
        organizationId: request.organizationId,
        requestId: request.requestId,
        actorId: request.actor?.userId,
      },
    });
  },
);

/**
 * Public: /health and /meta. Everything else needs a verified access token.
 */
v1Router.use('/auth', authRouter);

/**
 * Tenant-scoped domain routers. Each router owns its own guard chain, so the
 * version prefix and the isolation rules are applied in exactly one place.
 */
v1Router.use('/organizations', organizationsRouter);

/** Phase 2: client portal work items, tenant-scoped end to end. */
v1Router.use('/service-requests', serviceRequestsRouter);

/** Phase 2: the per-tenant service catalogue those requests are raised against. */
v1Router.use('/service-categories', serviceCategoriesRouter);

/** Phase 2: workspace-level delivery views (released assets across requests). */
v1Router.use('/deliverables', deliverablesRouter);

/** Phase 1: delivery audit and manual retry control. */
v1Router.use('/notifications', notificationsRouter);

/** Phase 3: delivery pods and the routing decision they receive work through. */
v1Router.use('/pods', podsRouter);

/**
 * Phase 3: the cross-tenant operations summary. Mounted without the tenant
 * middleware by design — see the router for why.
 */
v1Router.use('/ops', opsRouter);

/** Phase 3: internal work items, by task id (listing lives on the request). */
v1Router.use('/tasks', tasksRouter);

/** Phase 4: the tenant's plan, allowances and metered usage. */
v1Router.use('/subscription', subscriptionsRouter);

/** Phase 4: invoices — generation, reads, status transitions and the document. */
v1Router.use('/invoices', invoicesRouter);
