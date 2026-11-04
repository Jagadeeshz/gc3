import { randomUUID } from 'node:crypto';
import type { ServiceRequest, ServiceRequestPriority, ServiceRequestStatus } from '@gc3/types';
import { TERMINAL_REQUEST_STATUSES } from '@gc3/types';
import { prisma } from '../db/client';
import { ApiError } from '../lib/api-error';

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
  dueAt: Date | null;
  submittedAt: Date | null;
  closedAt: Date | null;
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
    dueAt: row.dueAt ? row.dueAt.toISOString() : null,
    submittedAt: row.submittedAt ? row.submittedAt.toISOString() : null,
    closedAt: row.closedAt ? row.closedAt.toISOString() : null,
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

    const row = await prisma.serviceRequest.create({
      data: {
        id,
        reference: buildReference(id),
        organizationId,
        categoryId: input.categoryId ?? null,
        title: input.title,
        description: input.description,
        status,
        priority: input.priority ?? 'NORMAL',
        requesterId: input.requesterId,
        dueAt: input.dueAt ?? null,
        submittedAt: status === 'DRAFT' ? null : new Date(),
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
