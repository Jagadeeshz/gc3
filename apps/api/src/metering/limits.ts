import type { UsageMeterKey } from '@gc3/types';
import { ApiError } from '../lib/api-error';
import { prisma } from '../db/client';
import { financeRepository } from '../repositories/finance.repository';
import { usageRepository } from '../repositories/usage.repository';

/**
 * Plan enforcement.
 *
 * Every meter has a hard allowance. Once it is used up, the platform stops doing
 * the metered work rather than letting the bill grow unbounded — the client gets a
 * 403 that names the meter and the plan, and the billing pages stay reachable so
 * they can see why.
 *
 * The check and the increment are two separate calls on purpose: guard first,
 * consume only after the work actually succeeded, so a failed validation or a
 * crashed write does not burn quota.
 */
export const METER_UNITS: Record<UsageMeterKey, { unit: string; label: string }> = {
  REQUESTS: { unit: 'service requests', label: 'Service requests' },
  STORAGE_KB: { unit: 'MB of storage', label: 'Deliverable storage' },
  API_CALLS: { unit: 'API calls', label: 'API calls' },
};

export interface Allowance {
  readonly key: UsageMeterKey;
  /** Used, in the meter's own unit (KB for storage). */
  readonly used: number;
  /** Included by the plan, in the meter's own unit. */
  readonly limit: number;
  readonly remaining: number;
  readonly tierCode: string;
}

/** Storage is metered in KB but sold in MB; the guard works in KB throughout. */
const KB_PER_MB = 1_024;

function limitForKey(key: UsageMeterKey, tier: { requestsIncluded: number; storageMbIncluded: number; apiCallsIncluded: number }): number {
  switch (key) {
    case 'REQUESTS':
      return tier.requestsIncluded;
    case 'STORAGE_KB':
      return tier.storageMbIncluded * KB_PER_MB;
    default:
      return tier.apiCallsIncluded;
  }
}

/** Used/limit for one meter. Provisions the plan if the tenant has none yet. */
export async function allowanceFor(organizationId: string, key: UsageMeterKey): Promise<Allowance> {
  const { tier } = await financeRepository.ensureSubscription(organizationId);
  const used = (await usageRepository.get(organizationId, key)) ?? 0;
  const limit = limitForKey(key, tier);

  return { key, used, limit, remaining: Math.max(limit - used, 0), tierCode: tier.code };
}

/**
 * Same, but never provisions a plan.
 *
 * Used by the per-request API-call meter: a tenant that has never opened a billing
 * page should not have a subscription row created just because it made a GET.
 */
export async function allowanceIfPlanned(
  organizationId: string,
  key: UsageMeterKey,
): Promise<Allowance | null> {
  const subscription = await prisma.organizationSubscription.findUnique({
    where: { organizationId },
    include: { tier: true },
  });

  if (!subscription) {
    return null;
  }

  const used = (await usageRepository.get(organizationId, key)) ?? 0;
  const limit = limitForKey(key, subscription.tier);

  return {
    key,
    used,
    limit,
    remaining: Math.max(limit - used, 0),
    tierCode: subscription.tier.code,
  };
}

/** Throws a typed 403 when `required` more of this meter would exceed the plan. */
export async function assertWithinLimit(
  organizationId: string,
  key: UsageMeterKey,
  required = 1,
): Promise<Allowance> {
  const allowance = await allowanceFor(organizationId, key);

  if (allowance.used + required > allowance.limit) {
    const { unit } = METER_UNITS[key];
    // Storage reads in KB internally but a human thinks in MB.
    const scale = key === 'STORAGE_KB' ? KB_PER_MB : 1;

    throw ApiError.limitExceeded({
      meter: key,
      used: Math.floor(allowance.used / scale),
      limit: Math.floor(allowance.limit / scale),
      unit,
      tierCode: allowance.tierCode,
    });
  }

  return allowance;
}

/** Records consumption. Call only after the metered work succeeded. */
export async function consume(
  organizationId: string,
  key: UsageMeterKey,
  amount = 1,
): Promise<number> {
  return usageRepository.increment(organizationId, key, amount);
}

/** Bytes -> KB, rounded up: a partial kilobyte is a kilobyte of storage. */
export function bytesToKb(bytes: number): number {
  return Math.ceil(bytes / 1_024);
}

/**
 * Paths that stay reachable even when a metered allowance is exhausted.
 *
 * A tenant over its API-call allowance must still be able to see its plan, read
 * its invoices and sign in — otherwise the block hides the very information needed
 * to resolve it.
 */
export const LIMIT_EXEMPT_PREFIXES: readonly string[] = [
  '/subscription',
  '/invoices',
  '/organizations',
  '/notifications',
  '/auth',
  '/health',
  '/meta',
];

export function isLimitExempt(path: string): boolean {
  return LIMIT_EXEMPT_PREFIXES.some((prefix) => path.startsWith(prefix));
}
