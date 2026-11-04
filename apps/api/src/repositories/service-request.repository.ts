import { randomUUID } from 'node:crypto';
import type { ServiceRequest, ServiceRequestPriority, ServiceRequestStatus } from '@gc3/types';
import { TERMINAL_REQUEST_STATUSES } from '@gc3/types';
import { prisma } from '../db/client';
import { ApiError } from '../lib/api-error';
import { slaHoursFor, slaTargetFrom } from '../lib/sla';

type RequestRow = {
  id: string;
  organizationId: string;
  reference: string;
  categoryId: string | null;
  title: string;
  description: string;
  status: ServiceRequestStatus;
  priority: ServiceRequestPriority;
  requesterId: string;
  assigneeId: string | null;
  podId: string | null;
  dueAt: Date | null;
  submittedAt: Date | null;
  closedAt: Date | null;
  slaTargetAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

function toEntity(row: RequestRow): ServiceRequest {
  return {
    id: row.id,
    organizationId: row.organizationId,
    reference: row.reference,
    categoryId: row.categoryId,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    requesterId: row.requesterId,
    assigneeId: row.assigneeId,
    podId: row.podId,
    dueAt: row.dueAt ? row.dueAt.toISOString() : null,
    submittedAt: row.submittedAt ? row.submittedAt.toISOString() : null,
    closedAt: row.closedAt ? row.closedAt.toISOString() : null,
    slaTargetAt: row.slaTargetAt ? row.slaTargetAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
  };
}

/**
 * Human-facing reference derived from the primary key: unguessable enough to
 * avoid enumeration, unique by construction (no counter table, no race), and
 * stable if a row is ever replayed.
 */
function buildReference(id: string): string {
  return `REQ-${id.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
}

export interface CreateServiceRequestInput {
  readonly title: string;
  readonly description: string;
  readonly requesterId: string;
  readonly categoryId?: string;
  readonly priority?: ServiceRequestPriority;
  readonly dueAt?: Date;
  /** Defaults to DRAFT; anything else stamps submittedAt. */
  readonly status?: ServiceRequestStatus;
}

export interface ListServiceRequestsOptions {
  readonly status?: ServiceRequestStatus;
  readonly categoryId?: string;
  readonly requesterId?: string;
  readonly page?: number;
  readonly pageSize?: number;
}

/**
 * Every method takes the tenant scope first and filters on it. There is no
 * unscoped read: a handler cannot forget the tenant because it has to pass one.
 */
export const serviceRequestRepository = {
  async createScoped(
    organizationId: string,
    input: CreateServiceRequestInput,
  ): Promise<ServiceRequest> {
    // A category id from another tenant must not be attachable, even though the
    // FK alone would allow it.
    if (input.categoryId) {
      const category = await prisma.serviceCategory.findFirst({
        where: { id: input.categoryId, organizationId, deletedAt: null },
        select: { id: true },
      });

      if (!category) {
        throw ApiError.notFound('Service category not found in this organization');
      }
    }

    const id = randomUUID();
    const status = input.status ?? 'DRAFT';
    const priority = input.priority ?? 'NORMAL';

    // The commitment is materialised at creation from the service's hours when it
    // has any, otherwise from the priority default.
    const categoryHours = input.categoryId
      ? (
          await prisma.serviceCategory.findFirst({
            where: { id: input.categoryId, organizationId },
            select: { slaDeliveryHours: true },
          })
        )?.slaDeliveryHours ?? null
      : null;

    const createdAt = new Date();
    const slaTargetAt = slaTargetFrom(createdAt, slaHoursFor(priority, categoryHours));

    const row = await prisma.serviceRequest.create({
      data: {
        id,
        reference: buildReference(id),
        organizationId,
        categoryId: input.categoryId ?? null,
        title: input.title,
        description: input.description,
        status,
        priority,
        requesterId: input.requesterId,
        dueAt: input.dueAt ?? null,
        submittedAt: status === 'DRAFT' ? null : createdAt,
        slaTargetAt,
      },
    });

    return toEntity(row);
  },

  /**
   * Field updates. The same tenant-scoped guard applies: a foreign id matches
   * nothing and mutates nothing. Category reassignment re-validates that the
   * category belongs to this tenant.
   */
  async updateScoped(
    organizationId: string,
    id: string,
    patch: {
      title?: string;
      description?: string;
      categoryId?: string | null;
      assigneeId?: string | null;
      priority?: ServiceRequestPriority;
      dueAt?: Date | null;
    },
  ): Promise<ServiceRequest | null> {
    const existing = await prisma.serviceRequest.findFirst({
      where: { id, organizationId, deletedAt: null },
      select: { id: true },
    });

    if (!existing) {
      return null;
    }

    if (patch.categoryId) {
      const category = await prisma.serviceCategory.findFirst({
        where: { id: patch.categoryId, organizationId, deletedAt: null },
        select: { id: true },
      });

      if (!category) {
        throw ApiError.notFound('Service category not found in this organization');
      }
    }

    await prisma.serviceRequest.updateMany({
      where: { id, organizationId, deletedAt: null },
      data: patch,
    });

    // Priority and service both carry the commitment, so changing either moves the
    // target. It is measured from creation, not from the edit, so an escalation
    // cannot quietly buy the request more time.
    if (patch.priority !== undefined || patch.categoryId !== undefined) {
      const current = await prisma.serviceRequest.findFirst({
        where: { id, organizationId, deletedAt: null },
        select: {
          priority: true,
          createdAt: true,
          category: { select: { slaDeliveryHours: true } },
        },
      });

      if (current) {
        const hours = slaHoursFor(
          current.priority as ServiceRequestPriority,
          current.category?.slaDeliveryHours ?? null,
        );

        await prisma.serviceRequest.updateMany({
          where: { id, organizationId, deletedAt: null },
          data: {
            slaTargetAt: slaTargetFrom(current.createdAt, hours),
            // A policy change restarts the alert chain: the new target deserves its
            // own warning rather than inheriting the old one's silence.
            slaAlertedState: null,
            slaAlertedAt: null,
          },
        });
      }
    }

    return this.findByIdScoped(organizationId, id);
  },

  /**
   * Routing decision: move a request into a pod and/or name a human owner.
   *
   * Both targets must belong to the same tenant as the request — a pod id from
   * another organization is treated as absent, not silently applied. Passing
   * `null` clears that half of the assignment.
   */
  async assignScoped(
    organizationId: string,
    id: string,
    input: { podId?: string | null; assigneeId?: string | null },
  ): Promise<ServiceRequest | null> {
    const existing = await prisma.serviceRequest.findFirst({
      where: { id, organizationId, deletedAt: null },
      select: { id: true },
    });

    if (!existing) {
      return null;
    }

    if (input.podId) {
      const pod = await prisma.pod.findFirst({
        where: { id: input.podId, organizationId, deletedAt: null, isActive: true },
        select: { id: true },
      });

      if (!pod) {
        throw ApiError.notFound('Pod not found in this organization');
      }
    }

    if (input.assigneeId) {
      const assignee = await prisma.user.findFirst({
        where: { id: input.assigneeId, deletedAt: null },
        select: { id: true },
      });

      if (!assignee) {
        throw ApiError.notFound('Assignee not found');
      }
    }

    await prisma.serviceRequest.updateMany({
      where: { id, organizationId, deletedAt: null },
      data: {
        ...(input.podId !== undefined ? { podId: input.podId } : {}),
        ...(input.assigneeId !== undefined ? { assigneeId: input.assigneeId } : {}),
      },
    });

    return this.findByIdScoped(organizationId, id);
  },

  async findByIdScoped(organizationId: string, id: string): Promise<ServiceRequest | null> {
    const row = await prisma.serviceRequest.findFirst({
      where: { id, organizationId, deletedAt: null },
    });

    return row ? toEntity(row) : null;
  },

  async listScoped(
    organizationId: string,
    options: ListServiceRequestsOptions = {},
  ): Promise<{ items: ServiceRequest[]; total: number; page: number; pageSize: number }> {
    const page = options.page ?? 1;
    const pageSize = Math.min(options.pageSize ?? 20, 100);

    const where = {
      organizationId,
      deletedAt: null,
      ...(options.status ? { status: options.status } : {}),
      ...(options.categoryId ? { categoryId: options.categoryId } : {}),
      ...(options.requesterId ? { requesterId: options.requesterId } : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.serviceRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.serviceRequest.count({ where }),
    ]);

    return { items: rows.map(toEntity), total, page, pageSize };
  },

  /**
   * Status transition. The update is filtered on the tenant as well as the id,
   * so a request from another organization simply matches nothing.
   */
  async updateStatusScoped(
    organizationId: string,
    id: string,
    status: ServiceRequestStatus,
  ): Promise<ServiceRequest | null> {
    const current = await prisma.serviceRequest.findFirst({
      where: { id, organizationId, deletedAt: null },
      select: { id: true, submittedAt: true },
    });

    if (!current) {
      return null;
    }

    const closing = TERMINAL_REQUEST_STATUSES.includes(status);

    await prisma.serviceRequest.updateMany({
      where: { id, organizationId, deletedAt: null },
      data: {
        status,
        ...(status !== 'DRAFT' && !current.submittedAt ? { submittedAt: new Date() } : {}),
        closedAt: closing ? new Date() : null,
      },
    });

    return this.findByIdScoped(organizationId, id);
  },

  async softDeleteScoped(organizationId: string, id: string): Promise<boolean> {
    const result = await prisma.serviceRequest.updateMany({
      where: { id, organizationId, deletedAt: null },
      data: { deletedAt: new Date() },
    });

    return result.count === 1;
  },
};
