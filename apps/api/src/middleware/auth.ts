import type { ClientRole, Permission } from '@gc3/types';
import type { RequestHandler } from 'express';
import { ApiError } from '../lib/api-error';
import { verifyAccessToken } from '../auth/tokens';
import { clientPermissions, hasPermission, staffPermissions } from '../auth/permissions';
import { membershipRepository } from '../repositories/membership.repository';
import { toActor, userRepository } from '../repositories/user.repository';

const BEARER = /^Bearer\s+(.+)$/i;

/**
 * Verifies the access token and re-loads the user.
 *
 * The database read is deliberate: a stateless token alone would keep a
 * suspended or soft-deleted user working until expiry. One indexed primary-key
 * lookup buys immediate revocation.
 */
export const requireAuth: RequestHandler = async (request, _response, next) => {
  const header = request.header('authorization');
  const match = header ? BEARER.exec(header) : null;

  if (!match?.[1]) {
    next(ApiError.unauthenticated('Missing or malformed Authorization header'));
    return;
  }

  const claims = await verifyAccessToken(match[1]);

  if (!claims) {
    next(ApiError.unauthenticated('Access token is invalid or has expired'));
    return;
  }

  const user = await userRepository.findActiveById(claims.userId);

  if (!user || user.status !== 'ACTIVE') {
    next(ApiError.unauthenticated('Account is not active'));
    return;
  }

  request.actor = toActor(user);
  next();
};

/**
 * Route-level authorization. Must run after `requireAuth` and, for tenant
 * routes, after `requireTenantScope` so membership permissions can be resolved.
 *
 * Route handlers never see a role — only a permission they either hold or don't.
 */
export function requirePermission(permission: Permission): RequestHandler {
  return async (request, _response, next) => {
    const actor = request.actor;

    if (!actor) {
      next(ApiError.unauthenticated());
      return;
    }

    const held: Permission[] = [...staffPermissions(actor.platformRole)];

    // Tenant-scoped request: add the permissions of the caller's ACTIVE membership.
    if (request.organizationId) {
      const membership = await membershipRepository.findActiveScoped(
        request.organizationId,
        actor.userId,
      );

      if (membership) {
        held.push(...clientPermissions(membership.roles as readonly ClientRole[]));
      }
    }

    if (!hasPermission(held, permission)) {
      next(
        ApiError.forbidden(
          `This action requires the "${permission}" permission, which your role does not grant`,
        ),
      );
      return;
    }

    next();
  };
}
