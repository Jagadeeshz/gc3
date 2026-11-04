import { Router } from 'express';
import type { AuthProfile, AuthSession, Permission } from '@gc3/types';
import { formatIssues, loginSchema } from '@gc3/validation';
import { ApiError } from '../../lib/api-error';
import { DUMMY_DIGEST, verifyPassword } from '../../auth/password';
import { signAccessToken } from '../../auth/tokens';
import { staffPermissions } from '../../auth/permissions';
import { requireAuth } from '../../middleware/auth';
import { toActor, userRepository } from '../../repositories/user.repository';
import { env } from '../../config/env';

export const authRouter: Router = Router();

/**
 * POST /api/v1/auth/login
 *
 * Issues a short-lived access token. Unknown email, wrong password and
 * "invited but no password set" all return the same 401 with the same message,
 * and an unknown email still burns a full scrypt verification so response
 * timing does not enumerate accounts.
 */
authRouter.post('/login', async (request, response) => {
  const parsed = loginSchema.safeParse(request.body);

  if (!parsed.success) {
    throw ApiError.badRequest('Invalid credentials payload', formatIssues(parsed.error));
  }

  const { email, password } = parsed.data;
  const user = await userRepository.findForLogin(email);

  if (!user?.passwordHash) {
    await verifyPassword(password, DUMMY_DIGEST);
    throw ApiError.unauthenticated('Invalid email or password');
  }

  const passwordMatches = await verifyPassword(password, user.passwordHash);

  if (!passwordMatches) {
    throw ApiError.unauthenticated('Invalid email or password');
  }

  // Correct password but the account is not usable yet — still report it as a
  // credential failure to the caller, and say why in the server log only.
  if (user.status !== 'ACTIVE') {
    console.warn(`[gc3-api] login blocked for inactive user ${user.id} (status=${user.status})`);
    throw ApiError.unauthenticated('Invalid email or password');
  }

  const actor = toActor(user);
  const { token, expiresIn } = await signAccessToken({
    userId: user.id,
    email: user.email,
    platformRole: user.platformRole,
  });

  await userRepository.touchLastSeen(user.id);

  const body: { success: true; data: AuthSession } = {
    success: true,
    data: {
      accessToken: token,
      tokenType: 'Bearer',
      expiresIn,
      actor,
    },
  };

  response.status(200).json(body);
});

/**
 * GET /api/v1/auth/me
 *
 * Returns the caller plus the permissions they hold with no tenant in play.
 * Tenant-specific permissions are resolved per request by requirePermission.
 */
authRouter.get('/me', requireAuth, (request, response) => {
  const actor = request.actor;

  if (!actor) {
    throw ApiError.unauthenticated();
  }

  const body: { success: true; data: AuthProfile } = {
    success: true,
    data: {
      actor,
      permissions: [...staffPermissions(actor.platformRole)] as Permission[],
    },
  };

  response.status(200).json(body);
});

/** Surfaces the token lifetime so clients do not hardcode it. */
authRouter.get('/config', (_request, response) => {
  response.status(200).json({
    success: true,
    data: {
      tokenType: 'Bearer',
      expiresIn: env.AUTH_TOKEN_TTL_SECONDS,
      issuer: env.AUTH_ISSUER,
      audience: env.AUTH_AUDIENCE,
    },
  });
});
