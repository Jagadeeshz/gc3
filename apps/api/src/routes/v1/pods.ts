import { Router } from 'express';
import type { ApiSuccess, PodSummary, StaffCandidate } from '@gc3/types';
import {
  addPodMemberSchema,
  createPodSchema,
  formatIssues,
  podIdParamsSchema,
  podMemberParamsSchema,
} from '@gc3/validation';
import { ApiError } from '../../lib/api-error';
import { slugify } from '../../lib/slug';
import { requireAuth, requirePermission } from '../../middleware/auth';
import { requireTenantScope } from '../../middleware/tenant-scope';
import { podRepository } from '../../repositories/pod.repository';

/**
 * Delivery pods (Phase 3).
 *
 * Tenant-scoped: a pod belongs to one organization and only that organization's
 * callers can see or create it. Listing is gated on `request:assign` because the
 * pods exist to be routed work into; creating them needs `pod:manage`.
 */
export const podsRouter: Router = Router();

podsRouter.use(requireAuth, requireTenantScope);

function scopeOf(organizationId: string | undefined): string {
  if (!organizationId) {
    throw ApiError.badRequest('Tenant scope is required', [
      { path: 'x-organization-id', message: 'Missing tenant scope' },
    ]);
  }

  return organizationId;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}

/** GET /pods — every live pod in this tenant, with member and load counts. */
podsRouter.get('/', requirePermission('request:assign'), async (request, response) => {
  const pods = await podRepository.listScoped(scopeOf(request.organizationId));

  const payload: ApiSuccess<PodSummary[]> = { success: true, data: pods };
  response.status(200).json(payload);
});

/**
 * GET /pods/staff — staff accounts that can be seated.
 *
 * `task:read` rather than `request:assign`: the roster is also what the internal
 * task checklist needs to populate an assignee picker, and a specialist holds
 * task:manage without holding request:assign. Clients hold neither.
 *
 * Declared before `/:podId/members` so the literal path wins the match.
 */
podsRouter.get('/staff', requirePermission('task:read'), async (request, response) => {
  const staff = await podRepository.listStaffCandidates(scopeOf(request.organizationId));

  const payload: ApiSuccess<StaffCandidate[]> = { success: true, data: staff };
  response.status(200).json(payload);
});

/** POST /pods/:podId/members — seat a staff account in the pod. */
podsRouter.post(
  '/:podId/members',
  requirePermission('pod:manage'),
  async (request, response) => {
    const params = podIdParamsSchema.safeParse(request.params);
    const body = addPodMemberSchema.safeParse(request.body);

    if (!params.success) {
      throw ApiError.badRequest('Invalid pod id', formatIssues(params.error));
    }

    if (!body.success) {
      throw ApiError.badRequest('Invalid member payload', formatIssues(body.error));
    }

    const outcome = await podRepository.addMemberScoped(
      scopeOf(request.organizationId),
      params.data.podId,
      body.data.userId,
    );

    if (outcome === 'pod-not-found') {
      throw ApiError.notFound('Pod not found in this organization');
    }

    if (outcome === 'user-not-found') {
      throw ApiError.notFound('User not found');
    }

    if (outcome === 'already-seated') {
      throw ApiError.conflict('That person is already seated in this pod');
    }

    const pod = await podRepository
      .listScoped(scopeOf(request.organizationId))
      .then((pods) => pods.find((entry) => entry.id === params.data.podId) ?? null);

    const payload: ApiSuccess<PodSummary | null> = { success: true, data: pod };
    response.status(201).json(payload);
  },
);

/** DELETE /pods/:podId/members/:userId — remove a person from the pod. */
podsRouter.delete(
  '/:podId/members/:userId',
  requirePermission('pod:manage'),
  async (request, response) => {
    const params = podMemberParamsSchema.safeParse(request.params);

    if (!params.success) {
      throw ApiError.badRequest('Invalid member path', formatIssues(params.error));
    }

    const removed = await podRepository.removeMemberScoped(
      scopeOf(request.organizationId),
      params.data.podId,
      params.data.userId,
    );

    if (!removed) {
      throw ApiError.notFound('That person is not seated in this pod');
    }

    response.status(204).send();
  },
);

/** POST /pods — stand up a pod and optionally seat its first members. */
podsRouter.post('/', requirePermission('pod:manage'), async (request, response) => {
  const body = createPodSchema.safeParse(request.body);

  if (!body.success) {
    throw ApiError.badRequest('Invalid pod payload', formatIssues(body.error));
  }

  const organizationId = scopeOf(request.organizationId);
  const memberIds = body.data.memberIds ?? [];

  // A pod is only useful if its people are real. Fail loudly rather than seating
  // a member that will silently never receive work.
  const known = await podRepository.existingUserIds(
    body.data.leadId ? [...memberIds, body.data.leadId] : memberIds,
  );
  const missing = (body.data.leadId ? [...memberIds, body.data.leadId] : memberIds).filter(
    (id) => !known.has(id),
  );

  if (missing.length > 0) {
    throw ApiError.badRequest('Unknown user in pod membership', [
      { path: 'memberIds', message: `Not found: ${missing.join(', ')}` },
    ]);
  }

  try {
    const created = await podRepository.createScoped(organizationId, {
      name: body.data.name,
      slug: body.data.slug ?? slugify(body.data.name, 'pod'),
      description: body.data.description ?? null,
      leadId: body.data.leadId ?? null,
      memberIds,
    });

    const payload: ApiSuccess<PodSummary> = { success: true, data: created };
    response.status(201).json(payload);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw ApiError.conflict('A pod with that slug already exists in this organization');
    }

    throw error;
  }
});
