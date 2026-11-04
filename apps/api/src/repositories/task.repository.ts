import type { Task, TaskListItem, TaskStatus } from '@gc3/types';
import { prisma } from '../db/client';

type TaskRow = {
  id: string;
  organizationId: string;
  requestId: string;
  podId: string | null;
  assigneeId: string | null;
  createdById: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  dueAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

type TaskRowWithNames = TaskRow & {
  assignee: { fullName: string } | null;
  pod: { name: string } | null;
};

function toEntity(row: TaskRow): Task {
  return {
    id: row.id,
    organizationId: row.organizationId,
    requestId: row.requestId,
    podId: row.podId,
    assigneeId: row.assigneeId,
    createdById: row.createdById,
    title: row.title,
    description: row.description,
    status: row.status,
    dueAt: row.dueAt ? row.dueAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
  };
}

function toListItem(row: TaskRowWithNames): TaskListItem {
  return {
    ...toEntity(row),
    assigneeName: row.assignee?.fullName ?? null,
    podName: row.pod?.name ?? null,
  };
}

const withNames = {
  assignee: { select: { fullName: true } },
  pod: { select: { name: true } },
} as const;

/**
 * Internal work items. Every query is tenant-scoped, and every request-scoped
 * write re-checks that the request belongs to the caller's tenant.
 */
export const taskRepository = {
  async createScoped(
    organizationId: string,
    requestId: string,
    input: {
      title: string;
      description?: string | null;
      assigneeId?: string | null;
      podId?: string | null;
      dueAt?: Date | null;
      createdById?: string | null;
    },
  ): Promise<TaskListItem | null> {
    const request = await prisma.serviceRequest.findFirst({
      where: { id: requestId, organizationId, deletedAt: null },
      select: { id: true, podId: true },
    });

    if (!request) {
      return null;
    }

    if (input.podId) {
      const pod = await prisma.pod.findFirst({
        where: { id: input.podId, organizationId, deletedAt: null },
        select: { id: true },
      });

      if (!pod) {
        return null;
      }
    }

    const row = await prisma.task.create({
      data: {
        organizationId,
        requestId,
        // A task inherits the pod the request is routed to unless told otherwise.
        podId: input.podId !== undefined ? input.podId : request.podId,
        assigneeId: input.assigneeId ?? null,
        createdById: input.createdById ?? null,
        title: input.title,
        description: input.description ?? null,
        dueAt: input.dueAt ?? null,
      },
      include: withNames,
    });

    return toListItem(row);
  },

  /** Every task on a request, oldest first — the checklist order. */
  async listForRequestScoped(
    organizationId: string,
    requestId: string,
  ): Promise<TaskListItem[]> {
    const rows = await prisma.task.findMany({
      where: { organizationId, requestId, deletedAt: null },
      include: withNames,
      orderBy: [{ createdAt: 'asc' }],
    });

    return rows.map(toListItem);
  },

  async findByIdScoped(organizationId: string, taskId: string): Promise<TaskListItem | null> {
    const row = await prisma.task.findFirst({
      where: { id: taskId, organizationId, deletedAt: null },
      include: withNames,
    });

    return row ? toListItem(row) : null;
  },

  async updateScoped(
    organizationId: string,
    taskId: string,
    patch: {
      title?: string;
      description?: string | null;
      status?: TaskStatus;
      assigneeId?: string | null;
      podId?: string | null;
      dueAt?: Date | null;
    },
  ): Promise<TaskListItem | null> {
    const existing = await prisma.task.findFirst({
      where: { id: taskId, organizationId, deletedAt: null },
      select: { id: true },
    });

    if (!existing) {
      return null;
    }

    if (patch.podId) {
      const pod = await prisma.pod.findFirst({
        where: { id: patch.podId, organizationId, deletedAt: null },
        select: { id: true },
      });

      if (!pod) {
        return null;
      }
    }

    await prisma.task.updateMany({
      where: { id: taskId, organizationId, deletedAt: null },
      data: patch,
    });

    return this.findByIdScoped(organizationId, taskId);
  },

  /** Open task counts per assignee, scoped to a tenant when one is given. */
  async openCountsByAssignee(organizationId?: string): Promise<Map<string, number>> {
    const rows = await prisma.task.groupBy({
      by: ['assigneeId'],
      where: {
        ...(organizationId ? { organizationId } : {}),
        deletedAt: null,
        assigneeId: { not: null },
        status: { in: ['TODO', 'IN_PROGRESS', 'BLOCKED'] },
      },
      _count: { _all: true },
    });

    return new Map(rows.map((row) => [row.assigneeId ?? '', row._count._all]));
  },

  /** Open work per pod — what the operations console shows beside each pod. */
  async openCountsByPod(organizationId?: string): Promise<Map<string, number>> {
    const rows = await prisma.task.groupBy({
      by: ['podId'],
      where: {
        ...(organizationId ? { organizationId } : {}),
        deletedAt: null,
        podId: { not: null },
        status: { in: ['TODO', 'IN_PROGRESS', 'BLOCKED'] },
      },
      _count: { _all: true },
    });

    return new Map(rows.map((row) => [row.podId ?? '', row._count._all]));
  },
};
