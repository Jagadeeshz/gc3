import { Router } from 'express';
import type { ApiSuccess, Membership, Organization, Paginated } from '@gc3/types';
import {
  createOrganizationSchema,
  formatIssues,
  inviteLifecycleParamsSchema,
  inviteUserSchema,
  membershipParamsSchema,
  organizationIdParamsSchema,
  updateMembershipRolesSchema,
  updateOrganizationSchema,
} from '@gc3/validation';
import { ApiError } from '../../lib/api-error';
import { isUniqueViolation } from '../../db/client';
import { organizationRepository } from '../../repositories/organization.repository';
import { membershipRepository } from '../../repositories/membership.repository';
import { requireMatchingTenant, requireTenantScope } from '../../middleware/tenant-scope';
import { requireAuth, requirePermission } from '../../middleware/auth';
import { deliverInvite } from '../../notifications/dispatch';
import type { DeliveryReceipt } from '../../notifications/types';
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

/**
 * PATCH /api/v1/organizations/:organizationId
 *
 * Edits the tenant's own record. Gated on `organization:update` and matched
 * against the tenant scope, so a caller can only edit the workspace they are
 * scoped to. Every changed field is written to the audit log with its before and
 * after value.
 */
organizationsRouter.patch(
  '/:organizationId',
  requireAuth,
  requireTenantScope,
  requirePermission('organization:update'),
  requireMatchingTenant,
  async (request, response) => {
    const params = organizationIdParamsSchema.safeParse(request.params);
    const parsed = updateOrganizationSchema.safeParse(request.body);

    if (!params.success) {
      throw ApiError.badRequest('Invalid organization id', formatIssues(params.error));
    }

    if (!parsed.success) {
      throw ApiError.badRequest('Invalid organization payload', formatIssues(parsed.error));
    }

    const actor = request.actor as { userId: string } | undefined;

    if (!actor) {
      throw ApiError.unauthenticated();
    }

    const raw = (request.body ?? {}) as Record<string, unknown>;

    // Only the fields the caller actually sent.
    //
    // `updateOrganizationSchema` is a partial of the create schema, and Zod still
    // applies a field's `.default()` when the key is absent — so passing the parsed
    // object straight through would silently rewrite a tenant's region or timezone
    // to the create-time defaults every time somebody renamed it. Caught by this
    // endpoint's own audit log, which recorded a `region` change nobody asked for.
    const input: { name?: string; slug?: string; timezone?: string; region?: string } = {};

    if ('name' in raw && parsed.data.name !== undefined) {
      input.name = parsed.data.name;
    }
    if ('slug' in raw && parsed.data.slug !== undefined) {
      input.slug = parsed.data.slug;
    }
    if ('timezone' in raw && parsed.data.timezone !== undefined) {
      input.timezone = parsed.data.timezone;
    }
    if ('region' in raw && parsed.data.region !== undefined) {
      input.region = parsed.data.region;
    }

    // Tenant status is a platform decision (suspension, offboarding), not something
    // a tenant edits about itself; refusing is better than quietly ignoring it.
    if ('status' in raw) {
      throw ApiError.badRequest('Organization status is changed by the platform, not through this endpoint', [
        { path: 'status', message: 'Not editable here' },
      ]);
    }

    try {
      const organization = await organizationRepository.updateScoped(
        request.organizationId as string,
        params.data.organizationId,
        input,
        {
          userId: actor.userId,
          ip: request.ip ?? null,
          userAgent: request.header('user-agent') ?? null,
          requestId: request.requestId ?? null,
        },
      );

      if (!organization) {
        throw ApiError.notFound(`Organization ${params.data.organizationId} was not found`);
      }

      const body: ApiSuccess<Organization> = { success: true, data: organization };
      response.status(200).json(body);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ApiError(409, 'CONFLICT', `Organization slug "${parsed.data.slug}" is taken`);
      }
      throw error;
    }
  },
);

/**
 * PATCH /api/v1/organizations/:organizationId/memberships/:userId/roles
 *
 * Changes a member's roles. `membership:manage` — held by platform admins and by
 * a tenant's own client owners, who already choose roles when they invite.
 *
 * The last ACTIVE owner cannot be demoted: a workspace with nobody able to
 * administer it is a support incident, not a permission change.
 */
organizationsRouter.patch(
  '/:organizationId/memberships/:userId/roles',
  requireAuth,
  requireTenantScope,
  requirePermission('membership:manage'),
  requireMatchingTenant,
  async (request, response) => {
    const params = membershipParamsSchema.safeParse(request.params);
    const parsed = updateMembershipRolesSchema.safeParse(request.body);

    if (!params.success) {
      throw ApiError.badRequest('Invalid membership parameters', formatIssues(params.error));
    }

    if (!parsed.success) {
      throw ApiError.badRequest('Invalid roles payload', formatIssues(parsed.error));
    }

    const actor = request.actor as { userId: string } | undefined;

    if (!actor) {
      throw ApiError.unauthenticated();
    }

    const outcome = await membershipRepository.changeRolesScoped(
      request.organizationId as string,
      params.data.userId,
      parsed.data.roles,
      {
        userId: actor.userId,
        ip: request.ip ?? null,
        userAgent: request.header('user-agent') ?? null,
        requestId: request.requestId ?? null,
      },
    );

    if (!outcome.ok) {
      if (outcome.reason === 'not-found') {
        throw ApiError.notFound('No active membership for that user in this organization');
      }

      throw ApiError.conflict(
        'This is the last active client owner: promote somebody else before changing these roles',
      );
    }

    const body: ApiSuccess<{ id: string; userId: string; roles: readonly string[] }> = {
      success: true,
      data: outcome.membership,
    };
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

      // Delivery is outside the transaction: the membership is already committed,
      // and a provider outage must not roll an invitation back.
      const delivery = await deliverInvite({
        organizationId: request.organizationId as string,
        membershipId: result.membership.id,
        userId: result.membership.userId,
        to: result.user.email,
        fullName: result.user.fullName,
        organizationName: result.organizationName,
        roles: result.membership.roles,
        token: result.inviteToken,
        expiresAt: result.inviteExpiresAt,
        kind: 'invitation',
      });

      // The plaintext invite token is a bearer credential. Outside production it
      // is returned so the caller can complete the flow without an email
      // service; in production it must travel by the notification channel only.
      const exposeToken = env.NODE_ENV !== 'production';

      const body: ApiSuccess<
        Membership & {
          user: { email: string; fullName: string };
          inviteToken?: string;
          inviteExpiresAt?: string;
          delivery: DeliveryReceipt;
        }
      > = {
        success: true,
        data: {
          ...result.membership,
          user: result.user,
          ...(exposeToken
            ? { inviteToken: result.inviteToken, inviteExpiresAt: result.inviteExpiresAt }
            : {}),
          delivery,
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

/**
 * POST /organizations/:organizationId/memberships/:userId/invite/resend
 *
 * Rotates the invitation token and re-delivers it. Rotation is what makes this
 * safe: the previously issued link is invalidated by the same write, so a leaked
 * or mis-sent invite cannot be used after a resend.
 *
 * A REVOKED membership is re-opened (an authorised caller is re-inviting);
 * an ACTIVE one is refused with 409.
 */
organizationsRouter.post(
  '/:organizationId/memberships/:userId/invite/resend',
  requireAuth,
  requireTenantScope,
  requirePermission('membership:invite'),
  requireMatchingTenant,
  async (request, response) => {
    const params = inviteLifecycleParamsSchema.safeParse(request.params);

    if (!params.success) {
      throw ApiError.badRequest('Invalid route parameters', formatIssues(params.error));
    }

    const rotation = await membershipRepository.rotateInviteScoped(
      request.organizationId as string,
      params.data.userId,
    );

    if (!rotation) {
      throw ApiError.notFound('No membership for that user in this organization');
    }

    const delivery = await deliverInvite({
      organizationId: request.organizationId as string,
      membershipId: rotation.membership.id,
      userId: rotation.membership.userId,
      to: rotation.user.email,
      fullName: rotation.user.fullName,
      organizationName: rotation.organizationName,
      roles: rotation.membership.roles,
      token: rotation.inviteToken,
      expiresAt: rotation.inviteExpiresAt,
      kind: 'resent',
    });

    const exposeToken = env.NODE_ENV !== 'production';

    response.status(200).json({
      success: true,
      data: {
        ...rotation.membership,
        user: rotation.user,
        reopened: rotation.reopened,
        ...(exposeToken
          ? { inviteToken: rotation.inviteToken, inviteExpiresAt: rotation.inviteExpiresAt }
          : {}),
        delivery,
      },
    });
  },
);

/**
 * DELETE /organizations/:organizationId/memberships/:userId/invite
 *
 * Cancels a pending invitation: the token is destroyed and the membership is
 * marked REVOKED. Idempotent. Refuses ACTIVE members with 409 — removing a live
 * member is offboarding, which needs its own semantics (sessions, retention).
 */
organizationsRouter.delete(
  '/:organizationId/memberships/:userId/invite',
  requireAuth,
  requireTenantScope,
  requirePermission('membership:revoke'),
  requireMatchingTenant,
  async (request, response) => {
    const params = inviteLifecycleParamsSchema.safeParse(request.params);

    if (!params.success) {
      throw ApiError.badRequest('Invalid route parameters', formatIssues(params.error));
    }

    const result = await membershipRepository.revokeInviteScoped(
      request.organizationId as string,
      params.data.userId,
    );

    if (!result) {
      throw ApiError.notFound('No membership for that user in this organization');
    }

    response.status(200).json({
      success: true,
      data: {
        membership: result.membership,
        alreadyRevoked: result.alreadyRevoked,
      },
    });
  },
);
