import type { Deliverable, DeliverableStatus } from '@gc3/types';
import { prisma } from '../db/client';
import { ApiError } from '../lib/api-error';

type DeliverableRow = {
  id: string;
  organizationId: string;
  requestId: string | null;
  title: string;
  description: string | null;
  status: DeliverableStatus;
  fileUrl: string | null;
  approvedById: string | null;
  approvedAt: Date | null;
  releasedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

function toEntity(row: DeliverableRow): Deliverable {
  return {
    id: row.id,
    organizationId: row.organizationId,
    requestId: row.requestId,
    title: row.title,
    description: row.description,
    status: row.status,
    fileUrl: row.fileUrl,
    approvedById: row.approvedById,
    approvedAt: row.approvedAt ? row.approvedAt.toISOString() : null,
    releasedAt: row.releasedAt ? row.releasedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
  };
}

export const deliverableRepository = {
  async createScoped(
    organizationId: string,
    input: {
      title: string;
      requestId?: string;
      description?: string;
      fileUrl?: string;
    },
  ): Promise<Deliverable> {
    if (input.requestId) {
      const request = await prisma.serviceRequest.findFirst({
        where: { id: input.requestId, organizationId, deletedAt: null },
        select: { id: true },
      });

      if (!request) {
        throw ApiError.notFound('Service request not found in this organization');
      }
    }

    const row = await prisma.deliverable.create({
      data: {
        organizationId,
        requestId: input.requestId ?? null,
        title: input.title,
        description: input.description ?? null,
        fileUrl: input.fileUrl ?? null,
      },
    });

    return toEntity(row);
  },

  async findByIdScoped(organizationId: string, id: string): Promise<Deliverable | null> {
    const row = await prisma.deliverable.findFirst({
      where: { id, organizationId, deletedAt: null },
    });

    return row ? toEntity(row) : null;
  },

  async listForRequestScoped(
    organizationId: string,
    requestId: string,
  ): Promise<Deliverable[]> {
    const rows = await prisma.deliverable.findMany({
      where: { organizationId, requestId, deletedAt: null },
      orderBy: { createdAt: 'asc' },
    });

    return rows.map(toEntity);
  },

  /**
   * Status transition with the governance rules baked in:
   *
   *  - APPROVED must name the human approver, and stamps the approval time.
   *  - RELEASED is refused unless the deliverable already carries a human
   *    approval. That is the Development Brief §8.3 boundary: an agent may draft
   *    and propose, but it may not push a deliverable to the client.
   */
  async setStatusScoped(
    organizationId: string,
    id: string,
    status: DeliverableStatus,
    actorId?: string,
  ): Promise<Deliverable | null> {
    const current = await prisma.deliverable.findFirst({
      where: { id, organizationId, deletedAt: null },
      select: { id: true, approvedById: true },
    });

    if (!current) {
      return null;
    }

    if (status === 'APPROVED' && !actorId) {
      throw ApiError.forbidden('Approval requires an identified human approver');
    }

    if (status === 'RELEASED' && !current.approvedById) {
      throw ApiError.forbidden(
        'A deliverable cannot be released before a human has approved it',
      );
    }

    await prisma.deliverable.updateMany({
      where: { id, organizationId, deletedAt: null },
      data: {
        status,
        ...(status === 'APPROVED' && actorId
          ? { approvedById: actorId, approvedAt: new Date() }
          : {}),
        ...(status === 'RELEASED' ? { releasedAt: new Date() } : {}),
        ...(status === 'REJECTED' ? { approvedById: null, approvedAt: null } : {}),
      },
    });

    return this.findByIdScoped(organizationId, id);
  },
};
