import type {
  FinanceOverview,
  Invoice,
  InvoiceDetail,
  InvoiceLineItem,
  InvoiceStatus,
} from '@gc3/types';
import { prisma } from '../db/client';
import {
  canTransition,
  computeBill,
  invoiceNumber,
  invoiceNumberPrefix,
  PAYMENT_TERM_DAYS,
} from '../lib/billing';
import { periodFromKey, periodLabel, periodFor, type PeriodBounds } from '../lib/period';
import { financeRepository } from './finance.repository';
import { usageRepository } from './usage.repository';

type InvoiceRow = {
  id: string;
  organizationId: string;
  number: string;
  status: InvoiceStatus;
  periodStart: Date;
  periodEnd: Date;
  currency: string;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  notes: string | null;
  issuedAt: Date | null;
  dueAt: Date | null;
  paidAt: Date | null;
  paidByUserId: string | null;
  voidedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type LineRow = {
  id: string;
  invoiceId: string;
  kind: string;
  description: string;
  quantity: number;
  unitAmountCents: number;
  amountCents: number;
  meterKey: string | null;
};

function toInvoice(row: InvoiceRow): Invoice {
  return {
    id: row.id,
    organizationId: row.organizationId,
    number: row.number,
    status: row.status,
    periodStart: row.periodStart.toISOString(),
    periodEnd: row.periodEnd.toISOString(),
    currency: row.currency,
    subtotalCents: row.subtotalCents,
    taxCents: row.taxCents,
    totalCents: row.totalCents,
    notes: row.notes,
    issuedAt: row.issuedAt ? row.issuedAt.toISOString() : null,
    dueAt: row.dueAt ? row.dueAt.toISOString() : null,
    paidAt: row.paidAt ? row.paidAt.toISOString() : null,
    paidByUserId: row.paidByUserId,
    voidedAt: row.voidedAt ? row.voidedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toLine(row: LineRow): InvoiceLineItem {
  return {
    id: row.id,
    invoiceId: row.invoiceId,
    kind: row.kind as InvoiceLineItem['kind'],
    description: row.description,
    quantity: row.quantity,
    unitAmountCents: row.unitAmountCents,
    amountCents: row.amountCents,
    meterKey: row.meterKey,
  };
}

export type GenerateOutcome =
  | { readonly ok: true; readonly invoice: InvoiceDetail }
  | { readonly ok: false; readonly reason: 'already-exists'; readonly invoiceId: string };

/**
 * Invoices.
 *
 * Generation is deterministic: for a given tenant, period, plan and usage it
 * produces the same lines every time, which is why an existing invoice for the
 * period is returned as a conflict rather than overwritten. Correcting a bill is a
 * credit note (ADJUSTMENT lines) in a later invoice, not an edit to a document a
 * client may already have.
 */
export const invoiceRepository = {
  /** Bills one period. Defaults to the last complete month. */
  async generate(
    organizationId: string,
    options: { period?: string; notes?: string | null; actorId?: string | null; now?: Date } = {},
  ): Promise<GenerateOutcome> {
    const now = options.now ?? new Date();
    // Default to the month before this one: billing the month you are standing in
    // would produce an invoice that is already stale.
    const bounds: PeriodBounds = options.period
      ? periodFromKey(options.period)
      : periodFromKey(previousMonthKey(periodFor(now).key));

    const { tier } = await financeRepository.ensureSubscription(organizationId, now);
    const usage = await usageRepository.snapshot(organizationId, bounds.key);

    const bill = computeBill({
      tier,
      usage: { requests: usage.REQUESTS, storageKb: usage.STORAGE_KB, apiCalls: usage.API_CALLS },
      periodLabel: periodLabel(bounds),
    });

    const existing = await prisma.invoice.findFirst({
      where: { organizationId, periodStart: bounds.start, status: { not: 'VOID' } },
      select: { id: true },
    });

    if (existing) {
      return { ok: false, reason: 'already-exists', invoiceId: existing.id };
    }

    const prefix = invoiceNumberPrefix(bounds.key);
    const sameMonth = await prisma.invoice.count({
      where: { organizationId, number: { startsWith: prefix } },
    });

    const created = await prisma.invoice.create({
      data: {
        organizationId,
        number: invoiceNumber(bounds.key, sameMonth + 1),
        status: 'DRAFT',
        periodStart: bounds.start,
        periodEnd: bounds.end,
        currency: tier.currency,
        subtotalCents: bill.subtotalCents,
        taxCents: bill.taxCents,
        totalCents: bill.totalCents,
        notes: options.notes ?? null,
        createdById: options.actorId ?? null,
        lineItems: {
          create: bill.lines.map((line) => ({
            organizationId,
            kind: line.kind,
            description: line.description,
            quantity: line.quantity,
            unitAmountCents: line.unitAmountCents,
            amountCents: line.amountCents,
            meterKey: line.meterKey,
          })),
        },
      },
      include: { lineItems: true },
    });

    return {
      ok: true,
      invoice: {
        ...toInvoice(created),
        lineItems: created.lineItems.map(toLine),
      },
    };
  },

  /** Tenant name for the printed document. */
  async organisationName(organizationId: string): Promise<string> {
    const organization = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true },
    });

    return organization?.name ?? 'Unknown organization';
  },

  /**
   * Flips ISSUED invoices past their due date to OVERDUE.
   *
   * Done lazily on read rather than by a scheduled job: the status is derived from
   * the due date, so any reader that cared could compute it — persisting it just
   * keeps the badge and the filter honest.
   */
  async syncOverdue(organizationId?: string): Promise<number> {
    const result = await prisma.invoice.updateMany({
      where: {
        ...(organizationId ? { organizationId } : {}),
        status: 'ISSUED',
        dueAt: { lt: new Date() },
      },
      data: { status: 'OVERDUE' },
    });

    return result.count;
  },

  async listScoped(
    organizationId: string,
    options: { status?: InvoiceStatus; page: number; pageSize: number } = { page: 1, pageSize: 20 },
  ): Promise<{ items: Invoice[]; total: number; page: number; pageSize: number }> {
    await this.syncOverdue(organizationId);

    const where = {
      organizationId,
      ...(options.status ? { status: options.status } : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        orderBy: [{ periodStart: 'desc' }, { number: 'desc' }],
        skip: (options.page - 1) * options.pageSize,
        take: options.pageSize,
      }),
      prisma.invoice.count({ where }),
    ]);

    return {
      items: rows.map(toInvoice),
      total,
      page: options.page,
      pageSize: options.pageSize,
    };
  },

  async findByIdScoped(organizationId: string, id: string): Promise<InvoiceDetail | null> {
    const row = await prisma.invoice.findFirst({
      where: { id, organizationId },
      include: { lineItems: { orderBy: { createdAt: 'asc' } } },
    });

    if (!row) {
      return null;
    }

    return { ...toInvoice(row), lineItems: row.lineItems.map(toLine) };
  },

  /**
   * Issues, settles or voids an invoice.
   *
   * `PAID` is only reachable from ISSUED or OVERDUE and records who said so. There
   * is no payment processor in this build: settling an invoice is a human
   * bookkeeping action, not something the platform infers.
   */
  async changeStatus(
    organizationId: string,
    id: string,
    next: 'ISSUED' | 'PAID' | 'VOID',
    actorId: string | null,
    note?: string,
  ): Promise<{ ok: true; invoice: InvoiceDetail } | { ok: false; reason: 'not-found' | 'illegal'; message: string }> {
    const current = await prisma.invoice.findFirst({
      where: { id, organizationId },
      select: { id: true, status: true, notes: true },
    });

    if (!current) {
      return { ok: false, reason: 'not-found', message: 'Invoice not found' };
    }

    if (!canTransition(current.status, next)) {
      return {
        ok: false,
        reason: 'illegal',
        message: `Cannot move an invoice from ${current.status} to ${next}`,
      };
    }

    const now = new Date();

    await prisma.invoice.update({
      where: { id },
      data: {
        status: next,
        ...(next === 'ISSUED'
          ? {
              issuedAt: now,
              dueAt: new Date(now.getTime() + PAYMENT_TERM_DAYS * 86_400_000),
            }
          : {}),
        ...(next === 'PAID' ? { paidAt: now, paidByUserId: actorId } : {}),
        ...(next === 'VOID' ? { voidedAt: now } : {}),
        ...(note ? { notes: note.slice(0, 500) } : {}),
      },
    });

    await prisma.auditEvent.create({
      data: {
        organizationId,
        actorType: actorId ? 'USER' : 'SYSTEM',
        actorId,
        action: `invoice.${next.toLowerCase()}`,
        targetType: 'invoice',
        targetId: id,
        metadata: { from: current.status, to: next },
      },
    });

    const updated = await this.findByIdScoped(organizationId, id);
    return { ok: true, invoice: updated! };
  },

  /** MRR, tier mix, invoice counts and recent bills — the platform money view. */
  async overview(): Promise<FinanceOverview> {
    await this.syncOverdue();

    const [subscriptions, tiers, counts, money, recent, organizations, usageThisPeriod] =
      await Promise.all([
        prisma.organizationSubscription.findMany({
          where: { status: 'ACTIVE' },
          select: { organizationId: true, tierId: true },
        }),
        prisma.subscriptionTier.findMany({ select: { id: true, code: true, name: true, monthlyPriceCents: true } }),
        financeRepository.countByStatus(),
        prisma.invoice.groupBy({
          by: ['status'],
          _sum: { totalCents: true },
          _count: { _all: true },
        }),
        prisma.invoice.findMany({
          orderBy: [{ createdAt: 'desc' }],
          take: 10,
          include: { organization: { select: { name: true } } },
        }),
        prisma.organization.findMany({
          where: { deletedAt: null },
          orderBy: { name: 'asc' },
          select: {
            id: true,
            name: true,
            subscription: {
              select: {
                status: true,
                tier: { select: { code: true, name: true, monthlyPriceCents: true } },
              },
            },
          },
        }),
        prisma.usageMeter.findMany({
          where: { period: periodFor().key, key: { in: ['REQUESTS', 'STORAGE_KB'] } },
          select: { organizationId: true, key: true, quantity: true },
        }),
      ]);

    const tierById = new Map(tiers.map((tier) => [tier.id, tier]));

    const byTier = tiers
      .map((tier) => {
        const organizations = subscriptions.filter((sub) => sub.tierId === tier.id).length;

        return {
          tierCode: tier.code,
          tierName: tier.name,
          organizations,
          mrrCents: organizations * tier.monthlyPriceCents,
        };
      })
      .filter((row) => row.organizations > 0 || row.mrrCents > 0)
      .sort((a, b) => b.mrrCents - a.mrrCents);

    const mrrCents = subscriptions.reduce(
      (total, sub) => total + (tierById.get(sub.tierId)?.monthlyPriceCents ?? 0),
      0,
    );

    const sumFor = (status: InvoiceStatus): number =>
      money.find((row) => row.status === status)?._sum.totalCents ?? 0;

    return {
      generatedAt: new Date().toISOString(),
      mrrCents,
      organizations: subscriptions.length,
      byTier,
      invoices: {
        draft: counts.DRAFT,
        issued: counts.ISSUED,
        paid: counts.PAID,
        overdue: counts.OVERDUE,
        void: counts.VOID,
        outstandingCents: sumFor('ISSUED') + sumFor('OVERDUE'),
        paidCents: sumFor('PAID'),
      },
      recent: recent.map((row) => ({ ...toInvoice(row), organizationName: row.organization.name })),
      tenants: organizations.map((organization) => {
        const requests = usageThisPeriod.find(
          (meter) => meter.organizationId === organization.id && meter.key === 'REQUESTS',
        );
        const storage = usageThisPeriod.find(
          (meter) => meter.organizationId === organization.id && meter.key === 'STORAGE_KB',
        );

        return {
          id: organization.id,
          name: organization.name,
          tierCode: organization.subscription?.tier.code ?? null,
          tierName: organization.subscription?.tier.name ?? null,
          status: organization.subscription?.status ?? null,
          mrrCents:
            organization.subscription?.status === 'ACTIVE'
              ? (organization.subscription?.tier.monthlyPriceCents ?? 0)
              : 0,
          requestsThisPeriod: requests?.quantity ?? 0,
          storageMbThisPeriod: Math.floor((storage?.quantity ?? 0) / 1_024),
        };
      }),
    };
  },
};

/** "2026-11" -> "2026-10", without pulling in a date library. */
function previousMonthKey(key: string): string {
  const year = Number(key.slice(0, 4));
  const month = Number(key.slice(5, 7));
  const date = new Date(Date.UTC(year, month - 2, 1));
  const paddedMonth = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  return `${date.getUTCFullYear()}-${paddedMonth}`;
}
