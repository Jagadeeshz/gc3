import { Router } from 'express';
import type { ApiSuccess, Membership, Organization, Paginated } from '@gc3/types';
import {
  createOrganizationSchema,
  formatIssues,
  inviteUserSchema,
  organizationIdParamsSchema,
} from '@gc3/validation';
import { ApiError } from '../../lib/api-error';
import { isUniqueViolation } from '../../db/client';
import { organizationRepository } from '../../repositories/organization.repository';
import { membershipRepository } from '../../repositories/membership.repository';
import { requireMatchingTenant, requireTenantScope } from '../../middleware/tenant-scope';

export const organizationsRouter: Router = Router();

/**
 * POST /api/v1/organizations
 *
 * Creates a tenant. This is a platform-level operation, so it is deliberately
 * NOT tenant-scoped — a tenant cannot create another tenant. Authentication and
 * the PLATFORM_ADMIN check land with the auth slice; until then this endpoint is
 * open and must not be exposed publicly.
 */
organizationsRouter.post('/', async (request, response) => {
  const parsed = createOrganizationSchema.safeParse(request.body);

  if (!parsed.success) {
    throw ApiError.badRequest('Invalid organization payload', formatIssues(parsed.error));
  }

  try {
    const organization = await organizationRepository.create(parsed.data);
    const body: ApiSuccess<Organization> = { success: true, data: organization };
    response.status(201).json(body);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ApiError(409, 'CONFLICT', `Organization slug "${parsed.data.slug}" is taken`);
    }
    throw error;
  }
});

/**
 * GET /api/v1/organizations/:organizationId
 *
 * Tenant-scoped read. Requires x-organization-id, and the route param must
 * match that scope (requireMatchingTenant).
 */
organizationsRouter.get(
  '/:organizationId',
  requireTenantScope,
  requireMatchingTenant,
  async (request, response) => {
    const params = organizationIdParamsSchema.safeParse(request.params);

    if (!params.success) {
      throw ApiError.badRequest('Invalid organization id', formatIssues(params.error));
    }

    const organization = await organizationRepository.findByIdScoped(
      request.organizationId as string,
      params.data.organizationId,
    );

    if (!organization) {
      throw ApiError.notFound(`Organization ${params.data.organizationId} was not found`);
    }

    const body: ApiSuccess<Organization> = { success: true, data: organization };
    response.status(200).json(body);
  },
);

/** GET /api/v1/organizations/:organizationId/memberships — tenant-scoped list. */
organizationsRouter.get(
  '/:organizationId/memberships',
  requireTenantScope,
  requireMatchingTenant,
  async (request, response) => {
    const scope = request.organizationId as string;
    const rows = await membershipRepository.listScoped(scope);

    const data: Paginated<Membership> & {
      items: (Membership & { user: { email: string; fullName: string } })[];
    } = {
      items: rows.map((row) => ({ ...row.membership, user: row.user })),
      page: 1,
      pageSize: rows.length,
      total: rows.length,
    };

    const body: ApiSuccess<typeof data> = { success: true, data };
    response.status(200).json(body);
  },
);

/** POST /api/v1/organizations/:organizationId/memberships — invite a member. */
organizationsRouter.post(
  '/:organizationId/memberships',
  requireTenantScope,
  requireMatchingTenant,
  async (request, response) => {
    const parsed = inviteUserSchema.safeParse(request.body);

    if (!parsed.success) {
      throw ApiError.badRequest('Invalid membership payload', formatIssues(parsed.error));
    }

    try {
      const result = await membershipRepository.inviteScoped(
        request.organizationId as string,
        parsed.data,
      );

      const body: ApiSuccess<Membership & { user: { email: string; fullName: string } }> = {
        success: true,
        data: { ...result.membership, user: result.user },
      };
      response.status(201).json(body);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ApiError(409, 'CONFLICT', 'This user is already a member of the organization');
      }
      throw error;
    }
  },
);
