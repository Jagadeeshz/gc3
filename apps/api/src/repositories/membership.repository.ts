import type { ClientRole, Membership, MembershipStatus } from '@gc3/types';
import type { InviteUserInput } from '@gc3/validation';
import { prisma } from '../db/client';
import { ApiError } from '../lib/api-error';
import { generateInviteToken, hashInviteToken } from '../auth/invite';

type MembershipRow = {
  id: string;
  organizationId: string;
  userId: string;
  roles: readonly Membership['roles'][number][];
  status: MembershipStatus;
  createdAt: Date;
  updatedAt: Date;
  user: { email: string; fullName: string };
};

function toEntity(row: MembershipRow): Membership {
  return {
    id: row.id,
    organizationId: row.organizationId,
    userId: row.userId,
    roles: [...row.roles],
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export interface MembershipWithUser {
  readonly membership: Membership;
  readonly user: { readonly email: string; readonly fullName: string };
}

/** Result of creating an invitation. `inviteToken` is the plaintext token, returned once. */
export interface MembershipInvite extends MembershipWithUser {
  readonly inviteToken: string;
  readonly inviteExpiresAt: string;
}

/** The invitation as seen before authentication (no secrets). */
export interface InviteRecord {
  readonly membershipId: string;
  readonly organizationId: string;
  readonly organizationName: string;
  readonly userId: string;
  readonly email: string;
  readonly fullName: string;
  readonly roles: readonly ClientRole[];
  readonly status: MembershipStatus;
  readonly expiresAt: Date | null;
  readonly acceptedAt: Date | null;
}

/** Result of a successful acceptance. */
export interface AcceptedInvite {
  readonly membership: Membership;
  readonly userId: string;
  readonly email: string;
  readonly fullName: string;
  readonly organizationId: string;
  readonly organizationName: string;
  readonly roles: readonly ClientRole[];
}

/**
 * Every method takes the tenant scope as its first argument and filters on it.
 * There is deliberately no `findById` that skips the scope — the isolation rule
 * lives in the repository, not in the handler that happens to call it.
 */
export const membershipRepository = {
  async listScoped(organizationId: string): Promise<MembershipWithUser[]> {
    const rows = await prisma.membership.findMany({
      where: { organizationId },
      include: { user: { select: { email: true, fullName: true } } },
      orderBy: { createdAt: 'asc' },
    });

    return rows.map((row) => ({
      membership: toEntity(row),
      user: row.user,
    }));
  },

  /**
   * The caller's ACTIVE membership in the given tenant, or null. Consulted on
   * every permission check, so revoking a membership is effective immediately.
   */
  async findActiveScoped(
    organizationId: string,
    userId: string,
  ): Promise<{ id: string; roles: readonly string[] } | null> {
    return prisma.membership.findFirst({
      where: { organizationId, userId, status: 'ACTIVE' },
      select: { id: true, roles: true },
    });
  },

  /**
   * Invites a user to the tenant. The user identity is global (upserted by
   * email); the membership is the tenant-owned record and carries the roles.
   *
   * A one-time acceptance token is minted here: only its SHA-256 is stored, and
   * the plaintext is returned once so the caller (or the notification service)
   * can deliver it.
   */
  async inviteScoped(organizationId: string, input: InviteUserInput): Promise<MembershipInvite> {
    const invite = generateInviteToken();

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.upsert({
        where: { email: input.email },
        update: { fullName: input.fullName },
        create: { email: input.email, fullName: input.fullName },
      });

      const membership = await tx.membership.create({
        data: {
          organizationId,
          userId: user.id,
          roles: input.roles,
          status: 'INVITED',
          inviteTokenHash: invite.tokenHash,
          inviteTokenExpiresAt: invite.expiresAt,
        },
        include: { user: { select: { email: true, fullName: true } } },
      });

      await tx.auditEvent.create({
        data: {
          organizationId,
          actorType: 'SYSTEM',
          action: 'membership.invited',
          targetType: 'membership',
          targetId: membership.id,
        },
      });

      return { membership: toEntity(membership), user: membership.user };
    });

    return {
      ...result,
      inviteToken: invite.token,
      inviteExpiresAt: invite.expiresAt.toISOString(),
    };
  },

  /**
   * Looks up an invitation by its plaintext token. Used by the pre-auth preview;
   * returns null rather than throwing so the route decides the response shape.
   */
  async findByInviteToken(token: string): Promise<InviteRecord | null> {
    const row = await prisma.membership.findUnique({
      where: { inviteTokenHash: hashInviteToken(token) },
      include: {
        user: { select: { email: true, fullName: true } },
        organization: { select: { name: true } },
      },
    });

    if (!row) {
      return null;
    }

    return {
      membershipId: row.id,
      organizationId: row.organizationId,
      organizationName: row.organization.name,
      userId: row.userId,
      email: row.user.email,
      fullName: row.user.fullName,
      roles: [...row.roles] as readonly ClientRole[],
      status: row.status,
      expiresAt: row.inviteTokenExpiresAt,
      acceptedAt: row.inviteAcceptedAt,
    };
  },

  /**
   * Consumes an invitation: sets the password, activates the user and the
   * membership, and burns the token.
   *
   * Single use is enforced atomically — the claim is an `updateMany` filtered on
   * the *current* token hash and INVITED status, so two concurrent requests can
   * never both succeed.
   */
  async acceptInvite(token: string, passwordHash: string): Promise<AcceptedInvite> {
    const tokenHash = hashInviteToken(token);

    return prisma.$transaction(async (tx) => {
      const record = await tx.membership.findUnique({
        where: { inviteTokenHash: tokenHash },
        include: {
          user: { select: { email: true, fullName: true, status: true } },
          organization: { select: { name: true } },
        },
      });

      if (!record) {
        throw ApiError.inviteInvalid('This invitation link is not valid or has already been used');
      }

      if (record.inviteTokenExpiresAt && record.inviteTokenExpiresAt.getTime() < Date.now()) {
        throw ApiError.inviteExpired();
      }

      if (record.status === 'REVOKED') {
        throw ApiError.inviteInvalid('This invitation was revoked');
      }

      const claimed = await tx.membership.updateMany({
        where: { id: record.id, inviteTokenHash: tokenHash, status: 'INVITED' },
        data: {
          status: 'ACTIVE',
          inviteTokenHash: null,
          inviteAcceptedAt: new Date(),
        },
      });

      if (claimed.count !== 1) {
        throw ApiError.inviteInvalid('This invitation has already been accepted');
      }

      await tx.user.update({
        where: { id: record.userId },
        data: { passwordHash, status: 'ACTIVE' },
      });

      await tx.auditEvent.create({
        data: {
          organizationId: record.organizationId,
          actorType: 'USER',
          actorId: record.userId,
          action: 'membership.invite_accepted',
          targetType: 'membership',
          targetId: record.id,
        },
      });

      return {
        membership: {
          id: record.id,
          organizationId: record.organizationId,
          userId: record.userId,
          roles: [...record.roles],
          status: 'ACTIVE',
          createdAt: record.createdAt.toISOString(),
          updatedAt: record.updatedAt.toISOString(),
        } satisfies Membership,
        userId: record.userId,
        email: record.user.email,
        fullName: record.user.fullName,
        organizationId: record.organizationId,
        organizationName: record.organization.name,
        roles: [...record.roles] as readonly ClientRole[],
      };
    });
  },
};
