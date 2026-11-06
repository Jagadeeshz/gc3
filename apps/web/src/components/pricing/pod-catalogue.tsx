'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowUpRight,
  Bot,
  Check,
  CircuitBoard,
  Crown,
  Layers,
  Sparkles,
  Users,
  Wand2,
} from 'lucide-react';
import type { CapabilityPod } from '@gc3/types';
import { ApiClientError, fetchPods } from '@/lib/api-client';
import { PodComparison } from './pricing-sections';

/**
 * The capability-pod catalogue.
 *
 * One component, three surfaces: the public pricing page, the client subscription
 * screen and the services portal. It renders whatever the API returns — prices,
 * credits, team composition and stacking all come from `capability_pods`, so a
 * price change is a seed change and never a component edit.
 *
 * Stacking is read from `includesCodes`, not from copy: if Growth stops including
 * Creative, the card changes because the data did.
 */

const money = (minor: number, currency: string): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: minor % 100 === 0 ? 0 : 2,
  }).format(minor / 100);

const POD_ICON: Record<string, typeof Layers> = {
  CREATIVE: Sparkles,
  GROWTH: Layers,
  STRATEGY: Crown,
  AUTOMATION: CircuitBoard,
  INTERACTIVE: Wand2,
  REMAU: Bot,
};

function teamLine(pod: CapabilityPod): string | null {
  const parts: string[] = [];
  if (pod.managers > 0) parts.push(`${pod.managers} manager${pod.managers > 1 ? 's' : ''}`);
  if (pod.specialists > 0) parts.push(`${pod.specialists} specialist${pod.specialists > 1 ? 's' : ''}`);
  if (pod.agents > 0) parts.push(`${pod.agents} agent${pod.agents > 1 ? 's' : ''}`);

  return parts.length > 0 ? parts.join(' · ') : null;
}

function priceLabel(pod: CapabilityPod): { primary: string; suffix: string } {
  if (pod.isCustomPriced) {
    return {
      primary: money(pod.creditRateCents, pod.currency),
      suffix: 'per credit · custom team',
    };
  }

  return { primary: money(pod.monthlyPriceCents, pod.currency), suffix: 'per month' };
}

export function PodCard({
  pod,
  byCode,
  current,
  popular = false,
}: {
  readonly pod: CapabilityPod;
  readonly byCode: ReadonlyMap<string, CapabilityPod>;
  readonly current: boolean;
  readonly popular?: boolean;
}) {
  const Icon = POD_ICON[pod.code] ?? Layers;
  const price = priceLabel(pod);
  const team = teamLine(pod);
  const includes = pod.includesCodes
    .map((code) => byCode.get(code)?.name ?? code)
    .filter(Boolean);

  return (
    <article
      className={[
        'relative flex h-full flex-col justify-between gap-4 rounded-[14px] border p-5 transition-colors',
        current
          ? 'border-emerald-400/45 bg-[#0B1220] shadow-[0_0_0_1px_rgba(16,185,129,0.18),0_0_32px_-16px_rgba(16,185,129,0.6)]'
          : 'border-[#1E293B] bg-[#0B1220] hover:border-emerald-400/25',
      ].join(' ')}
    >
      {current ? (
        <span className="absolute -top-2.5 left-4 rounded-full border border-emerald-400/40 bg-emerald-400/15 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-emerald-200">
          Your pod
        </span>
      ) : popular ? (
        <span className="absolute -top-2.5 left-4 rounded-full border border-amber-400/40 bg-amber-400/15 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-amber-200">
          Most specified
        </span>
      ) : null}

      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-[9px] border border-[#1E293B] bg-white/[0.03] text-emerald-300">
              <Icon aria-hidden className="size-4" strokeWidth={1.75} />
            </span>
            <div>
              <h3 className="text-[13px] font-semibold leading-tight text-slate-100">{pod.name}</h3>
              <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-slate-500">{pod.code}</p>
            </div>
          </div>

          {pod.minTermMonths > 0 ? (
            <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-amber-300">
              {pod.minTermMonths}-month min
            </span>
          ) : null}
        </div>

        <p className="mt-3 text-[11px] leading-relaxed text-slate-400">{pod.tagline}</p>

        <p className="mt-4 flex items-baseline gap-1.5">
          <span className="font-display text-[24px] font-semibold tabular-nums leading-none tracking-[-0.01em] text-slate-100">
            {price.primary}
          </span>
          <span className="text-[10px] text-slate-500">{price.suffix}</span>
        </p>

        <dl className="mt-4 grid gap-1.5 border-t border-[#1E293B] pt-3 text-[11px]">
          {pod.creditsIncluded > 0 ? (
            <div className="flex items-baseline justify-between gap-2">
              <dt className="text-slate-500">Credits</dt>
              <dd className="font-mono tabular-nums text-emerald-300">{pod.creditsIncluded}/mo</dd>
            </div>
          ) : null}

          {pod.hoursIncluded > 0 ? (
            <div className="flex items-baseline justify-between gap-2">
              <dt className="text-slate-500">Hours</dt>
              <dd className="font-mono tabular-nums text-emerald-300">
                {pod.hoursIncluded}
                {pod.peakHoursIncluded > 0 ? (
                  <span className="text-amber-300"> · {pod.peakHoursIncluded} peak</span>
                ) : null}
              </dd>
            </div>
          ) : null}

          <div className="flex items-baseline justify-between gap-2">
            <dt className="text-slate-500">Team</dt>
            <dd className="text-right font-mono text-[10px] text-slate-300">
              {team ?? pod.teamSummary ?? 'Custom team'}
            </dd>
          </div>

          {includes.length > 0 ? (
            <div className="flex items-baseline justify-between gap-2">
              <dt className="text-slate-500">Includes</dt>
              <dd className="text-right text-[10px] text-emerald-200">{includes.join(' + ')}</dd>
            </div>
          ) : null}
        </dl>
      </div>

      <ul className="grid gap-1">
        {pod.perks.slice(0, 6).map((perk) => (
          <li key={perk} className="flex items-start gap-1.5 text-[11px] leading-snug text-slate-400">
            <Check aria-hidden className="mt-0.5 size-3 shrink-0 text-emerald-400/80" strokeWidth={2.2} />
            {perk}
          </li>
        ))}
      </ul>
    </article>
  );
}

export function PodGrid({
  pods,
  currentCodes = [],
  popularCode = 'GROWTH',
}: {
  readonly pods: readonly CapabilityPod[];
  readonly currentCodes?: readonly string[];
  readonly popularCode?: string;
}) {
  const byCode = new Map(pods.map((pod) => [pod.code, pod]));

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {pods.map((pod) => (
        <PodCard
          key={pod.code}
          pod={pod}
          byCode={byCode}
          current={currentCodes.includes(pod.code)}
          popular={!currentCodes.length && pod.code === popularCode}
        />
      ))}
    </div>
  );
}

/**
 * Fetches the catalogue and renders it.
 *
 * `Token` optional: the pricing page is public, the portal passes a session token
 * so a failure there can be reported as an auth problem rather than a network one.
 */
export function PodCatalogue({
  token,
  currentCodes,
  compact = false,
}: {
  readonly token?: string | null;
  readonly currentCodes?: readonly string[];
  readonly compact?: boolean;
}) {
  const [pods, setPods] = useState<readonly CapabilityPod[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  /**
   * Which metric the price column reports.
   *
   * 'credit' is derived, never invented: monthly price ÷ credits included. It is
   * the toggle that proves the catalogue is coherent — every monthly pod lands on
   * the same $25/credit the custom pods are sold at.
   */
  const [metricMode, setMetricMode] = useState<'monthly' | 'credit'>('monthly');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      setPods(await fetchPods(token ?? null));
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'Could not load the catalogue.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <p className="text-[11px] text-slate-500">Loading the catalogue…</p>;
  }

  if (error) {
    return (
      <p className="rounded-[10px] border border-red-400/30 bg-red-400/[0.07] px-3 py-2 text-[11px] text-red-300">
        {error}
      </p>
    );
  }

  return (
    <div className="grid gap-5">
      {compact ? null : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div
              role="tablist"
              aria-label="Price metric"
              className="inline-flex rounded-lg border border-[#1E293B] bg-[#0B1220] p-0.5"
            >
              {(
                [
                  { key: 'monthly', label: 'Per month' },
                  { key: 'credit', label: 'Per credit' },
                ] as const
              ).map((option) => {
                const active = metricMode === option.key;

                return (
                  <button
                    key={option.key}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setMetricMode(option.key)}
                    className={`rounded-[6px] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] transition-colors ${
                      active
                        ? 'bg-emerald-400/15 text-emerald-200'
                        : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>

            <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-slate-500">
              {metricMode === 'credit'
                ? 'monthly ÷ credits — every pod resolves to the same rate'
                : 'published list price'}
            </p>
          </div>

          <PodComparison pods={pods} metricMode={metricMode} />
        </>
      )}

      <PodGrid pods={compact ? pods.slice(0, 3) : pods} currentCodes={currentCodes} />

      <div className="flex flex-wrap items-start gap-2 rounded-[10px] border border-[#1E293B] bg-[#0B1220]/60 px-3.5 py-3">
        <Users aria-hidden className="mt-0.5 size-3.5 shrink-0 text-emerald-300" strokeWidth={1.75} />
        <p className="text-[11px] leading-relaxed text-slate-400">
          <span className="text-slate-200">Stacking.</span> Pods stack upward: Growth carries the
          entire Creative catalogue on the same credit pool, and Strategy carries both Growth and
          Creative. You do not buy the lower pods separately.
        </p>
      </div>
    </div>
  );
}

/** A one-line price strip, for surfaces that cannot take the full grid. */
export function PodPriceStrip({ token }: { readonly token?: string | null }) {
  const [pods, setPods] = useState<readonly CapabilityPod[]>([]);

  useEffect(() => {
    let alive = true;
    fetchPods(token ?? null)
      .then((rows) => {
        if (alive) setPods(rows);
      })
      .catch(() => {
        /* a strip is decoration: if the catalogue is unavailable, render nothing */
      });

    return () => {
      alive = false;
    };
  }, [token]);

  if (pods.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {pods.map((pod) => (
        <span
          key={pod.code}
          className="inline-flex items-baseline gap-1.5 rounded-full border border-[#1E293B] bg-[#0B1220] px-2.5 py-1 font-mono text-[10px] text-slate-300"
        >
          {pod.name}
          <span className="tabular-nums text-emerald-300">
            {pod.isCustomPriced
              ? `${money(pod.creditRateCents, pod.currency)}/credit`
              : `${money(pod.monthlyPriceCents, pod.currency)}/mo`}
          </span>
        </span>
      ))}
      <Link
        href="/pricing"
        className="inline-flex items-center gap-1 text-[11px] text-emerald-300 underline-offset-4 hover:underline"
      >
        Full catalogue
        <ArrowUpRight aria-hidden className="size-3" strokeWidth={1.75} />
      </Link>
    </div>
  );
}
