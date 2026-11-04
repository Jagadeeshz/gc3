import type {
  OpsPodSummary,
  Pod,
  PodMemberSummary,
  PodSummary,
  StaffCandidate,
  StaffRole,
} from '@gc3/types';
import { prisma } from '../db/client';
import { OPEN_STATUSES } from '../lib/request-status';

type PodRow = {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  description: string | null;
  leadId: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

function toEntity(row: PodRow): Pod {
  return {
    id: row.id,
    organizationId: row.organizationId,
    name: row.name,
    slug: row.slug,
    description: row.description,
    leadId: row.leadId,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
  };
}

type MemberRow = {
  createdAt: Date;
  user: {
    id: string;
    fullName: string;
    email: string;
    platformRole: StaffRole | null;
  };
};

function toMemberSummary(row: MemberRow, requestsByUser: Map<string, number>): PodMemberSummary {
  return {
    userId: row.user.id,
    fullName: row.user.fullName,
    email: row.user.email,
    platformRole: row.user.platformRole,
    openRequests: requestsByUser.get(row.user.id) ?? 0,
    seatedAt: row.createdAt.toISOString(),
  };
}

const membersInclude = {
  members: {
    include: {
      user: { select: { id: true, fullName: true, email: true, platformRole: true } },
    },
    orderBy: { createdAt: 'asc' },
  },
} as const;

/**
 * Pods are tenant-owned like every other record: `organizationId` is required on
 * the row and every read here is scoped. `listForOps` is the single deliberate
 * exception — the operations console summary — and it is only mounted behind
 * `ops:read`.
 */
export const podRepository = {
  async createScoped(
    organizationId: string,
    input: {
      name: string;
      slug: string;
      description?: string | null;
      leadId?: string | null;
      memberIds?: readonly string[];
    },
  ): Promise<PodSummary> {
    const row = await prisma.pod.create({
      data: {
        organizationId,
        name: input.name,
        slug: input.slug,
        description: input.description ?? null,
        leadId: input.leadId ?? null,
        members: input.memberIds?.length
          ? {
              createMany: {
                data: input.memberIds.map((userId) => ({ organizationId, userId })),
                skipDuplicates: true,
              },
            }
          : undefined,
      },
      include: membersInclude,
    });

    return {
      ...toEntity(row),
      memberCount: row.members.length,
      openRequests: 0,
      members: row.members.map((member) => toMemberSummary(member, new Map())),
    };
  },

  async findByIdScoped(organizationId: string, id: string): Promise<Pod | null> {
    const row = await prisma.pod.findFirst({
      where: { id, organizationId, deletedAt: null },
    });

    return row ? toEntity(row) : null;
  },

  /** Every live pod in one tenant, with roster, per-person load and open work. */
  async listScoped(organizationId: string): Promise<PodSummary[]> {
    const [pods, load, requestsByUser] = await Promise.all([
      prisma.pod.findMany({
        where: { organizationId, deletedAt: null },
        include: membersInclude,
        orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
      }),
      prisma.serviceRequest.groupBy({
        by: ['podId'],
        where: {
          organizationId,
          deletedAt: null,
          podId: { not: null },
          status: { in: [...OPEN_STATUSES] },
        },
        _count: { _all: true },
      }),
      this.openRequestsByAssignee(organizationId),
    ]);

    const openByPod = new Map(load.map((entry) => [entry.podId ?? '', entry._count._all]));

    return pods.map((row) => ({
      ...toEntity(row),
      memberCount: row.members.length,
      openRequests: openByPod.get(row.id) ?? 0,
      members: row.members.map((member) => toMemberSummary(member, requestsByUser)),
    }));
  },

  /** Every live pod across every tenant — operations console only. */
  async listForOps(): Promise<OpsPodSummary[]> {
    const [pods, load, requestsByUser] = await Promise.all([
      prisma.pod.findMany({
        where: { deletedAt: null },
        include: {
          ...membersInclude,
          organization: { select: { name: true } },
        },
        orderBy: [{ name: 'asc' }],
      }),
      prisma.serviceRequest.groupBy({
        by: ['podId'],
        where: { deletedAt: null, podId: { not: null }, status: { in: [...OPEN_STATUSES] } },
        _count: { _all: true },
      }),
      this.openRequestsByAssignee(),
    ]);

    const openByPod = new Map(load.map((entry) => [entry.podId ?? '', entry._count._all]));

    return pods.map((row) => ({
      ...toEntity(row),
      memberCount: row.members.length,
      openRequests: openByPod.get(row.id) ?? 0,
      members: row.members.map((member) => toMemberSummary(member, requestsByUser)),
      organizationName: row.organization.name,
    }));
  },

  /** Open requests owned per person, scoped to a tenant when one is given. */
  async openRequestsByAssignee(organizationId?: string): Promise<Map<string, number>> {
    const rows = await prisma.serviceRequest.groupBy({
      by: ['assigneeId'],
      where: {
        ...(organizationId ? { organizationId } : {}),
        deletedAt: null,
        assigneeId: { not: null },
        status: { in: [...OPEN_STATUSES] },
      },
      _count: { _all: true },
    });

    return new Map(rows.map((row) => [row.assigneeId ?? '', row._count._all]));
  },

  /**
   * Seat a person in a pod. Returns a discriminated outcome so the route can pick
   * the status code without re-querying.
   */
  async addMemberScoped(
    organizationId: string,
    podId: string,
    userId: string,
  ): Promise<'added' | 'already-seated' | 'pod-not-found' | 'user-not-found'> {
    const [pod, user] = await Promise.all([
      prisma.pod.findFirst({
        where: { id: podId, organizationId, deletedAt: null },
        select: { id: true },
      }),
      prisma.user.findFirst({ where: { id: userId, deletedAt: null }, select: { id: true } }),
    ]);

    if (!pod) {
      return 'pod-not-found';
    }

    if (!user) {
      return 'user-not-found';
    }

    const existing = await prisma.podMember.findFirst({ where: { podId, userId } });

    if (existing) {
      return 'already-seated';
    }

    await prisma.podMember.create({ data: { organizationId, podId, userId } });

    return 'added';
  },

  /** Remove a person from a pod. False when they were not seated there. */
  async removeMemberScoped(
    organizationId: string,
    podId: string,
    userId: string,
  ): Promise<boolean> {
    const deleted = await prisma.podMember.deleteMany({
      where: { podId, userId, organizationId },
    });

    return deleted.count > 0;
  },

  /**
   * Staff accounts available to seat. Staff are platform users, not tenant
   * memberships, so the roster is global — but the pod count beside each person is
   * scoped to the calling tenant, which is the question the console is asking.
   */
  async listStaffCandidates(organizationId: string): Promise<StaffCandidate[]> {
    const [users, seats] = await Promise.all([
      prisma.user.findMany({
        where: { platformRole: { not: null }, status: 'ACTIVE', deletedAt: null },
        select: { id: true, fullName: true, email: true, platformRole: true },
        orderBy: [{ fullName: 'asc' }],
      }),
      prisma.podMember.groupBy({
        by: ['userId'],
        where: { organizationId },
        _count: { _all: true },
      }),
    ]);

    const podsByUser = new Map(seats.map((row) => [row.userId, row._count._all]));

    return users.map((user) => ({
      userId: user.id,
      fullName: user.fullName,
      email: user.email,
      platformRole: user.platformRole as StaffRole,
      podCount: podsByUser.get(user.id) ?? 0,
    }));
  },

  /** Ids of users that actually exist, so a bad member id cannot be seated. */
  async existingUserIds(ids: readonly string[]): Promise<Set<string>> {
    if (ids.length === 0) {
      return new Set();
    }

    const users = await prisma.user.findMany({
      where: { id: { in: [...ids] }, deletedAt: null },
      select: { id: true },
    });

    return new Set(users.map((user) => user.id));
  },
};
