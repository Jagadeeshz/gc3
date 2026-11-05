import { Router } from 'express';
import type { ApiSuccess, Invoice, InvoiceDetail, Paginated } from '@gc3/types';
import {
  formatIssues,
  generateInvoiceSchema,
  invoiceIdParamsSchema,
  invoiceStatusTransitionSchema,
  listInvoicesQuerySchema,
} from '@gc3/validation';
import { ApiError } from '../../lib/api-error';
import { formatMinorUnits } from '../../lib/billing';
import { requireAuth, requirePermission } from '../../middleware/auth';
import { requireTenantScope } from '../../middleware/tenant-scope';
import { invoiceRepository } from '../../repositories/invoice.repository';

/**
 * Invoices.
 *
 * Generation and reads are ordinary tenant operations. The money-moving step —
 * issuing, settling or voiding — is `finance:manage`, and settling records which
 * human said the money arrived: there is no payment processor here, and the API
 * does not invent one.
 */
export const invoicesRouter: Router = Router();

invoicesRouter.use(requireAuth, requireTenantScope);

function scopeOf(organizationId: string | undefined): string {
  if (!organizationId) {
    throw ApiError.badRequest('Tenant scope is required', [
      { path: 'x-organization-id', message: 'Missing tenant scope' },
    ]);
  }

  return organizationId;
}

/** GET /invoices — this tenant's bills, newest period first. */
invoicesRouter.get('/', requirePermission('finance:read'), async (request, response) => {
  const query = listInvoicesQuerySchema.safeParse(request.query);

  if (!query.success) {
    throw ApiError.badRequest('Invalid invoice query', formatIssues(query.error));
  }

  const page = await invoiceRepository.listScoped(scopeOf(request.organizationId), {
    ...(query.data.status ? { status: query.data.status } : {}),
    page: query.data.page,
    pageSize: query.data.pageSize,
  });

  const payload: ApiSuccess<Paginated<Invoice>> = { success: true, data: page };
  response.status(200).json(payload);
});

/**
 * POST /invoices/generate — bill one month.
 *
 * Idempotent by period: a second request for the same month returns 409 with the
 * existing invoice id, because a bill a client may already have must not silently
 * change.
 */
invoicesRouter.post(
  '/generate',
  requirePermission('finance:manage'),
  async (request, response) => {
    const body = generateInvoiceSchema.safeParse(request.body ?? {});

    if (!body.success) {
      throw ApiError.badRequest('Invalid generation payload', formatIssues(body.error));
    }

    const outcome = await invoiceRepository.generate(scopeOf(request.organizationId), {
      ...(body.data.period ? { period: body.data.period } : {}),
      notes: body.data.notes ?? null,
      actorId: request.actor?.userId ?? null,
    });

    if (!outcome.ok) {
      throw ApiError.conflict(
        `An invoice already exists for that period (${outcome.invoiceId})`,
      );
    }

    const payload: ApiSuccess<InvoiceDetail> = { success: true, data: outcome.invoice };
    response.status(201).json(payload);
  },
);

/** GET /invoices/:invoiceId — the bill with its lines. */
invoicesRouter.get('/:invoiceId', requirePermission('finance:read'), async (request, response) => {
  const params = invoiceIdParamsSchema.safeParse(request.params);

  if (!params.success) {
    throw ApiError.badRequest('Invalid invoice id', formatIssues(params.error));
  }

  const invoice = await invoiceRepository.findByIdScoped(
    scopeOf(request.organizationId),
    params.data.invoiceId,
  );

  if (!invoice) {
    throw ApiError.notFound('Invoice not found');
  }

  const payload: ApiSuccess<InvoiceDetail> = { success: true, data: invoice };
  response.status(200).json(payload);
});

/** PATCH /invoices/:invoiceId/status — issue, settle or void. */
invoicesRouter.patch(
  '/:invoiceId/status',
  requirePermission('finance:manage'),
  async (request, response) => {
    const params = invoiceIdParamsSchema.safeParse(request.params);
    const body = invoiceStatusTransitionSchema.safeParse(request.body);

    if (!params.success) {
      throw ApiError.badRequest('Invalid invoice id', formatIssues(params.error));
    }

    if (!body.success) {
      throw ApiError.badRequest('Invalid status payload', formatIssues(body.error));
    }

    const outcome = await invoiceRepository.changeStatus(
      scopeOf(request.organizationId),
      params.data.invoiceId,
      body.data.status,
      request.actor?.userId ?? null,
      body.data.note,
    );

    if (!outcome.ok) {
      if (outcome.reason === 'not-found') {
        throw ApiError.notFound(outcome.message);
      }

      throw ApiError.conflict(outcome.message);
    }

    const payload: ApiSuccess<InvoiceDetail> = { success: true, data: outcome.invoice };
    response.status(200).json(payload);
  },
);

/**
 * GET /invoices/:invoiceId/download — a printable invoice document.
 *
 * Plain text rather than a PDF service: it opens anywhere, diffs in an email, and
 * does not pretend to be a tax document produced by an invoicing engine.
 */
invoicesRouter.get(
  '/:invoiceId/download',
  requirePermission('finance:read'),
  async (request, response) => {
    const params = invoiceIdParamsSchema.safeParse(request.params);

    if (!params.success) {
      throw ApiError.badRequest('Invalid invoice id', formatIssues(params.error));
    }

    const invoice = await invoiceRepository.findByIdScoped(
      scopeOf(request.organizationId),
      params.data.invoiceId,
    );

    if (!invoice) {
      throw ApiError.notFound('Invoice not found');
    }

    const organisation = await invoiceRepository.organisationName(invoice.organizationId);
    const money = (minor: number) => formatMinorUnits(minor, invoice.currency);

    const lines = [
      'GC³ PORTAL — INVOICE',
      '='.repeat(60),
      `Invoice:   ${invoice.number}`,
      `Status:    ${invoice.status}`,
      `Billed to: ${organisation}`,
      `Period:    ${invoice.periodStart.slice(0, 10)} to ${invoice.periodEnd.slice(0, 10)}`,
      invoice.issuedAt ? `Issued:    ${invoice.issuedAt.slice(0, 10)}` : 'Issued:    (not issued)',
      invoice.dueAt ? `Due:       ${invoice.dueAt.slice(0, 10)}` : 'Due:       —',
      '',
      'LINES',
      '-'.repeat(60),
      ...invoice.lineItems.map(
        (line) =>
          `${line.description}\n  ${line.quantity} × ${money(line.unitAmountCents)} = ${money(line.amountCents)}`,
      ),
      '-'.repeat(60),
      `Subtotal:  ${money(invoice.subtotalCents)}`,
      `Tax:       ${money(invoice.taxCents)}`,
      `TOTAL:     ${money(invoice.totalCents)}`,
      '',
      invoice.paidAt ? `Paid:      ${invoice.paidAt.slice(0, 10)}` : '',
      invoice.notes ? `Notes:     ${invoice.notes}` : '',
      '='.repeat(60),
      'Generated by the GC³ Portal.',
    ].filter((line) => line !== '');

    response.setHeader('content-type', 'text/plain; charset=utf-8');
    response.setHeader(
      'content-disposition',
      `attachment; filename="${invoice.number}.txt"`,
    );
    response.status(200).send(lines.join('\n'));
  },
);
