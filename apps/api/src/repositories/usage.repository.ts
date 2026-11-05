import type { UsageMeterKey } from '@gc3/types';
import { prisma } from '../db/client';
import { periodFor } from '../lib/period';

/**
 * Usage meters.
 *
 * One counter per tenant, meter and period, incremented as the platform is used.
 * The upsert is atomic at the database level, so two concurrent requests cannot
 * lose an increment — which is the only interesting property of a meter.
 *
 * Storage is metered in **KB**, not bytes: 2^31 KB is about 2 TB, so the counter
 * stays inside a 32-bit integer for any tenant this platform will ever have.
 */
export const usageRepository = {
  /** Adds to a meter. `periodKey` defaults to the current month. */
  async increment(
    organizationId: string,
    key: UsageMeterKey,
    amount: number,
    period?: string,
  ): Promise<number> {
    if (amount === 0) {
      return (await this.get(organizationId, key, period)) ?? 0;
    }

    const bucket = period ?? periodFor().key;

    const row = await prisma.usageMeter.upsert({
      where: {
        organizationId_key_period: { organizationId, key, period: bucket },
      },
      create: { organizationId, key, period: bucket, quantity: Math.max(amount, 0) },
      update: { quantity: { increment: amount } },
    });

    return row.quantity;
  },

  async get(
    organizationId: string,
    key: UsageMeterKey,
    period?: string,
  ): Promise<number | null> {
    const row = await prisma.usageMeter.findUnique({
      where: {
        organizationId_key_period: {
          organizationId,
          key,
          period: period ?? periodFor().key,
        },
      },
      select: { quantity: true },
    });

    return row ? row.quantity : null;
  },

  /** Every meter for one period, as a key -> quantity map (missing keys are 0). */
  async snapshot(organizationId: string, period?: string): Promise<Record<UsageMeterKey, number>> {
    const rows = await prisma.usageMeter.findMany({
      where: { organizationId, period: period ?? periodFor().key },
      select: { key: true, quantity: true },
    });

    const totals: Record<UsageMeterKey, number> = {
      REQUESTS: 0,
      STORAGE_KB: 0,
      API_CALLS: 0,
    };

    for (const row of rows) {
      totals[row.key as UsageMeterKey] = row.quantity;
    }

    return totals;
  },

  /** Sets a meter to an absolute value — used by storage reconciliation. */
  async set(
    organizationId: string,
    key: UsageMeterKey,
    quantity: number,
    period?: string,
  ): Promise<number> {
    const row = await prisma.usageMeter.upsert({
      where: {
        organizationId_key_period: {
          organizationId,
          key,
          period: period ?? periodFor().key,
        },
      },
      create: {
        organizationId,
        key,
        period: period ?? periodFor().key,
        quantity: Math.max(quantity, 0),
      },
      update: { quantity: Math.max(quantity, 0) },
    });

    return row.quantity;
  },
};
