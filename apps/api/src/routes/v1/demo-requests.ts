import { Router } from 'express';
import { createHash } from 'node:crypto';
import type { ApiSuccess } from '@gc3/types';
import { demoRequestSchema, formatIssues } from '@gc3/validation';
import { ApiError } from '../../lib/api-error';
import { prisma } from '../../db/client';
import { recordAudit } from '../../audit/audit-log';

/**
 * `POST /demo-requests` — the public "Book a demo" form.
 *
 * Unauthenticated by necessity: the person filling it in has no account. That makes
 * this the most exposed write in the platform, so it is deliberately narrow:
 *
 *   · a strict schema with bounded strings, so nothing arbitrary lands in the table
 *   · the caller's IP is hashed, never stored raw — enough to spot a flood, not a
 *     record of who visited
 *   · the response is identical for every accepted submission, so the endpoint cannot
 *     be used to probe which companies already exist
 *
 * It stores a request; it does not create a user, a tenant or a pipeline entry. That
 * is a human decision, not a form submission.
 */
export const demoRequestsRouter: Router = Router();

demoRequestsRouter.post('/', async (request, response) => {
  const parsed = demoRequestSchema.safeParse(request.body);

  if (!parsed.success) {
    throw ApiError.badRequest('Invalid demo request', formatIssues(parsed.error));
  }

  const { email, fullName, companyName, companySize, message, source } = parsed.data;

  const ip = request.ip ?? request.socket.remoteAddress ?? '';
  const ipHash = ip.length > 0 ? createHash('sha256').update(ip).digest('hex') : null;

  const created = await prisma.demoRequest.create({
    data: {
      email: email.toLowerCase(),
      fullName,
      companyName,
      companySize,
      message: message ?? null,
      source: source ?? 'website',
      ipHash,
    },
    select: { id: true, createdAt: true },
  });

  // Recorded so a demo request is visible in the security log alongside every other
  // consequential write, without needing the row itself.
  await recordAudit({
    actorType: 'SYSTEM',
    action: 'demo.request.created',
    targetType: 'DemoRequest',
    targetId: created.id,
    organizationId: null,
    metadata: { companySize, source: source ?? 'website' },
  });

  const payload: ApiSuccess<{ readonly id: string; readonly receivedAt: string }> = {
    success: true,
    data: { id: created.id, receivedAt: created.createdAt.toISOString() },
  };

  response.status(201).json(payload);
});
