import { Router } from 'express';
import type {
  AccessibleOrganization,
  AuthProfile,
  AuthSession,
  InviteAcceptance,
  InvitePreview,
  Permission,
} from '@gc3/types';
import { acceptInviteSchema, formatIssues, inviteTokenSchema, loginSchema } from '@gc3/validation';
import { ApiError } from '../../lib/api-error';
import { DUMMY_DIGEST, hashPassword, verifyPassword } from '../../auth/password';
import { maskEmail } from '../../auth/invite';
import { signAccessToken } from '../../auth/tokens';
import { staffPermissions } from '../../auth/permissions';
import { requireAuth } from '../../middleware/auth';
import { membershipRepository } from '../../repositories/membership.repository';
import { organizationRepository } from '../../repositories/organization.repository';
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

/**
 * GET /api/v1/auth/organizations
 *
 * The tenants the caller may act in. The portal needs this to choose a value for
 * `x-organization-id`, and it is the only endpoint here that is scoped by *user*
 * rather than by tenant: a client sees exactly the organizations where their
 * membership is ACTIVE, and staff see the tenants their role covers.
 */
authRouter.get('/organizations', requireAuth, async (request, response) => {
  const actor = request.actor;

  if (!actor) {
    throw ApiError.unauthenticated();
  }

  const organizations: AccessibleOrganization[] = actor.platformRole
    ? (await organizationRepository.listAll()).map((organization) => ({
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        status: organization.status,
        roles: [],
      }))
    : await membershipRepository.listOrganizationsForUser(actor.userId);

  const body: { success: true; data: AccessibleOrganization[] } = {
    success: true,
    data: organizations,
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
      inviteTtlHours: env.INVITE_TTL_HOURS,
    },
  });
});

/**
 * GET /api/v1/auth/invite/:token
 *
 * Pre-authentication preview so the acceptance screen can say who the invite is
 * for and which organization it belongs to. The token is the only credential,
 * the email is masked, and no identifiers beyond what the invitee already knows
 * are exposed. 410 distinguishes "expired" from "unknown/already used".
 */
authRouter.get('/invite/:token', async (request, response) => {
  const parsed = inviteTokenSchema.safeParse(request.params.token);

  if (!parsed.success) {
    throw ApiError.inviteInvalid('Invitation token is malformed');
  }

  const record = await membershipRepository.findByInviteToken(parsed.data);

  if (!record || record.acceptedAt) {
    throw ApiError.inviteInvalid('This invitation link is not valid or has already been used');
  }

  if (record.status === 'REVOKED') {
    throw ApiError.inviteInvalid('This invitation was revoked');
  }

  if (record.expiresAt && record.expiresAt.getTime() < Date.now()) {
    throw ApiError.inviteExpired();
  }

  const body: { success: true; data: InvitePreview } = {
    success: true,
    data: {
      email: maskEmail(record.email),
      fullName: record.fullName,
      organizationName: record.organizationName,
      roles: record.roles,
      expiresAt: (record.expiresAt ?? new Date()).toISOString(),
    },
  };

  response.status(200).json(body);
});

/**
 * POST /api/v1/auth/accept-invite
 *
 * The invite token *is* the credential, so this route is public. On success the
 * user sets a password, both the user and the membership move to ACTIVE, the
 * token is burned, and a session is issued — the invitee never has to log in
 * twice.
 */
authRouter.post('/accept-invite', async (request, response) => {
  const parsed = acceptInviteSchema.safeParse(request.body);

  if (!parsed.success) {
    throw ApiError.badRequest('Invalid invitation payload', formatIssues(parsed.error));
  }

  const passwordHash = await hashPassword(parsed.data.password);
  const accepted = await membershipRepository.acceptInvite(parsed.data.token, passwordHash);

  const { token, expiresIn } = await signAccessToken({
    userId: accepted.userId,
    email: accepted.email,
    platformRole: null,
  });

  await userRepository.touchLastSeen(accepted.userId);

  const body: { success: true; data: InviteAcceptance } = {
    success: true,
    data: {
      accessToken: token,
      tokenType: 'Bearer',
      expiresIn,
      actor: {
        userId: accepted.userId,
        email: accepted.email,
        fullName: accepted.fullName,
        kind: 'CLIENT',
        platformRole: null,
      },
      organizationId: accepted.organizationId,
      organizationName: accepted.organizationName,
      roles: accepted.roles,
    },
  };

  response.status(200).json(body);
});
