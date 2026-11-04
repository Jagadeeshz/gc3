import { Router } from 'express';
import type {
  ApiSuccess,
  Deliverable,
  Paginated,
  RequestComment,
  ServiceRequest,
} from '@gc3/types';
import { isAllowedRequestTransition } from '@gc3/types';
import {
  changeDeliverableStatusSchema,
  changeServiceRequestStatusSchema,
  createDeliverableSchema,
  createRequestCommentSchema,
  createServiceRequestSchema,
  deliverableParamsSchema,
  formatIssues,
  listServiceRequestsQuerySchema,
  serviceRequestIdParamsSchema,
  updateServiceRequestSchema,
} from '@gc3/validation';
import { ApiError } from '../../lib/api-error';
import { requireAuth, requirePermission } from '../../middleware/auth';
import { forbidAgentCommercialAction, requireTenantScope } from '../../middleware/tenant-scope';
import { deliverableRepository } from '../../repositories/deliverable.repository';
import { requestCommentRepository } from '../../repositories/request-comment.repository';
import { serviceRequestRepository } from '../../repositories/service-request.repository';

export const serviceRequestsRouter: Router = Router();

/**
 * The whole surface is tenant-scoped: no request may reach a handler without an
 * authenticated actor and a validated `x-organization-id`. Permission checks are
 * declared per route below.
 */
serviceRequestsRouter.use(requireAuth, requireTenantScope);

function scopeOf(organizationId: string | undefined): string {
  // Guaranteed by requireTenantScope; the throw is a type narrowing aid.
  if (!organizationId) {
    throw ApiError.tenantScopeRequired();
  }

  return organizationId;
}

function isStaff(request: { actor?: { platformRole: string | null } }): boolean {
  return Boolean(request.actor?.platformRole);
}

/** POST /service-requests — raise a request in the caller's tenant. */
serviceRequestsRouter.post(
  '/',
  requirePermission('request:create'),
  async (request, response) => {
    const parsed = createServiceRequestSchema.safeParse(request.body);

    if (!parsed.success) {
      throw ApiError.badRequest('Invalid service request payload', formatIssues(parsed.error));
    }

    const actor = request.actor;
    if (!actor) {
      throw ApiError.unauthenticated();
    }

    const created = await serviceRequestRepository.createScoped(scopeOf(request.organizationId), {
      title: parsed.data.title,
      description: parsed.data.description,
      requesterId: actor.userId,
      ...(parsed.data.categoryId ? { categoryId: parsed.data.categoryId } : {}),
      priority: parsed.data.priority,
      ...(parsed.data.dueAt ? { dueAt: parsed.data.dueAt } : {}),
      status: parsed.data.status,
    });

    const body: ApiSuccess<ServiceRequest> = { success: true, data: created };
    response.status(201).json(body);
  },
);

/** GET /service-requests — filtered, paginated list for the caller's tenant. */
serviceRequestsRouter.get(
  '/',
  requirePermission('request:read'),
  async (request, response) => {
    const query = listServiceRequestsQuerySchema.safeParse(request.query);

    if (!query.success) {
      throw ApiError.badRequest('Invalid list query', formatIssues(query.error));
    }

    const result = await serviceRequestRepository.listScoped(scopeOf(request.organizationId), {
      ...(query.data.status ? { status: query.data.status } : {}),
      ...(query.data.categoryId ? { categoryId: query.data.categoryId } : {}),
      ...(query.data.requesterId ? { requesterId: query.data.requesterId } : {}),
      page: query.data.page,
      pageSize: query.data.pageSize,
    });

    // `priority` is filtered in memory over the page result: it is a low
    // cardinality refinement the UI applies on top of the status filter, and
    // pushing it into SQL would need a second count query for no real gain.
    const priority = query.data.priority;
    const items = priority
      ? result.items.filter((item) => item.priority === priority)
      : result.items;

    const body: ApiSuccess<Paginated<ServiceRequest>> = {
      success: true,
      data: { items, total: result.total, page: result.page, pageSize: result.pageSize },
    };
    response.status(200).json(body);
  },
);

/** GET /service-requests/:requestId — 404 for another tenant's id, by design. */
serviceRequestsRouter.get(
  '/:requestId',
  requirePermission('request:read'),
  async (request, response) => {
    const params = serviceRequestIdParamsSchema.safeParse(request.params);

    if (!params.success) {
      throw ApiError.badRequest('Invalid request id', formatIssues(params.error));
    }

    const found = await serviceRequestRepository.findByIdScoped(
      scopeOf(request.organizationId),
      params.data.requestId,
    );

    if (!found) {
      throw ApiError.notFound('Service request not found');
    }

    const body: ApiSuccess<ServiceRequest> = { success: true, data: found };
    response.status(200).json(body);
  },
);

/** PATCH /service-requests/:requestId — field edits. */
serviceRequestsRouter.patch(
  '/:requestId',
  requirePermission('request:update'),
  async (request, response) => {
    const params = serviceRequestIdParamsSchema.safeParse(request.params);
    const body = updateServiceRequestSchema.safeParse(request.body);

    if (!params.success) {
      throw ApiError.badRequest('Invalid request id', formatIssues(params.error));
    }

    if (!body.success) {
      throw ApiError.badRequest('Invalid update payload', formatIssues(body.error));
    }

    const existing = await serviceRequestRepository.findByIdScoped(
      scopeOf(request.organizationId),
      params.data.requestId,
    );

    if (!existing) {
      throw ApiError.notFound('Service request not found');
    }

    // Content edits stay open while work is active; once the request is closed or
    // cancelled the record is history and only a new request may change it.
    if (existing.status === 'CLOSED' || existing.status === 'CANCELLED') {
      throw ApiError.conflict(
        `A ${existing.status.toLowerCase()} request can no longer be edited`,
      );
    }

    const updated = await serviceRequestRepository.updateScoped(
      scopeOf(request.organizationId),
      params.data.requestId,
      body.data,
    );

    if (!updated) {
      throw ApiError.notFound('Service request not found');
    }

    const payload: ApiSuccess<ServiceRequest> = { success: true, data: updated };
    response.status(200).json(payload);
  },
);

/**
 * POST /service-requests/:requestId/status — workflow transition.
 *
 * The legal transition table lives in @gc3/types and is enforced here, at the
 * API boundary; the repository stays a permissive data primitive. Repeating the
 * current status is an idempotent no-op so client retries are safe.
 */
serviceRequestsRouter.post(
  '/:requestId/status',
  requirePermission('request:update'),
  async (request, response) => {
    const params = serviceRequestIdParamsSchema.safeParse(request.params);
    const body = changeServiceRequestStatusSchema.safeParse(request.body);

    if (!params.success) {
      throw ApiError.badRequest('Invalid request id', formatIssues(params.error));
    }

    if (!body.success) {
      throw ApiError.badRequest('Invalid status payload', formatIssues(body.error));
    }

    const organizationId = scopeOf(request.organizationId);
    const current = await serviceRequestRepository.findByIdScoped(
      organizationId,
      params.data.requestId,
    );

    if (!current) {
      throw ApiError.notFound('Service request not found');
    }

    if (!isAllowedRequestTransition(current.status, body.data.status)) {
      throw new ApiError(
        409,
        'CONFLICT',
        `Cannot move a request from ${current.status} to ${body.data.status}`,
      );
    }

    const updated = await serviceRequestRepository.updateStatusScoped(
      organizationId,
      params.data.requestId,
      body.data.status,
    );

    // A transition note is recorded as a comment. Staff notes stay internal so a
    // client never reads the pod's working commentary.
    if (body.data.note && request.actor) {
      await requestCommentRepository.createScoped(organizationId, {
        requestId: params.data.requestId,
        authorId: request.actor.userId,
        body: body.data.note,
        isInternal: isStaff(request),
      });
    }

    const payload: ApiSuccess<ServiceRequest> = {
      success: true,
      data: updated ?? current,
    };
    response.status(200).json(payload);
  },
);

/** GET /service-requests/:requestId/comments — internal notes visible to staff only. */
serviceRequestsRouter.get(
  '/:requestId/comments',
  requirePermission('request:read'),
  async (request, response) => {
    const params = serviceRequestIdParamsSchema.safeParse(request.params);

    if (!params.success) {
      throw ApiError.badRequest('Invalid request id', formatIssues(params.error));
    }

    const organizationId = scopeOf(request.organizationId);
    const parent = await serviceRequestRepository.findByIdScoped(
      organizationId,
      params.data.requestId,
    );

    if (!parent) {
      throw ApiError.notFound('Service request not found');
    }

    const comments = await requestCommentRepository.listForRequestScoped(
      organizationId,
      params.data.requestId,
      { includeInternal: isStaff(request) },
    );

    const body: ApiSuccess<readonly RequestComment[]> = { success: true, data: comments };
    response.status(200).json(body);
  },
);

/** POST /service-requests/:requestId/comments */
serviceRequestsRouter.post(
  '/:requestId/comments',
  requirePermission('request:comment'),
  async (request, response) => {
    const params = serviceRequestIdParamsSchema.safeParse(request.params);
    const body = createRequestCommentSchema.safeParse(request.body);

    if (!params.success) {
      throw ApiError.badRequest('Invalid request id', formatIssues(params.error));
    }

    if (!body.success) {
      throw ApiError.badRequest('Invalid comment payload', formatIssues(body.error));
    }

    const actor = request.actor;
    if (!actor) {
      throw ApiError.unauthenticated();
    }

    // A client can never author an internal note, whatever the payload says.
    const isInternal = body.data.isInternal && isStaff(request);

    const created = await requestCommentRepository.createScoped(scopeOf(request.organizationId), {
      requestId: params.data.requestId,
      authorId: actor.userId,
      body: body.data.body,
      isInternal,
    });

    const payload: ApiSuccess<RequestComment> = { success: true, data: created };
    response.status(201).json(payload);
  },
);

/** GET /service-requests/:requestId/deliverables */
serviceRequestsRouter.get(
  '/:requestId/deliverables',
  requirePermission('deliverable:read'),
  async (request, response) => {
    const params = serviceRequestIdParamsSchema.safeParse(request.params);

    if (!params.success) {
      throw ApiError.badRequest('Invalid request id', formatIssues(params.error));
    }

    const organizationId = scopeOf(request.organizationId);
    const parent = await serviceRequestRepository.findByIdScoped(
      organizationId,
      params.data.requestId,
    );

    if (!parent) {
      throw ApiError.notFound('Service request not found');
    }

    const deliverables = await deliverableRepository.listForRequestScoped(
      organizationId,
      params.data.requestId,
    );

    const body: ApiSuccess<readonly Deliverable[]> = { success: true, data: deliverables };
    response.status(200).json(body);
  },
);

/** POST /service-requests/:requestId/deliverables */
serviceRequestsRouter.post(
  '/:requestId/deliverables',
  requirePermission('deliverable:create'),
  async (request, response) => {
    const params = serviceRequestIdParamsSchema.safeParse(request.params);
    const body = createDeliverableSchema.safeParse(request.body);

    if (!params.success) {
      throw ApiError.badRequest('Invalid request id', formatIssues(params.error));
    }

    if (!body.success) {
      throw ApiError.badRequest('Invalid deliverable payload', formatIssues(body.error));
    }

    const created = await deliverableRepository.createScoped(scopeOf(request.organizationId), {
      requestId: params.data.requestId,
      title: body.data.title,
      ...(body.data.description ? { description: body.data.description } : {}),
      ...(body.data.fileUrl ? { fileUrl: body.data.fileUrl } : {}),
    });

    const payload: ApiSuccess<Deliverable> = { success: true, data: created };
    response.status(201).json(payload);
  },
);

/**
 * PATCH /service-requests/:requestId/deliverables/:deliverableId/status
 *
 * Approval and release are the Brief's §8.3 boundary in action: an AI actor is
 * blocked outright, approval must name a human, and release requires an approval
 * to already exist (enforced again inside the repository).
 */
serviceRequestsRouter.patch(
  '/:requestId/deliverables/:deliverableId/status',
  forbidAgentCommercialAction,
  requirePermission('deliverable:review'),
  async (request, response) => {
    const params = deliverableParamsSchema.safeParse(request.params);
    const body = changeDeliverableStatusSchema.safeParse(request.body);

    if (!params.success) {
      throw ApiError.badRequest('Invalid route parameters', formatIssues(params.error));
    }

    if (!body.success) {
      throw ApiError.badRequest('Invalid deliverable status payload', formatIssues(body.error));
    }

    const organizationId = scopeOf(request.organizationId);
    const deliverable = await deliverableRepository.findByIdScoped(
      organizationId,
      params.data.deliverableId,
    );

    // 404 covers both "does not exist" and "belongs to another tenant".
    if (!deliverable || deliverable.requestId !== params.data.requestId) {
      throw ApiError.notFound('Deliverable not found');
    }

    const updated = await deliverableRepository.setStatusScoped(
      organizationId,
      params.data.deliverableId,
      body.data.status,
      request.actor?.userId,
    );

    if (!updated) {
      throw ApiError.notFound('Deliverable not found');
    }

    const payload: ApiSuccess<Deliverable> = { success: true, data: updated };
    response.status(200).json(payload);
  },
);
