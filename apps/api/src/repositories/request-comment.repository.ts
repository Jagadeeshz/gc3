import type { RequestComment } from '@gc3/types';
import { prisma } from '../db/client';
import { ApiError } from '../lib/api-error';

type CommentRow = {
  id: string;
  organizationId: string;
  requestId: string;
  authorId: string;
  body: string;
  isInternal: boolean;
  createdAt: Date;
  updatedAt: Date;
};

function toEntity(row: CommentRow): RequestComment {
  return {
    id: row.id,
    organizationId: row.organizationId,
    requestId: row.requestId,
    authorId: row.authorId,
    body: row.body,
    isInternal: row.isInternal,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Comments carry their own organizationId even though requestId already implies
 * a tenant. That redundancy is deliberate: it makes the isolation check a plain
 * index hit instead of a join, and it means a bug in the request lookup cannot
 * silently widen the result set.
 */
export const requestCommentRepository = {
  async createScoped(
    organizationId: string,
    input: { requestId: string; authorId: string; body: string; isInternal?: boolean },
  ): Promise<RequestComment> {
    const request = await prisma.serviceRequest.findFirst({
      where: { id: input.requestId, organizationId, deletedAt: null },
      select: { id: true },
    });

    if (!request) {
      throw ApiError.notFound('Service request not found in this organization');
    }

    const row = await prisma.requestComment.create({
      data: {
        organizationId,
        requestId: input.requestId,
        authorId: input.authorId,
        body: input.body,
        isInternal: input.isInternal ?? false,
      },
    });

    return toEntity(row);
  },

  /**
   * Client-facing reads exclude internal notes by default; staff views opt in.
   * The filter is a parameter rather than a call-site `where`, so a client route
   * cannot accidentally request the unfiltered list.
   */
  async listForRequestScoped(
    organizationId: string,
    requestId: string,
    options: { includeInternal?: boolean } = {},
  ): Promise<RequestComment[]> {
    const rows = await prisma.requestComment.findMany({
      where: {
        organizationId,
        requestId,
        ...(options.includeInternal ? {} : { isInternal: false }),
      },
      orderBy: { createdAt: 'asc' },
    });

    return rows.map(toEntity);
  },
};
