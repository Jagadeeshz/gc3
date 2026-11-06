'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Bot, Clock, Users } from 'lucide-react';
import type { CapabilityPod } from '@gc3/types';
import { fetchPods } from '@/lib/api-client';

/**
 * Act III — the pods, in motion.
 *
 * Every price, credit pool and team size on this screen comes from
 * `GET /api/v1/pricing/pods`. The component holds no numbers: if the catalogue
 * changes, this act changes with it.
 *
 * The motion is CSS (`animation-timeline: view()`), so sixty cards cost no scroll
 * listeners and nothing waits on hydration to become visible.
 */

const money = (minor: number, currency: string): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(minor / 100);

function priceLine(pod: CapabilityPod): { value: string; note: string } {
  if (pod.isCustomPriced) {
    return { value: money(pod.creditRateCents, pod.currency), note: 'per credit' };
  }

  return { value: money(pod.monthlyPriceCents, pod.currency), note: 'per month' };
}

function poolLine(pod: CapabilityPod): string {
  if (pod.creditsIncluded > 0) {
    return `${pod.creditsIncluded} credits / mo`;
  }
  if (pod.hoursIncluded > 0) {
    return `${pod.hoursIncluded}h / mo${pod.peakHoursIncluded > 0 ? ` · ${pod.peakHoursIncluded}h peak` : ''}`;
  }
  return 'Custom scoping';
}

function teamLine(pod: CapabilityPod): string {
  const parts: string[] = [];
  if (pod.managers > 0) parts.push(`${pod.managers} Mgr`);
  if (pod.specialists > 0) parts.push(`${pod.specialists} Spec`);
  if (pod.agents > 0) parts.push(`${pod.agents} Agents`);

  return parts.length > 0 ? parts.join(' · ') : (pod.teamSummary ?? 'Custom team');
}

export function ActPods() {
  const [pods, setPods] = useState<readonly CapabilityPod[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;

    fetchPods()
      .then((rows) => {
        if (alive) setPods(rows);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });

    return () => {
      alive = false;
    };
  }, []);

  return (
    <section id="act-pods" className="relative border-b border-hairline bg-obsidian py-20 sm:py-28">
      <div className="shell grid gap-12 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] lg:gap-16">
        <div className="stage rise">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-emerald-300/90">
            Act III — Capability pods
          </p>
          <h2 className="mt-4 font-display text-[clamp(1.9rem,3.4vw,2.9rem)] leading-[1.06] tracking-[-0.02em] text-ghost">
            Six pods. Published prices.
          </h2>
          <p className="mt-5 max-w-[46ch] text-[14px] leading-[1.8] text-ghost-muted">
            Each pod is a standing team on a monthly credit pool. Pods stack upward — the higher pod
            carries the catalogues below it on the same pool, so you never buy the stack.
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link
              href="/pricing"
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/35 bg-emerald-400/10 px-3.5 py-2 text-[12px] font-medium text-emerald-200 transition-colors hover:bg-emerald-400/20"
            >
              Full pricing
              <ArrowRight aria-hidden className="size-3.5" strokeWidth={1.9} />
            </Link>
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ghost-muted">
              Live from the catalogue
            </span>
          </div>
        </div>

        <div className="grid gap-4">
          {pods.length === 0 ? (
            <div className="grid gap-4">
              {[0, 1, 2].map((index) => (
                <div
                  key={index}
                  className="h-[142px] animate-pulse rounded-[14px] border border-hairline bg-obsidian-soft"
                />
              ))}
              {failed ? (
                <p className="text-[12px] leading-relaxed text-ghost-muted">
                  The catalogue could not be reached just now.{' '}
                  <Link href="/pricing" className="text-emerald-300 underline-offset-4 hover:underline">
                    Open the pricing page
                  </Link>{' '}
                  for live pod prices.
                </p>
              ) : null}
            </div>
          ) : (
            pods.map((pod) => {
              const price = priceLine(pod);

              return (
                <article
                  key={pod.code}
                  className="expand-card group relative overflow-hidden rounded-[14px] border border-hairline bg-obsidian-soft p-5 transition-colors hover:border-emerald-400/30 sm:p-6"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-ghost-muted">
                          {String(pod.sortOrder).padStart(2, '0')}
                        </span>
                        <h3 className="text-[17px] font-medium tracking-[-0.01em] text-ghost">
                          {pod.name}
                        </h3>
                        {pod.minTermMonths > 0 ? (
                          <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-amber-300">
                            {pod.minTermMonths}-mo min
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1.5 max-w-[46ch] text-[12px] leading-relaxed text-ghost-muted">
                        {pod.tagline}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="font-mono text-[22px] font-medium tabular-nums leading-none text-ghost">
                        {price.value}
                      </p>
                      <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.12em] text-ghost-muted">
                        {price.note}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-hairline pt-4">
                    <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-emerald-300">
                      <Clock aria-hidden className="size-3.5" strokeWidth={1.75} />
                      {poolLine(pod)}
                    </span>
                    <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-ghost-muted">
                      <Users aria-hidden className="size-3.5" strokeWidth={1.75} />
                      {teamLine(pod)}
                    </span>
                    {pod.includesCodes.length > 0 ? (
                      <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-emerald-200/90">
                        <Bot aria-hidden className="size-3.5" strokeWidth={1.75} />
                        Carries {pod.includesCodes.join(' + ')}
                      </span>
                    ) : null}
                  </div>
                </article>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}
