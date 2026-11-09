'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Bot, ChevronDown, Clock, Crown, Users, UserRound } from 'lucide-react';
import type { CapabilityPod } from '@gc3/types';
import { fetchPods } from '@/lib/api-client';
import { TiltCard } from './tilt-card';

/**
 * Act III — the pods, in motion.
 *
 * Every price, credit pool and team size comes from `GET /api/v1/pricing/pods`.
 * This file holds no numbers: change the seed and the act follows.
 *
 * The detail drawer animates with `grid-template-rows: 0fr → 1fr`, which is the
 * one way to transition to an unknown height without measuring anything in JS.
 * Cards are real buttons with `aria-expanded` / `aria-controls`, so the drawer is
 * usable by keyboard and announced by screen readers.
 */

const money = (minor: number, currency: string): string =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(minor / 100);

function priceLine(pod: CapabilityPod): { value: string; note: string } {
  return pod.isCustomPriced
    ? { value: money(pod.creditRateCents, pod.currency), note: 'per credit' }
    : { value: money(pod.monthlyPriceCents, pod.currency), note: 'per month' };
}

function poolLine(pod: CapabilityPod): string {
  if (pod.creditsIncluded > 0) return `${pod.creditsIncluded} credits / mo`;
  if (pod.hoursIncluded > 0) {
    return `${pod.hoursIncluded}h / mo${pod.peakHoursIncluded > 0 ? ` · ${pod.peakHoursIncluded}h peak` : ''}`;
  }
  return 'Custom scoping';
}

export function ActPods() {
  const [pods, setPods] = useState<readonly CapabilityPod[]>([]);
  const [failed, setFailed] = useState(false);
  const [openCode, setOpenCode] = useState<string | null>(null);

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

  const names = new Map(pods.map((pod) => [pod.code, pod.name]));

  return (
    <section
      id="act-pods"
      className="act-anchor relative border-b border-hairline bg-obsidian py-20 sm:py-28"
    >
      <div className="shell grid gap-12 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:gap-16">
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

        <div className="grid gap-3 sm:grid-cols-2">
          {pods.length === 0 ? (
            <>
              {[0, 1, 2, 3].map((index) => (
                <div
                  key={index}
                  className="h-[188px] animate-pulse rounded-[14px] border border-hairline bg-obsidian-soft"
                />
              ))}
              {failed ? (
                <p className="sm:col-span-2 text-[12px] leading-relaxed text-ghost-muted">
                  The catalogue could not be reached just now.{' '}
                  <Link href="/pricing" className="text-emerald-300 underline-offset-4 hover:underline">
                    Open the pricing page
                  </Link>{' '}
                  for live pod prices.
                </p>
              ) : null}
            </>
          ) : (
            pods.map((pod) => {
              const price = priceLine(pod);
              const open = openCode === pod.code;
              const panelId = `pod-drawer-${pod.code.toLowerCase()}`;
              const carries = pod.includesCodes
                .map((code) => names.get(code) ?? code)
                .filter(Boolean);

              return (
                <TiltCard
                  as="article"
                  key={pod.code}
                  className={[
                    'group relative flex flex-col overflow-hidden rounded-[14px] border bg-obsidian-soft',
                    open
                      ? 'pod-rim-active border-emerald-400/35'
                      : 'border-hairline hover:border-emerald-400/25 hover:shadow-[0_20px_50px_-30px_rgba(16,185,129,0.45)]',
                  ].join(' ')}
                >
                  {/* Top edge light: the card reads as lit, not flat. */}
                  <span
                    aria-hidden="true"
                    className={`absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/50 to-transparent transition-opacity duration-300 ${
                      open ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                    }`}
                  />

                  <button
                    type="button"
                    onClick={() => setOpenCode(open ? null : pod.code)}
                    aria-expanded={open}
                    aria-controls={panelId}
                    className="flex w-full flex-col gap-3 p-5 text-left"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-ghost-muted">
                            {String(pod.sortOrder / 10).padStart(2, '0')}
                          </span>
                          <h3 className="text-[15px] font-medium tracking-[-0.01em] text-ghost">
                            {pod.name}
                          </h3>
                        </div>
                        <p className="mt-1.5 text-[11.5px] leading-relaxed text-ghost-muted">
                          {pod.tagline}
                        </p>
                      </div>

                      <div className="shrink-0 text-right">
                        <p className="font-mono text-[20px] font-medium tabular-nums leading-none text-ghost">
                          {price.value}
                        </p>
                        <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.12em] text-ghost-muted">
                          {price.note}
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-emerald-300">
                        <Clock aria-hidden className="size-3" strokeWidth={1.9} />
                        {poolLine(pod)}
                      </span>
                      {pod.minTermMonths > 0 ? (
                        <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-amber-300">
                          {pod.minTermMonths}-mo minimum
                        </span>
                      ) : null}
                      {carries.length > 0 ? (
                        <span className="rounded-full border border-hairline px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-ghost-muted">
                          carries {carries.length === 1 ? 'creative' : 'both below'}
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-auto flex items-center justify-between pt-1">
                      <span className="inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.1em] text-ghost-muted">
                        <Users aria-hidden className="size-3" strokeWidth={1.9} />
                        {pod.managers + pod.specialists + pod.agents > 0
                          ? `${pod.managers} mgr · ${pod.specialists} spec · ${pod.agents} agents`
                          : (pod.teamSummary ?? 'Custom team')}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 font-mono text-[9px] uppercase tracking-[0.12em] transition-colors ${
                          open ? 'text-emerald-300' : 'text-ghost-muted group-hover:text-emerald-300'
                        }`}
                      >
                        {open ? 'Close' : 'Detail'}
                        <ChevronDown
                          aria-hidden
                          className={`size-3 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}
                          strokeWidth={2}
                        />
                      </span>
                    </div>
                  </button>

                  {/* Drawer: 0fr → 1fr transitions to an unknown height with no JS. */}
                  <div
                    id={panelId}
                    className={`grid transition-[grid-template-rows] duration-300 ease-out ${
                      open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                    }`}
                  >
                    <div className="overflow-hidden">
                      <div className="border-t border-hairline px-5 pb-5 pt-4">
                        <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-ghost-muted">
                          What it covers
                        </p>
                        <ul className="mt-2 grid gap-1.5">
                          {pod.perks.map((perk) => (
                            <li
                              key={perk}
                              className="flex items-start gap-2 text-[11.5px] leading-snug text-ghost-muted"
                            >
                              <span
                                aria-hidden="true"
                                className="mt-[6px] size-1 shrink-0 rounded-full bg-emerald-400/70"
                              />
                              {perk}
                            </li>
                          ))}
                        </ul>

                        <p className="mt-4 font-mono text-[9px] uppercase tracking-[0.16em] text-ghost-muted">
                          Team
                        </p>
                        <ul className="mt-2 grid gap-px overflow-hidden rounded-[8px] border border-hairline bg-hairline">
                          {[
                            { icon: Crown, label: 'Manager', count: pod.managers, tone: 'text-ghost' },
                            { icon: UserRound, label: 'Specialists', count: pod.specialists, tone: 'text-ghost-muted' },
                            { icon: Bot, label: 'Paired agents', count: pod.agents, tone: 'text-emerald-300' },
                          ]
                            .filter((row) => row.count > 0)
                            .map((row) => {
                              const Icon = row.icon;

                              return (
                                <li
                                  key={row.label}
                                  className="flex items-center justify-between bg-obsidian-raised px-2.5 py-1.5"
                                >
                                  <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-ghost-muted">
                                    <Icon aria-hidden className="size-3" strokeWidth={1.9} />
                                    {row.label}
                                  </span>
                                  <span className={`font-mono text-[11px] tabular-nums ${row.tone}`}>
                                    ×{row.count}
                                  </span>
                                </li>
                              );
                            })}
                          {pod.managers + pod.specialists + pod.agents === 0 ? (
                            <li className="bg-obsidian-raised px-2.5 py-1.5 font-mono text-[10px] text-ghost-muted">
                              {pod.teamSummary ?? 'Custom team'}
                            </li>
                          ) : null}
                        </ul>

                        {carries.length > 0 ? (
                          <p className="mt-3 text-[11px] leading-relaxed text-emerald-200/90">
                            Carries {carries.join(' + ')} — on the same credit pool.
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </TiltCard>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}
