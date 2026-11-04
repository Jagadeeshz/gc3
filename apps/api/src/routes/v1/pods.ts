import { Router } from 'express';
import type { ApiSuccess, PodSummary } from '@gc3/types';
import { createPodSchema, formatIssues } from '@gc3/validation';
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
