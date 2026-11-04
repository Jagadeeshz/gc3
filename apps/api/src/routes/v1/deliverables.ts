import { Router } from 'express';
import type { ApiSuccess, DeliveryHistory, FileIntegrityReport } from '@gc3/types';
import {
  deliverableIdParamsSchema,
  deliveryHistoryQuerySchema,
  formatIssues,
} from '@gc3/validation';
import { ApiError } from '../../lib/api-error';
import { requireAuth, requirePermission } from '../../middleware/auth';
import { requireTenantScope } from '../../middleware/tenant-scope';
import { deliverableRepository } from '../../repositories/deliverable.repository';
import { fileStorage, sha256 } from '../../storage/local-storage';

/**
 * Workspace-level delivery views. Tenant-scoped like everything else: the client
 * sees exactly the assets released inside their own organization.
 */
export const deliverablesRouter: Router = Router();

deliverablesRouter.use(requireAuth, requireTenantScope);

/**
 * GET /deliverables/history
 *
 * The client-facing receipt: released assets across every request in the
 * workspace, newest release first, with the request each one fulfils. Anything not
 * released is absent by design — approval alone is not delivery.
 */
deliverablesRouter.get(
  '/history',
  requirePermission('deliverable:read'),
  async (request, response) => {
    const query = deliveryHistoryQuerySchema.safeParse(request.query);

    if (!query.success) {
      throw ApiError.badRequest('Invalid query', formatIssues(query.error));
    }

    const organizationId = request.organizationId;

    if (!organizationId) {
      throw ApiError.tenantScopeRequired();
    }

    const history = await deliverableRepository.listHistoryScoped(
      organizationId,
      query.data.limit,
    );

    const payload: ApiSuccess<DeliveryHistory> = { success: true, data: history };
    response.status(200).json(payload);
  },
);

/**
 * GET /deliverables/:deliverableId/file
 *
 * Streams the stored bytes. Auth-gated and tenant-scoped like everything else, and
 * the digest travels in a header so a caller can verify what it received without a
 * separate round trip.
 */
deliverablesRouter.get(
  '/:deliverableId/file',
  requirePermission('deliverable:read'),
  async (request, response) => {
    const params = deliverableIdParamsSchema.safeParse(request.params);

    if (!params.success) {
      throw ApiError.badRequest('Invalid deliverable id', formatIssues(params.error));
    }

    const organizationId = request.organizationId;

    if (!organizationId) {
      throw ApiError.tenantScopeRequired();
    }

    const deliverable = await deliverableRepository.findByIdScoped(
      organizationId,
      params.data.deliverableId,
    );

    if (!deliverable?.fileKey) {
      throw ApiError.notFound('No stored file for this deliverable');
    }

    const bytes = await fileStorage.get(deliverable.fileKey);

    response.setHeader('content-type', deliverable.fileMimeType ?? 'application/octet-stream');
    response.setHeader('content-length', String(bytes.length));
    response.setHeader('content-disposition', 'attachment');
    response.setHeader('cache-control', 'private, no-store');

    if (deliverable.fileSha256) {
      response.setHeader('x-checksum-sha256', deliverable.fileSha256);
    }

    response.status(200).send(bytes);
  },
);

/**
 * GET /deliverables/:deliverableId/file/integrity
 *
 * Re-reads the stored bytes and compares their digest with the one recorded at
 * upload time. This is the answer to "is the file we released still the file on
 * disk?" — a mismatch means the asset changed outside the audit trail.
 */
deliverablesRouter.get(
  '/:deliverableId/file/integrity',
  requirePermission('deliverable:read'),
  async (request, response) => {
    const params = deliverableIdParamsSchema.safeParse(request.params);

    if (!params.success) {
      throw ApiError.badRequest('Invalid deliverable id', formatIssues(params.error));
    }

    const organizationId = request.organizationId;

    if (!organizationId) {
      throw ApiError.tenantScopeRequired();
    }

    const deliverable = await deliverableRepository.findByIdScoped(
      organizationId,
      params.data.deliverableId,
    );

    if (!deliverable?.fileKey || !deliverable.fileSha256) {
      throw ApiError.notFound('No stored file for this deliverable');
    }

    const bytes = await fileStorage.get(deliverable.fileKey);
    const actualSha256 = sha256(bytes);

    const report: FileIntegrityReport = {
      deliverableId: deliverable.id,
      version: deliverable.version,
      fileKey: deliverable.fileKey,
      ok: actualSha256 === deliverable.fileSha256,
      expectedSha256: deliverable.fileSha256,
      actualSha256,
      sizeBytes: bytes.length,
      recordedSizeBytes: deliverable.fileSize,
    };

    const payload: ApiSuccess<FileIntegrityReport> = { success: true, data: report };
    response.status(200).json(payload);
  },
);
