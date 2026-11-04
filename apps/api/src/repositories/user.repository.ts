import type { AuthActor } from '@gc3/types';
import { prisma } from '../db/client';
import type { StaffRole } from '@gc3/types';

export interface AuthUserRow {
  readonly id: string;
  readonly email: string;
  readonly fullName: string;
  readonly status: 'INVITED' | 'ACTIVE' | 'SUSPENDED';
  readonly platformRole: StaffRole | null;
  readonly deletedAt: Date | null;
}

/**
 * Identity reads used by authentication. Unlike tenant data these are global by
 * nature — a user exists outside any organization — so they are intentionally
 * not scope-guarded.
 */
export const userRepository = {
  async findForLogin(email: string): Promise<(AuthUserRow & { passwordHash: string | null }) | null> {
    return prisma.user.findFirst({
      where: { email: email.toLowerCase(), deletedAt: null },
      select: {
        id: true,
        email: true,
        fullName: true,
        status: true,
        platformRole: true,
        deletedAt: true,
        passwordHash: true,
      },
    });
  },

  /** Re-read on every authenticated request so suspension takes effect at once. */
  async findActiveById(id: string): Promise<AuthUserRow | null> {
    return prisma.user.findFirst({
      where: { id, deletedAt: null },
      select: {
        id: true,
        email: true,
        fullName: true,
        status: true,
        platformRole: true,
        deletedAt: true,
      },
    });
  },

  async touchLastSeen(id: string): Promise<void> {
    await prisma.user.update({ where: { id }, data: { lastSeenAt: new Date() } });
  },

  /** Bootstrap path for GC3 staff. Not reachable over HTTP. */
  async upsertStaff(input: {
    email: string;
    fullName: string;
    passwordHash: string;
    platformRole: StaffRole;
  }): Promise<AuthUserRow> {
    return prisma.user.upsert({
      where: { email: input.email.toLowerCase() },
      update: {
        fullName: input.fullName,
        passwordHash: input.passwordHash,
        platformRole: input.platformRole,
        status: 'ACTIVE',
        deletedAt: null,
      },
      create: {
        email: input.email.toLowerCase(),
        fullName: input.fullName,
        passwordHash: input.passwordHash,
        platformRole: input.platformRole,
        status: 'ACTIVE',
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        status: true,
        platformRole: true,
        deletedAt: true,
      },
    });
  },
};

/** Maps a database user row to the actor attached to the request. */
export function toActor(row: AuthUserRow): AuthActor {
  return {
    userId: row.id,
    email: row.email,
    fullName: row.fullName,
    kind: row.platformRole ? 'STAFF' : 'CLIENT',
    platformRole: row.platformRole,
  };
}
