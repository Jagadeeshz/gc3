import type { InvoiceLineItemKind, SubscriptionTier, UsageMeterKey } from '@gc3/types';

/**
 * Invoice arithmetic.
 *
 * Pure on purpose: every rupee on a bill is computed here, with no database and no
 * clock, so the numbers can be tested directly rather than inferred from an API
 * response. Anything that needs the current month gets it passed in.
 */
export interface BillableLine {
  readonly kind: InvoiceLineItemKind;
  readonly description: string;
  readonly quantity: number;
  readonly unitAmountCents: number;
  readonly amountCents: number;
  readonly meterKey: UsageMeterKey | null;
}

export interface BillableUsage {
  readonly requests: number;
  /** Storage in KB, as metered. */
  readonly storageKb: number;
  readonly apiCalls: number;
}

export interface BillComputation {
  readonly lines: readonly BillableLine[];
  readonly subtotalCents: number;
  readonly taxCents: number;
  readonly totalCents: number;
}

/** API calls are sold in blocks of 1,000; a part block is billed as a block. */
export const API_CALL_BLOCK = 1_000;

/** KB -> whole MB. Rounded down: usage is never flattered upward. */
export function toMegabytes(kb: number): number {
  return Math.floor(kb / 1_024);
}

/** Money for humans: 2500000 paise -> "₹25,000.00". */
export function formatMinorUnits(minor: number, currency = 'INR'): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(minor / 100);
}

/**
 * Builds the lines for one period.
 *
 * Two kinds of line, in this order: the fixed plan fee, then one line per meter
 * that went over its allowance. Nothing is charged for usage inside the
 * allowance, and nothing is credited for unused allowance — that is the deal the
 * price list describes.
 */
export function computeBill(input: {
  readonly tier: SubscriptionTier;
  readonly usage: BillableUsage;
  readonly periodLabel: string;
}): BillComputation {
  const { tier, usage, periodLabel } = input;
  const lines: BillableLine[] = [];

  // 1. The plan itself.
  lines.push({
    kind: 'TIER_FEE',
    description: `${tier.name} plan — ${periodLabel}`,
    quantity: 1,
    unitAmountCents: tier.monthlyPriceCents,
    amountCents: tier.monthlyPriceCents,
    meterKey: null,
  });

  // 2. Service requests over the allowance.
  const requestOverage = Math.max(usage.requests - tier.requestsIncluded, 0);

  if (requestOverage > 0) {
    lines.push({
      kind: 'USAGE',
      description: `Additional service requests (${usage.requests} used, ${tier.requestsIncluded} included)`,
      quantity: requestOverage,
      unitAmountCents: tier.requestOverageCents,
      amountCents: requestOverage * tier.requestOverageCents,
      meterKey: 'REQUESTS',
    });
  }

  // 3. Storage over the allowance, billed per MB.
  const usedMb = toMegabytes(usage.storageKb);
  const storageOverage = Math.max(usedMb - tier.storageMbIncluded, 0);

  if (storageOverage > 0) {
    lines.push({
      kind: 'USAGE',
      description: `Additional storage (${usedMb} MB used, ${tier.storageMbIncluded} MB included)`,
      quantity: storageOverage,
      unitAmountCents: tier.storageMbOverageCents,
      amountCents: storageOverage * tier.storageMbOverageCents,
      meterKey: 'STORAGE_KB',
    });
  }

  // 4. API calls over the allowance, in 1,000-call blocks.
  const callOverage = Math.max(usage.apiCalls - tier.apiCallsIncluded, 0);

  if (callOverage > 0) {
    const blocks = Math.ceil(callOverage / API_CALL_BLOCK);

    lines.push({
      kind: 'USAGE',
      description: `Additional API calls (${usage.apiCalls} used, ${tier.apiCallsIncluded} included, billed per ${API_CALL_BLOCK.toLocaleString('en-IN')})`,
      quantity: blocks,
      unitAmountCents: tier.apiCallsOverageCentsPer1k,
      amountCents: blocks * tier.apiCallsOverageCentsPer1k,
      meterKey: 'API_CALLS',
    });
  }

  const subtotalCents = lines.reduce((total, line) => total + line.amountCents, 0);

  // Tax is not configured for this deployment: there is no rate table and no
  // jurisdiction rule set, so inventing one would be worse than stating zero.
  const taxCents = 0;

  return { lines, subtotalCents, taxCents, totalCents: subtotalCents + taxCents };
}

/** INV-2026-11-0001 — sortable, per tenant, and obviously a month's bill. */
export function invoiceNumberPrefix(periodKey: string): string {
  return `INV-${periodKey}-`;
}

export function invoiceNumber(periodKey: string, sequence: number): string {
  return `${invoiceNumberPrefix(periodKey)}${String(sequence).padStart(4, '0')}`;
}

/** Which status moves are legal. Everything else is a 409. */
export function canTransition(from: string, to: 'ISSUED' | 'PAID' | 'VOID'): boolean {
  if (to === 'ISSUED') {
    return from === 'DRAFT';
  }

  if (to === 'PAID') {
    return from === 'ISSUED' || from === 'OVERDUE';
  }

  // Anything unpaid can be voided; a settled invoice cannot.
  return from !== 'PAID' && from !== 'VOID';
}

/** Net 30 from issue. A payment-terms decision, in one place. */
export const PAYMENT_TERM_DAYS = 30;
