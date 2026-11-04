import type {
  Deliverable,
  DeliverableStatus,
  DeliverableVersion,
  DeliveryHistory,
  DeliveryHistoryEntry,
} from '@gc3/types';
import { prisma } from '../db/client';
import { ApiError } from '../lib/api-error';

type DeliverableRow = {
  id: string;
  organizationId: string;
  requestId: string | null;
  title: string;
  description: string | null;
  status: DeliverableStatus;
  version: number;
  fileUrl: string | null;
  createdById: string | null;
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
    version: row.version,
    fileUrl: row.fileUrl,
    createdById: row.createdById,
    approvedById: row.approvedById,
    approvedAt: row.approvedAt ? row.approvedAt.toISOString() : null,
    releasedAt: row.releasedAt ? row.releasedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
  };
}

type VersionRow = {
  id: string;
  organizationId: string;
  deliverableId: string;
  version: number;
  title: string;
  description: string | null;
  fileUrl: string | null;
  createdById: string | null;
  changeNote: string | null;
  createdAt: Date;
};

function toVersionEntity(row: VersionRow): DeliverableVersion {
  return {
    id: row.id,
    organizationId: row.organizationId,
    deliverableId: row.deliverableId,
    version: row.version,
    title: row.title,
    description: row.description,
    fileUrl: row.fileUrl,
    createdById: row.createdById,
    changeNote: row.changeNote,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Statuses where the client has already been handed the content. */
function isClientFacing(status: DeliverableStatus): boolean {
  return status === 'APPROVED' || status === 'RELEASED';
}

export interface PatchDeliverableResult {
  readonly deliverable: Deliverable;
  /** True when a prior approval was invalidated by the new content. */
  readonly approvalReset: boolean;
}

export const deliverableRepository = {
  async createScoped(
    organizationId: string,
    input: {
      title: string;
      requestId?: string;
      description?: string;
      fileUrl?: string;
      /** The staff member producing it. Stamped by the route from the actor. */
      createdById?: string;
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

    // Version 1 is written with the row, so history is never missing a first entry.
    const row = await prisma.$transaction(async (tx) => {
      const created = await tx.deliverable.create({
        data: {
          organizationId,
          requestId: input.requestId ?? null,
          title: input.title,
          description: input.description ?? null,
          fileUrl: input.fileUrl ?? null,
          createdById: input.createdById ?? null,
          version: 1,
        },
      });

      await tx.deliverableVersion.create({
        data: {
          organizationId,
          deliverableId: created.id,
          version: 1,
          title: created.title,
          description: created.description,
          fileUrl: created.fileUrl,
          createdById: input.createdById ?? null,
          changeNote: 'Initial version',
        },
      });

      return created;
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
   * Edit or replace the content of a deliverable, producing a new version.
   *
   * If the deliverable was already approved or released, the approval is cleared
   * and the status drops back to PENDING: a human signed off on the *old* content,
   * and keeping that sign-off while swapping the file would let an approval
   * outlive the thing it approved (Brief §8.3).
   */
  async patchScoped(
    organizationId: string,
    id: string,
    input: {
      title?: string;
      description?: string | null;
      fileUrl?: string | null;
      changeNote?: string;
    },
    actorId?: string,
  ): Promise<PatchDeliverableResult | null> {
    const current = await prisma.deliverable.findFirst({
      where: { id, organizationId, deletedAt: null },
    });

    if (!current) {
      return null;
    }

    const nextVersion = current.version + 1;
    const approvalReset = isClientFacing(current.status);

    const nextTitle = input.title ?? current.title;
    const nextDescription =
      input.description !== undefined ? input.description : current.description;
    const nextFileUrl = input.fileUrl !== undefined ? input.fileUrl : current.fileUrl;

    const row = await prisma.$transaction(async (tx) => {
      const updated = await tx.deliverable.update({
        where: { id: current.id },
        data: {
          title: nextTitle,
          description: nextDescription,
          fileUrl: nextFileUrl,
          version: nextVersion,
          ...(approvalReset
            ? {
                status: 'PENDING' as const,
                approvedById: null,
                approvedAt: null,
                releasedAt: null,
              }
            : {}),
        },
      });

      await tx.deliverableVersion.create({
        data: {
          organizationId,
          deliverableId: current.id,
          version: nextVersion,
          title: nextTitle,
          description: nextDescription,
          fileUrl: nextFileUrl,
          createdById: actorId ?? null,
          changeNote: input.changeNote ?? null,
        },
      });

      return updated;
    });

    return { deliverable: toEntity(row), approvalReset };
  },

  /** Newest version first — the current content is always the head of the list. */
  async listVersionsScoped(
    organizationId: string,
    deliverableId: string,
  ): Promise<DeliverableVersion[]> {
    const rows = await prisma.deliverableVersion.findMany({
      where: { organizationId, deliverableId },
      orderBy: { version: 'desc' },
    });

    return rows.map(toVersionEntity);
  },

  /**
   * What the client has actually received, across the whole workspace: released
   * deliverables joined to the request they fulfil. Draft, pending and approved
   * work is deliberately absent — only release means "handed over".
   */
  async listHistoryScoped(organizationId: string, limit = 25): Promise<DeliveryHistory> {
    const where = {
      organizationId,
      status: 'RELEASED' as const,
      deletedAt: null,
    };

    const [rows, releasedCount, requestGroups] = await Promise.all([
      prisma.deliverable.findMany({
        where,
        include: { request: { select: { id: true, reference: true, title: true } } },
        orderBy: [{ releasedAt: 'desc' }, { createdAt: 'desc' }],
        take: limit,
      }),
      prisma.deliverable.count({ where }),
      prisma.deliverable.groupBy({ by: ['requestId'], where }),
    ]);

    const entries: DeliveryHistoryEntry[] = rows.map((row) => ({
      deliverableId: row.id,
      title: row.title,
      description: row.description,
      fileUrl: row.fileUrl,
      version: row.version,
      releasedAt: row.releasedAt ? row.releasedAt.toISOString() : null,
      requestId: row.request?.id ?? null,
      requestReference: row.request?.reference ?? null,
      requestTitle: row.request?.title ?? null,
    }));

    return {
      releasedCount,
      // Unattached deliverables (no request) do not count as covered requests.
      requestCount: requestGroups.filter((group) => group.requestId !== null).length,
      latestReleasedAt: entries[0]?.releasedAt ?? null,
      entries,
    };
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
