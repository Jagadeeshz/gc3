import type {
  InvoiceStatus,
  OrganizationSubscription,
  SubscriptionOverview,
  SubscriptionStatus,
  SubscriptionTier,
  UsageMeterKey,
  UsageMeterSnapshot,
} from '@gc3/types';
import { prisma } from '../db/client';
import { periodFor, periodLabel } from '../lib/period';
import { usageRepository } from './usage.repository';

/**
 * Subscriptions and the plan a tenant is on.
 *
 * `ensureSubscription` is deliberately lazy: an organization created before this
 * table existed (or by any other path) gets the entry tier the first time anybody
 * looks, rather than the platform refusing to serve it. Nobody is silently put on
 * a paid plan by accident — STARTER is the floor of the catalogue, and changing it
 * is `finance:manage`, i.e. a human decision.
 */
type TierRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  monthlyPriceCents: number;
  currency: string;
  requestsIncluded: number;
  storageMbIncluded: number;
  apiCallsIncluded: number;
  seatsIncluded: number;
  requestOverageCents: number;
  storageMbOverageCents: number;
  apiCallsOverageCentsPer1k: number;
  isActive: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
};

type SubscriptionRow = {
  id: string;
  organizationId: string;
  tierId: string;
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  startedAt: Date;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

function toTier(row: TierRow): SubscriptionTier {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    monthlyPriceCents: row.monthlyPriceCents,
    currency: row.currency,
    requestsIncluded: row.requestsIncluded,
    storageMbIncluded: row.storageMbIncluded,
    apiCallsIncluded: row.apiCallsIncluded,
    seatsIncluded: row.seatsIncluded,
    requestOverageCents: row.requestOverageCents,
    storageMbOverageCents: row.storageMbOverageCents,
    apiCallsOverageCentsPer1k: row.apiCallsOverageCentsPer1k,
    isActive: row.isActive,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toSubscription(row: SubscriptionRow): OrganizationSubscription {
  return {
    id: row.id,
    organizationId: row.organizationId,
    tierId: row.tierId,
    status: row.status,
    currentPeriodStart: row.currentPeriodStart.toISOString(),
    currentPeriodEnd: row.currentPeriodEnd.toISOString(),
    startedAt: row.startedAt.toISOString(),
    cancelledAt: row.cancelledAt ? row.cancelledAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export interface MeterDefinition {
  readonly key: UsageMeterKey;
  readonly label: string;
  readonly unit: 'requests' | 'MB' | 'calls';
  /** Included allowance from the tier, converted into the meter's unit. */
  readonly included: (tier: SubscriptionTier) => number;
}

/**
 * The three meters, in display order. Storage arrives in KB but the plan speaks in
 * MB, so the conversion lives here rather than being re-derived at every call site.
 */
export const METERS: readonly MeterDefinition[] = [
  {
    key: 'REQUESTS',
    label: 'Service requests',
    unit: 'requests',
    included: (tier) => tier.requestsIncluded,
  },
  {
    key: 'STORAGE_KB',
    label: 'Deliverable storage',
    unit: 'MB',
    included: (tier) => tier.storageMbIncluded,
  },
  {
    key: 'API_CALLS',
    label: 'API calls',
    unit: 'calls',
    included: (tier) => tier.apiCallsIncluded,
  },
];

/** KB -> whole MB, rounded down: usage is never flattered upward. */
export function kbToMb(kb: number): number {
  return Math.floor(kb / 1024);
}

export function meterSnapshot(
  meter: MeterDefinition,
  tier: SubscriptionTier,
  quantityInMeterUnit: number,
): UsageMeterSnapshot {
  const included = meter.included(tier);
  const remaining = included - quantityInMeterUnit;
  const percentUsed = included === 0 ? (quantityInMeterUnit > 0 ? 100 : 0) : Math.round((quantityInMeterUnit / included) * 100);

  return {
    key: meter.key,
    quantity: quantityInMeterUnit,
    included,
    limit: included,
    remaining: Math.max(remaining, 0),
    percentUsed,
    state: remaining <= 0 ? 'EXCEEDED' : percentUsed >= 80 ? 'WARNING' : 'OK',
    unit: meter.unit,
  };
}

export const financeRepository = {
  async listTiers(includeInactive = false): Promise<SubscriptionTier[]> {
    const rows = await prisma.subscriptionTier.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
    });

    return rows.map(toTier);
  },

  async findTierByCode(code: string): Promise<SubscriptionTier | null> {
    const row = await prisma.subscriptionTier.findUnique({ where: { code } });
    return row ? toTier(row) : null;
  },

  /** The subscription for a tenant, creating the entry tier on first look. */
  async ensureSubscription(
    organizationId: string,
    now: Date = new Date(),
  ): Promise<{ subscription: OrganizationSubscription; tier: SubscriptionTier }> {
    const existing = await prisma.organizationSubscription.findUnique({
      where: { organizationId },
      include: { tier: true },
    });

    if (existing) {
      return { subscription: toSubscription(existing), tier: toTier(existing.tier) };
    }

    const fallback = await prisma.subscriptionTier.findFirst({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }],
    });

    if (!fallback) {
      throw new Error('No subscription tiers are configured — run db:seed:tiers');
    }

    const period = periodFor(now);

    const created = await prisma.organizationSubscription.create({
      data: {
        organizationId,
        tierId: fallback.id,
        status: 'ACTIVE',
        currentPeriodStart: period.start,
        currentPeriodEnd: period.end,
      },
      include: { tier: true },
    });

    await prisma.auditEvent.create({
      data: {
        organizationId,
        actorType: 'SYSTEM',
        action: 'subscription.auto_provisioned',
        targetType: 'organization_subscription',
        targetId: created.id,
        metadata: { tierCode: fallback.code, reason: 'no subscription existed' },
      },
    });

    return { subscription: toSubscription(created), tier: toTier(created.tier) };
  },

  /** Plan, allowances and this period's usage — what the billing page renders. */
  async overview(organizationId: string, now: Date = new Date()): Promise<SubscriptionOverview> {
    const { subscription, tier } = await this.ensureSubscription(organizationId, now);
    const period = periodFor(now);
    const usage = await usageRepository.snapshot(organizationId, period.key);

    return {
      subscription,
      tier,
      period: {
        start: period.start.toISOString(),
        end: period.end.toISOString(),
        label: periodLabel(period),
      },
      usage: METERS.map((meter) =>
        meterSnapshot(
          meter,
          tier,
          meter.key === 'STORAGE_KB' ? kbToMb(usage.STORAGE_KB) : usage[meter.key],
        ),
      ),
    };
  },

  /**
   * Moves a tenant onto another tier.
   *
   * This is a commercial action: it is gated on `finance:manage`, it is audited
   * with the actor and both tier codes, and it marks the subscription PAST_DUE
   * status untouched — plan changes never settle or create invoices.
   */
  async changeTier(
    organizationId: string,
    tierCode: string,
    actorId: string | null,
  ): Promise<{ subscription: OrganizationSubscription; tier: SubscriptionTier; previousTierCode: string }> {
    const tier = await this.findTierByCode(tierCode);

    if (!tier || !tier.isActive) {
      throw new Error(`Unknown or inactive tier: ${tierCode}`);
    }

    const { subscription: current, tier: previous } = await this.ensureSubscription(organizationId);

    if (current.tierId === tier.id) {
      return { subscription: current, tier, previousTierCode: previous.code };
    }

    const updated = await prisma.organizationSubscription.update({
      where: { organizationId },
      data: { tierId: tier.id },
      include: { tier: true },
    });

    await prisma.auditEvent.create({
      data: {
        organizationId,
        actorType: actorId ? 'USER' : 'SYSTEM',
        actorId,
        action: 'subscription.tier_changed',
        targetType: 'organization_subscription',
        targetId: updated.id,
        metadata: { from: previous.code, to: tier.code },
      },
    });

    return {
      subscription: toSubscription(updated),
      tier,
      previousTierCode: previous.code,
    };
  },

  /** Invoices in a set of statuses, for the platform view. */
  async countByStatus(): Promise<Record<InvoiceStatus, number>> {
    const rows = await prisma.invoice.groupBy({ by: ['status'], _count: { _all: true } });

    const counts: Record<InvoiceStatus, number> = {
      DRAFT: 0,
      ISSUED: 0,
      PAID: 0,
      OVERDUE: 0,
      VOID: 0,
    };

    for (const row of rows) {
      counts[row.status as InvoiceStatus] = row._count._all;
    }

    return counts;
  },
};
