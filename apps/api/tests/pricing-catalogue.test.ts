import { describe, expect, it } from 'vitest';
import request from 'supertest';
import type { CapabilityPod } from '@gc3/types';
import { prisma } from '../src/db/client';
import { API, app } from './helpers/api';

/**
 * The commercial catalogue.
 *
 * These assertions are the published price list. If somebody edits a price, a
 * credit pool or a team size in the seed, this file fails — which is the point:
 * a price is a commercial commitment, and it should never change as a side effect
 * of a refactor.
 */

type Pod = CapabilityPod;

async function catalogue(): Promise<readonly Pod[]> {
  const response = await request(app).get(`${API}/pricing/pods`).expect(200);
  return response.body.data as readonly Pod[];
}

function byCode(pods: readonly Pod[], code: string): Pod {
  const found = pods.find((pod) => pod.code === code);
  if (!found) throw new Error(`pod ${code} is missing from the catalogue`);
  return found;
}

describe('GET /pricing/pods — the catalogue is public', () => {
  it('serves the price list with no token at all', async () => {
    const response = await request(app).get(`${API}/pricing/pods`).expect(200);

    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data)).toBe(true);
    expect((response.body.data as unknown[]).length).toBe(6);
  });

  it('orders the pods the way they stack', async () => {
    const pods = await catalogue();
    const codes = pods.map((pod) => pod.code);

    expect(codes).toEqual(['CREATIVE', 'GROWTH', 'STRATEGY', 'AUTOMATION', 'INTERACTIVE', 'REMAU']);
  });

  it('exposes nothing tenant-scoped', async () => {
    const pods = await catalogue();
    const keys = Object.keys(pods[0] ?? {});

    // A public price list must not leak counts, names or usage.
    expect(keys).not.toContain('organizationId');
    expect(keys).not.toContain('subscriptions');
    expect(keys).not.toContain('usage');
  });
});

describe('pod prices, credits and teams match the brief', () => {
  it('Creative: $3,000 · 120 credits · 1 manager, 2 specialists, 2 agents', async () => {
    const creative = byCode(await catalogue(), 'CREATIVE');

    expect(creative.monthlyPriceCents).toBe(300_000);
    expect(creative.currency).toBe('USD');
    expect(creative.creditsIncluded).toBe(120);
    expect([creative.managers, creative.specialists, creative.agents]).toEqual([1, 2, 2]);
    expect(creative.isCustomPriced).toBe(false);
    expect(creative.includesCodes).toEqual([]);
    expect(creative.perks).toEqual(
      expect.arrayContaining(['Social content', 'Design', 'Copy', 'Video & motion', 'Decks', 'Brand assets']),
    );
  });

  it('Growth: $6,000 · 240 credits · 1 manager, 4 specialists, 4 agents', async () => {
    const growth = byCode(await catalogue(), 'GROWTH');

    expect(growth.monthlyPriceCents).toBe(600_000);
    expect(growth.creditsIncluded).toBe(240);
    expect([growth.managers, growth.specialists, growth.agents]).toEqual([1, 4, 4]);
    expect(growth.includesCodes).toEqual(['CREATIVE']);
  });

  it('Strategy: $9,000 · 360 credits · 1 manager, 6 specialists, 6 agents', async () => {
    const strategy = byCode(await catalogue(), 'STRATEGY');

    expect(strategy.monthlyPriceCents).toBe(900_000);
    expect(strategy.creditsIncluded).toBe(360);
    expect([strategy.managers, strategy.specialists, strategy.agents]).toEqual([1, 6, 6]);
    expect(strategy.includesCodes).toEqual(['GROWTH', 'CREATIVE']);
  });

  it('Automation and Interactive: custom team at $25 per credit', async () => {
    const pods = await catalogue();

    for (const code of ['AUTOMATION', 'INTERACTIVE'] as const) {
      const pod = byCode(pods, code);

      expect(pod.isCustomPriced).toBe(true);
      expect(pod.creditRateCents).toBe(2_500);
      expect(pod.monthlyPriceCents).toBe(0);
      expect(pod.managers + pod.specialists + pod.agents).toBe(0);
      expect(pod.teamSummary).toMatch(/custom team/i);
    }
  });

  it('REMAU: $8,000 · 240 hours, 280 at peak · 3-month minimum', async () => {
    const remau = byCode(await catalogue(), 'REMAU');

    expect(remau.monthlyPriceCents).toBe(800_000);
    expect(remau.hoursIncluded).toBe(240);
    expect(remau.peakHoursIncluded).toBe(280);
    expect(remau.minTermMonths).toBe(3);
    expect(remau.perks).toEqual(
      expect.arrayContaining(['Property launch campaigns', 'NRI-diaspora marketing', 'XR walkthroughs', 'Investor comms']),
    );
  });
});

describe('stacking is data, not copy', () => {
  it('every included code resolves to a real pod', async () => {
    const pods = await catalogue();
    const codes = new Set(pods.map((pod) => pod.code));

    for (const pod of pods) {
      for (const included of pod.includesCodes) {
        expect(codes.has(included)).toBe(true);
      }
    }
  });

  it('Growth carries Creative, and Strategy carries both — transitively', async () => {
    const pods = await catalogue();
    const byCodeMap = new Map(pods.map((pod) => [pod.code, pod]));

    const closure = (code: string, seen = new Set<string>()): Set<string> => {
      const pod = byCodeMap.get(code);
      if (!pod) return seen;

      for (const included of pod.includesCodes) {
        if (!seen.has(included)) {
          seen.add(included);
          closure(included, seen);
        }
      }

      return seen;
    };

    expect([...closure('GROWTH')].sort()).toEqual(['CREATIVE']);
    expect([...closure('STRATEGY')].sort()).toEqual(['CREATIVE', 'GROWTH']);
    expect([...closure('CREATIVE')]).toEqual([]);
  });

  it('a higher pod always includes more credits than the one below it', async () => {
    const pods = await catalogue();
    const creative = byCode(pods, 'CREATIVE');
    const growth = byCode(pods, 'GROWTH');
    const strategy = byCode(pods, 'STRATEGY');

    expect(growth.creditsIncluded).toBeGreaterThan(creative.creditsIncluded);
    expect(strategy.creditsIncluded).toBeGreaterThan(growth.creditsIncluded);
    expect(strategy.monthlyPriceCents).toBeGreaterThan(growth.monthlyPriceCents);
  });
});

describe('the catalogue respects its own state', () => {
  it('hides a pod that has been retired', async () => {
    await prisma.capabilityPod.update({ where: { code: 'REMAU' }, data: { isActive: false } });

    try {
      const pods = await catalogue();
      expect(pods.map((pod) => pod.code)).not.toContain('REMAU');
      expect(pods.length).toBe(5);
    } finally {
      await prisma.capabilityPod.update({ where: { code: 'REMAU' }, data: { isActive: true } });
    }
  });
});
