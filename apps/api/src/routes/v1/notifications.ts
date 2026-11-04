import { Router } from 'express';
import type {
  ApiSuccess,
  NotificationDeliveryPage,
  NotificationDeliveryRecord,
  RetrySweepReport,
} from '@gc3/types';
import { formatIssues, notificationQuerySchema } from '@gc3/validation';
import { ApiError } from '../../lib/api-error';
import { requireAuth, requirePermission } from '../../middleware/auth';
import { requireTenantScope } from '../../middleware/tenant-scope';
import { notificationRepository } from '../../repositories/notification.repository';
import { runRetrySweep } from '../../notifications/retry';

/**
 * Delivery audit and retry control.
 *
 * Tenant-scoped like every other domain router: an operator sees the notifications
 * sent on behalf of the organization in `x-organization-id`, and nothing else.
 */
export const notificationsRouter: Router = Router();

notificationsRouter.use(requireAuth, requireTenantScope);

interface DeliveryRow {
  id: string;
  organizationId: string;
  membershipId: string | null;
  userId: string;
  kind: 'INVITATION' | 'RESENT' | 'DELIVERABLE_RELEASED' | 'REQUEST_STATUS_UPDATED' | 'SLA_RISK';
  channel: string;
  driver: string;
  status: 'SENT' | 'FAILED' | 'SKIPPED';
  recipient: string;
  messageId: string | null;
  error: string | null;
  attempt: number;
  nextAttemptAt: Date | null;
  lastAttemptAt: Date | null;
  createdAt: Date;
}

function toRecord(row: DeliveryRow): NotificationDeliveryRecord {
  return {
    id: row.id,
    organizationId: row.organizationId,
    membershipId: row.membershipId,
    userId: row.userId,
    kind: row.kind,
    channel: row.channel,
    driver: row.driver,
    status: row.status,
    recipient: row.recipient,
    messageId: row.messageId,
    error: row.error,
    attempt: row.attempt,
    nextAttemptAt: row.nextAttemptAt ? row.nextAttemptAt.toISOString() : null,
    lastAttemptAt: row.lastAttemptAt ? row.lastAttemptAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * GET /notifications/deliveries
 *
 * The administrative read over the delivery audit: filter by status, kind or
 * recipient, paginated, with a status summary alongside so the shape of the queue
 * is visible without paging through it.
 */
notificationsRouter.get(
  '/deliveries',
  requirePermission('notification:read'),
  async (request, response) => {
    const query = notificationQuerySchema.safeParse(request.query);

    if (!query.success) {
      throw ApiError.badRequest('Invalid query', formatIssues(query.error));
    }

    const organizationId = request.organizationId;

    if (!organizationId) {
      throw ApiError.tenantScopeRequired();
    }

    const { rows, total, summary } = await notificationRepository.queryScoped(organizationId, {
      ...(query.data.status ? { status: query.data.status } : {}),
      ...(query.data.kind ? { kind: query.data.kind } : {}),
      ...(query.data.recipient ? { recipient: query.data.recipient } : {}),
      page: query.data.page,
      pageSize: query.data.pageSize,
    });

    const payload: ApiSuccess<NotificationDeliveryPage> = {
      success: true,
      data: {
        items: rows.map(toRecord),
        page: query.data.page,
        pageSize: query.data.pageSize,
        total,
        summary,
      },
    };

    response.status(200).json(payload);
  },
);

/**
 * POST /notifications/retry
 *
 * Runs one retry sweep immediately instead of waiting for the interval. Exposed so
 * an operator can clear a queue after fixing an outage — and so the retry logic is
 * testable without a timer.
 */
notificationsRouter.post(
  '/retry',
  requirePermission('notification:manage'),
  async (request, response) => {
    const organizationId = request.organizationId;

    if (!organizationId) {
      throw ApiError.tenantScopeRequired();
    }

    // Scoped to the caller's tenant: an operations manager clears their own queue,
    // not every tenant's. The background worker is the one that sweeps globally.
    const report = await runRetrySweep({ organizationId });

    const payload: ApiSuccess<RetrySweepReport> = { success: true, data: report };
    response.status(200).json(payload);
  },
);
