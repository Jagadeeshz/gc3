'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Bot, Crown, UserRound } from 'lucide-react';
import type { CapabilityPod } from '@gc3/types';
import { fetchPods } from '@/lib/api-client';

/**
 * Act III — the pods, arranged as a revolving hub.
 *
 * A radial topology: a lit core in the middle, six platforms on a ring, connector arms with
 * arrowheads between them. It says what the prose already says — one subscription at the
 * centre, capability pods hanging off it — and adds no copy that is not on the site.
 *
 * Motion: the ring turns once every two and a half minutes. Slow enough to read as alive rather
 * than as an animation. The ring carries the arms and the platforms together so an arm never
 * drifts off its pod, and each platform counter-rotates at the same duration so its label stays
 * upright. Hover or keyboard focus pauses the whole thing, because a moving target is not
 * something you can point at, and `prefers-reduced-motion` stops it at rest.
 *
 * Hovering a platform raises a card with that pod's price, pool, tagline, team and first two
 * coverage lines. The card is pointer-events-none — it can never steal the hover that keeps it
 * open — and sits outside the tile so it never covers what you are pointing at. Clicking a
 * platform still opens the full detail panel below the diagram, which is what touch and
 * keyboard use.
 *
 * Every number comes from GET /api/v1/pricing/pods. This file holds none of them.
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

/** Six positions on the ring, from twelve o'clock and stepping by 60°. */
const ANGLES = [-90, -30, 30, 90, 150, 210] as const;

const RING_RADIUS = 36; // percent of the square where a platform's centre sits
const ARM_RADIUS = 26; // where the connector arm stops, short of the platform
const REVOLUTION_S = 150; // one full turn

const position = (index: number): { left: string; top: string } => {
  const angle = ANGLES[index % ANGLES.length] ?? -90;
  const radians = (angle * Math.PI) / 180;
  return {
    left: `${50 + RING_RADIUS * Math.cos(radians)}%`,
    top: `${50 + RING_RADIUS * Math.sin(radians)}%`,
  };
};

const armEnd = (index: number): { x: number; y: number } => {
  const angle = ANGLES[index % ANGLES.length] ?? -90;
  const radians = (angle * Math.PI) / 180;
  return { x: 50 + ARM_RADIUS * Math.cos(radians), y: 50 + ARM_RADIUS * Math.sin(radians) };
};

export function ActPods() {
  const [pods, setPods] = useState<readonly CapabilityPod[]>([]);
  const [failed, setFailed] = useState(false);
  const [openCode, setOpenCode] = useState<string | null>(null);
  // The hover card lives outside the rotating ring — a transform creates a stacking context,
  // so anything inside it can never paint above the core. Instead the card is positioned from
  // the tile's real screen box at the moment of hover.
  const hubRef = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ code: string; x: number; y: number } | null>(null);
  const hovered = hover?.code ?? null;

  const showPod = (code: string, tile: HTMLElement): void => {
    const hub = hubRef.current?.getBoundingClientRect();
    const box = tile.getBoundingClientRect();
    if (!hub) return;
    setHover({ code, x: box.left - hub.left + box.width / 2, y: box.bottom - hub.top });
  };

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
  const hoveredPod = hover === null ? null : (pods.find((pod) => pod.code === hover.code) ?? null);
  const selected = pods.find((pod) => pod.code === openCode) ?? null;

  return (
    <section id="act-pods" className="act-anchor relative border-b border-hairline bg-obsidian py-20 sm:py-28">
      <div className="shell grid gap-14 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)] lg:gap-16">
        <div className="stage rise">
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
              className="inline-flex items-center gap-1.5 rounded-lg border border-hairline px-3.5 py-2 text-[12px] text-ghost-muted transition-colors hover:border-[color:var(--bindu-rim-spectrum-mid)] hover:text-ghost"
            >
              Full pricing
              <ArrowRight aria-hidden className="size-3.5" strokeWidth={1.9} />
            </Link>
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ghost-muted">
              Live from the catalogue
            </span>
          </div>
        </div>

        {/* ---------------------------------------------------------------- the hub */}
        <div className="min-w-0">
          {pods.length === 0 ? (
            <div className="grid gap-3">
              {[0, 1, 2].map((index) => (
                <div
                  key={index}
                  className="h-[164px] animate-pulse rounded-[14px] border border-hairline bg-obsidian-soft"
                />
              ))}
              {failed ? (
                <p className="text-[12px] leading-relaxed text-ghost-muted">
                  The catalogue could not be reached just now.{' '}
                  <Link href="/pricing" className="text-ghost underline-offset-4 hover:underline">
                    Open the pricing page
                  </Link>{' '}
                  for live pod prices.
                </p>
              ) : null}
            </div>
          ) : (
            <>
              {/* Radial topology, md and up. Phones get the rail below: six diamonds on a 320px
                  square is a diagram nobody can read. */}
              <div
                ref={hubRef}
                className="pod-hub relative mx-auto hidden aspect-square w-full max-w-[620px] md:block"
                onMouseLeave={() => setHover(null)}
              >
                <div aria-hidden="true" className="pod-core-glow absolute inset-[22%] rounded-full" />

                <div aria-hidden="true" className="absolute inset-[23%] rounded-full border border-white/10" />
                <div
                  aria-hidden="true"
                  className="absolute inset-[15%] rounded-full border border-dashed border-[color:var(--bindu-rim-spectrum-mid)] opacity-60"
                />
                <div
                  aria-hidden="true"
                  className="aurora-ring absolute inset-[19%] rounded-full opacity-70"
                  style={{ animationDuration: '48s' }}
                />

                {/* Everything that has to stay attached to a pod revolves together. */}
                <div className="pod-ring absolute inset-0" style={{ animationDuration: `${REVOLUTION_S}s` }}>
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 100 100"
                    className="absolute inset-0 size-full overflow-visible"
                  >
                    <defs>
                      <linearGradient id="arm-gradient" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="var(--bindu-rim-spectrum-mid)" stopOpacity="0.2" />
                        <stop offset="100%" stopColor="var(--bindu-rim-spectrum-mid)" stopOpacity="0.95" />
                      </linearGradient>
                      <marker
                        id="arm-arrow"
                        viewBox="0 0 6 6"
                        refX="6"
                        refY="3"
                        markerWidth="2.2"
                        markerHeight="2.2"
                        orient="auto-start-reverse"
                      >
                        <path d="M0,0 L6,3 L0,6 z" fill="var(--bindu-rim-spectrum-mid)" opacity="0.85" />
                      </marker>
                    </defs>
                    {pods.map((pod, index) => {
                      const end = armEnd(index);
                      const active = openCode === pod.code || hovered === pod.code;

                      return (
                        <line
                          key={pod.code}
                          x1="50"
                          y1="50"
                          x2={end.x}
                          y2={end.y}
                          stroke="url(#arm-gradient)"
                          strokeWidth={active ? 0.8 : 0.5}
                          strokeDasharray={active ? undefined : '2.4 2.2'}
                          markerEnd="url(#arm-arrow)"
                          className="transition-all duration-300"
                        />
                      );
                    })}
                  </svg>

                  {pods.map((pod, index) => {
                    const price = priceLine(pod);
                    const active = openCode === pod.code;

                    return (
                      <div
                        key={pod.code}
                        style={position(index)}
                        className="absolute -translate-x-1/2 -translate-y-1/2"
                      >
                        <div
                          className="pod-counter relative"
                          style={{ animationDuration: `${REVOLUTION_S}s` }}
                        >
                          <button
                            type="button"
                            onClick={() => setOpenCode(active ? null : pod.code)}
                            onMouseEnter={(event) => showPod(pod.code, event.currentTarget)}
                            onFocus={(event) => showPod(pod.code, event.currentTarget)}
                            onBlur={() => setHover(null)}
                            aria-expanded={active}
                            aria-controls="pod-hub-panel"
                            className="pod-platform group relative block"
                          >
                            <span
                              aria-hidden="true"
                              className={`pod-platform-tile absolute inset-0 ${active ? 'is-active' : ''}`}
                            />
                            <span className="relative grid place-items-center gap-1 px-4 py-5 text-center">
                              <span className="font-mono text-[8px] uppercase tracking-[0.16em] text-ghost-muted">
                                {String(pod.sortOrder / 10).padStart(2, '0')}
                              </span>
                              <span className="text-[12px] font-medium leading-tight text-ghost">
                                {pod.name}
                              </span>
                              <span className="font-mono text-[11px] tabular-nums leading-none text-ghost">
                                {price.value}
                              </span>
                              <span className="font-mono text-[7.5px] uppercase tracking-[0.14em] text-ghost-muted">
                                {price.note}
                              </span>
                            </span>
                          </button>

                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* The core sits on top of the ring, so the arms disappear into it. */}
                <div className="pod-core absolute inset-[27%] grid place-items-center rounded-full text-center">
                  <div>
                    <p className="font-display text-[clamp(1.6rem,3vw,2.4rem)] font-semibold leading-none tabular-nums text-ghost">
                      {pods.length}
                    </p>
                    <p className="mt-1.5 font-mono text-[8px] uppercase tracking-[0.18em] text-ghost-muted">
                      Capability pods
                    </p>
                    <p className="mt-2.5 font-mono text-[8px] uppercase tracking-[0.18em] text-ghost-muted/70">
                      One subscription
                    </p>
                  </div>
                </div>

                {/* Hover card. Lives in the hub's coordinate space, not the ring's, so it paints
                    above the core; anchored to the tile's real box at the moment of hover. */}
                {hover !== null && hoveredPod !== null ? (
                  <div
                    role="tooltip"
                    style={{ left: hover.x, top: hover.y }}
                    className="pointer-events-none absolute z-50 mt-2 w-[252px] -translate-x-1/2 rounded-[12px] border border-hairline bg-obsidian-raised p-3 shadow-[var(--bindu-shadow-modal)]"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-[12px] font-medium text-ghost">{hoveredPod.name}</p>
                      <p className="font-mono text-[11px] tabular-nums text-ghost">
                        {priceLine(hoveredPod).value}
                      </p>
                    </div>
                    <p className="mt-1 font-mono text-[8px] uppercase tracking-[0.12em] text-ghost-muted">
                      {poolLine(hoveredPod)}
                      {hoveredPod.minTermMonths > 0 ? ` · ${hoveredPod.minTermMonths}-mo min` : ''}
                    </p>
                    <p className="mt-2 text-[10.5px] leading-snug text-ghost-muted">
                      {hoveredPod.tagline}
                    </p>
                    <p className="mt-2 font-mono text-[8px] uppercase tracking-[0.1em] text-ghost-muted">
                      {hoveredPod.managers + hoveredPod.specialists + hoveredPod.agents > 0
                        ? `${hoveredPod.managers} mgr · ${hoveredPod.specialists} spec · ${hoveredPod.agents} agents`
                        : (hoveredPod.teamSummary ?? 'Custom team')}
                    </p>
                    {hoveredPod.perks.length > 0 ? (
                      <ul className="mt-2 grid gap-1 border-t border-hairline pt-2">
                        {hoveredPod.perks.slice(0, 2).map((perk) => (
                          <li
                            key={perk}
                            className="flex items-start gap-1.5 text-[10px] leading-snug text-ghost-muted"
                          >
                            <span
                              aria-hidden="true"
                              className="mt-[5px] size-1 shrink-0 rounded-full bg-[color:var(--bindu-rim-spectrum-mid)]"
                            />
                            {perk}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ) : null}
              </div>

              {/* phones: same pods, same data, a plain rail */}
              <div className="grid gap-2 md:hidden">
                {pods.map((pod) => {
                  const price = priceLine(pod);
                  const active = openCode === pod.code;

                  return (
                    <button
                      key={pod.code}
                      type="button"
                      onClick={() => setOpenCode(active ? null : pod.code)}
                      aria-expanded={active}
                      aria-controls="pod-hub-panel"
                      className={`flex items-center justify-between gap-3 rounded-[12px] border px-4 py-3 text-left transition-colors ${
                        active
                          ? 'border-[color:var(--bindu-rim-spectrum-mid)] bg-obsidian-raised'
                          : 'border-hairline bg-obsidian-soft'
                      }`}
                    >
                      <span>
                        <span className="block text-[13px] font-medium text-ghost">{pod.name}</span>
                        <span className="mt-0.5 block font-mono text-[9px] uppercase tracking-[0.12em] text-ghost-muted">
                          {poolLine(pod)}
                        </span>
                      </span>
                      <span className="text-right">
                        <span className="block font-mono text-[13px] tabular-nums text-ghost">
                          {price.value}
                        </span>
                        <span className="block font-mono text-[8px] uppercase tracking-[0.12em] text-ghost-muted">
                          {price.note}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Detail panel — what click and keyboard open, since hover does not exist there. */}
              <div id="pod-hub-panel" className="mt-6 rounded-[14px] border border-hairline bg-obsidian-soft">
                {selected === null ? (
                  <p className="px-5 py-4 font-mono text-[9px] uppercase tracking-[0.16em] text-ghost-muted">
                    Select a pod for its coverage and team
                  </p>
                ) : (
                  <div className="px-5 py-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="text-[14px] font-medium tracking-[-0.01em] text-ghost">
                        {selected.name}
                      </h3>
                      <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-ghost-muted">
                        {poolLine(selected)}
                        {selected.minTermMonths > 0 ? ` · ${selected.minTermMonths}-mo minimum` : ''}
                      </p>
                    </div>
                    <p className="mt-1.5 text-[11.5px] leading-relaxed text-ghost-muted">
                      {selected.tagline}
                    </p>

                    <div className="mt-4 grid gap-5 sm:grid-cols-2">
                      <div>
                        <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-ghost-muted">
                          What it covers
                        </p>
                        <ul className="mt-2 grid gap-1.5">
                          {selected.perks.map((perk) => (
                            <li
                              key={perk}
                              className="flex items-start gap-2 text-[11.5px] leading-snug text-ghost-muted"
                            >
                              <span
                                aria-hidden="true"
                                className="mt-[6px] size-1 shrink-0 rounded-full bg-[color:var(--bindu-rim-spectrum-mid)]"
                              />
                              {perk}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-ghost-muted">
                          Team
                        </p>
                        <ul className="mt-2 grid gap-px overflow-hidden rounded-[8px] border border-hairline bg-hairline">
                          {[
                            { icon: Crown, label: 'Manager', count: selected.managers },
                            { icon: UserRound, label: 'Specialists', count: selected.specialists },
                            { icon: Bot, label: 'Paired agents', count: selected.agents },
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
                                  <span className="font-mono text-[11px] tabular-nums text-ghost">
                                    ×{row.count}
                                  </span>
                                </li>
                              );
                            })}
                          {selected.managers + selected.specialists + selected.agents === 0 ? (
                            <li className="bg-obsidian-raised px-2.5 py-1.5 font-mono text-[10px] text-ghost-muted">
                              {selected.teamSummary ?? 'Custom team'}
                            </li>
                          ) : null}
                        </ul>

                        {selected.includesCodes.length > 0 ? (
                          <p className="mt-3 text-[11px] leading-relaxed text-ghost-muted">
                            Carries{' '}
                            {selected.includesCodes.map((code) => names.get(code) ?? code).join(' + ')}{' '}
                            — on the same credit pool.
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
