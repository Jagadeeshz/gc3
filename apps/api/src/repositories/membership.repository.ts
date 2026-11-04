import type { Membership, MembershipStatus } from '@gc3/types';
import type { InviteUserInput } from '@gc3/validation';
import { prisma } from '../db/client';

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
   */
  async inviteScoped(organizationId: string, input: InviteUserInput): Promise<MembershipWithUser> {
    return prisma.$transaction(async (tx) => {
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
  },
};
