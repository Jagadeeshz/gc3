import type { OpsPodSummary, Pod, PodSummary } from '@gc3/types';
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
      include: { _count: { select: { members: true } } },
    });

    return { ...toEntity(row), memberCount: row._count.members, openRequests: 0 };
  },

  async findByIdScoped(organizationId: string, id: string): Promise<Pod | null> {
    const row = await prisma.pod.findFirst({
      where: { id, organizationId, deletedAt: null },
    });

    return row ? toEntity(row) : null;
  },

  /** Every live pod in one tenant, with member and open-request counts. */
  async listScoped(organizationId: string): Promise<PodSummary[]> {
    const [pods, load] = await Promise.all([
      prisma.pod.findMany({
        where: { organizationId, deletedAt: null },
        include: { _count: { select: { members: true } } },
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
    ]);

    const openByPod = new Map(load.map((entry) => [entry.podId ?? '', entry._count._all]));

    return pods.map((row) => ({
      ...toEntity(row),
      memberCount: row._count.members,
      openRequests: openByPod.get(row.id) ?? 0,
    }));
  },

  /** Every live pod across every tenant — operations console only. */
  async listForOps(): Promise<OpsPodSummary[]> {
    const [pods, load] = await Promise.all([
      prisma.pod.findMany({
        where: { deletedAt: null },
        include: {
          _count: { select: { members: true } },
          organization: { select: { name: true } },
        },
        orderBy: [{ name: 'asc' }],
      }),
      prisma.serviceRequest.groupBy({
        by: ['podId'],
        where: { deletedAt: null, podId: { not: null }, status: { in: [...OPEN_STATUSES] } },
        _count: { _all: true },
      }),
    ]);

    const openByPod = new Map(load.map((entry) => [entry.podId ?? '', entry._count._all]));

    return pods.map((row) => ({
      ...toEntity(row),
      memberCount: row._count.members,
      openRequests: openByPod.get(row.id) ?? 0,
      organizationName: row.organization.name,
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
