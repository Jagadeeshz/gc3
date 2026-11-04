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
import { requireAuth, requirePermission } from '../../middleware/auth';
import { env } from '../../config/env';

export const organizationsRouter: Router = Router();

/**
 * POST /api/v1/organizations
 *
 * Creates a tenant. Platform-level operation — deliberately NOT tenant-scoped,
 * because a tenant cannot create another tenant. Requires the
 * `organization:create` permission, granted to PLATFORM_ADMIN and
 * OPERATIONS_MANAGER only.
 */
organizationsRouter.post('/', requireAuth, requirePermission('organization:create'), async (request, response) => {
  const parsed = createOrganizationSchema.safeParse(request.body);

  if (!parsed.success) {
    throw ApiError.badRequest('Invalid organization payload', formatIssues(parsed.error));
  }

  try {
    const organization = await organizationRepository.create(parsed.data, request.actor?.userId);
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
  requireAuth,
  requireTenantScope,
  requirePermission('organization:read'),
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
  requireAuth,
  requireTenantScope,
  requirePermission('membership:read'),
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
  requireAuth,
  requireTenantScope,
  requirePermission('membership:invite'),
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

      // The plaintext invite token is a bearer credential. Outside production it
      // is returned so the caller can complete the flow without an email
      // service; in production it must travel by the notification channel only.
      const exposeToken = env.NODE_ENV !== 'production';

      const body: ApiSuccess<
        Membership & {
          user: { email: string; fullName: string };
          inviteToken?: string;
          inviteExpiresAt?: string;
        }
      > = {
        success: true,
        data: {
          ...result.membership,
          user: result.user,
          ...(exposeToken
            ? { inviteToken: result.inviteToken, inviteExpiresAt: result.inviteExpiresAt }
            : {}),
        },
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
