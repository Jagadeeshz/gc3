import { Router } from 'express';
import type { ApiSuccess, ServiceCategory } from '@gc3/types';
import {
  createServiceCategorySchema,
  formatIssues,
  listServiceCategoriesQuerySchema,
  serviceCategoryIdParamsSchema,
  updateServiceCategorySchema,
} from '@gc3/validation';
import { ApiError } from '../../lib/api-error';
import { slugify as sharedSlugify } from '../../lib/slug';
import { requireAuth, requirePermission } from '../../middleware/auth';
import { requireTenantScope } from '../../middleware/tenant-scope';
import { serviceCategoryRepository } from '../../repositories/service-category.repository';

/**
 * Service category catalogue (Brief §6.2).
 *
 * Categories are tenant-owned: each organization curates its own list of
 * services, so there is no global row to special-case. Deleting one is a soft
 * delete — historical requests keep pointing at a real row, and the category
 * simply stops being offered.
 */
export const serviceCategoriesRouter: Router = Router();

serviceCategoriesRouter.use(requireAuth, requireTenantScope);

function scopeOf(organizationId: string | undefined): string {
  // Guaranteed by requireTenantScope; the throw is a type narrowing aid.
  if (!organizationId) {
    throw ApiError.badRequest('Tenant scope is required', [
      { path: 'x-organization-id', message: 'Missing tenant scope' },
    ]);
  }

  return organizationId;
}

/** "Cloud Migration & Ops" -> "cloud-migration-ops". */
function slugify(name: string): string {
  return sharedSlugify(name, 'category');
}

function isSlugConflict(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}

/** GET /service-categories — the catalogue, active only unless asked otherwise. */
serviceCategoriesRouter.get('/', requirePermission('category:read'), async (request, response) => {
  const query = listServiceCategoriesQuerySchema.safeParse(request.query);

  if (!query.success) {
    throw ApiError.badRequest('Invalid query', formatIssues(query.error));
  }

  const categories = await serviceCategoryRepository.listScoped(scopeOf(request.organizationId), {
    includeInactive: query.data.includeInactive,
  });

  const payload: ApiSuccess<ServiceCategory[]> = { success: true, data: categories };
  response.status(200).json(payload);
});

/** POST /service-categories — catalogue administration. */
serviceCategoriesRouter.post('/', requirePermission('category:manage'), async (request, response) => {
  const body = createServiceCategorySchema.safeParse(request.body);

  if (!body.success) {
    throw ApiError.badRequest('Invalid category payload', formatIssues(body.error));
  }

  try {
    const created = await serviceCategoryRepository.createScoped(scopeOf(request.organizationId), {
      name: body.data.name,
      slug: body.data.slug ?? slugify(body.data.name),
      ...(typeof body.data.description === 'string'
        ? { description: body.data.description }
        : {}),
      ...(body.data.slaDeliveryHours !== undefined
        ? { slaDeliveryHours: body.data.slaDeliveryHours }
        : {}),
    });

    const payload: ApiSuccess<ServiceCategory> = { success: true, data: created };
    response.status(201).json(payload);
  } catch (error) {
    if (isSlugConflict(error)) {
      throw ApiError.conflict('A category with that slug already exists in this organization');
    }

    throw error;
  }
});

/** PATCH /service-categories/:categoryId — rename, re-slug, re-describe, retire. */
serviceCategoriesRouter.patch(
  '/:categoryId',
  requirePermission('category:manage'),
  async (request, response) => {
    const params = serviceCategoryIdParamsSchema.safeParse(request.params);
    const body = updateServiceCategorySchema.safeParse(request.body);

    if (!params.success) {
      throw ApiError.badRequest('Invalid category id', formatIssues(params.error));
    }

    if (!body.success) {
      throw ApiError.badRequest('Invalid update payload', formatIssues(body.error));
    }

    try {
      const updated = await serviceCategoryRepository.updateScoped(
        scopeOf(request.organizationId),
        params.data.categoryId,
        body.data,
      );

      if (!updated) {
        throw ApiError.notFound('Service category not found');
      }

      const payload: ApiSuccess<ServiceCategory> = { success: true, data: updated };
      response.status(200).json(payload);
    } catch (error) {
      if (isSlugConflict(error)) {
        throw ApiError.conflict('A category with that slug already exists in this organization');
      }

      throw error;
    }
  },
);

/**
 * DELETE /service-categories/:categoryId
 *
 * Soft delete: the row stays so requests that reference it keep their label.
 * Repeating the call is a 404, which is honest — it is already gone.
 */
serviceCategoriesRouter.delete(
  '/:categoryId',
  requirePermission('category:manage'),
  async (request, response) => {
    const params = serviceCategoryIdParamsSchema.safeParse(request.params);

    if (!params.success) {
      throw ApiError.badRequest('Invalid category id', formatIssues(params.error));
    }

    const deleted = await serviceCategoryRepository.softDeleteScoped(
      scopeOf(request.organizationId),
      params.data.categoryId,
    );

    if (!deleted) {
      throw ApiError.notFound('Service category not found');
    }

    response.status(204).send();
  },
);
