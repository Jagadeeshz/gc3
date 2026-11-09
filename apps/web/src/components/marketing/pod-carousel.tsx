'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import type { CapabilityPod } from '@gc3/types';
import { fetchPods } from '@/lib/api-client';

/**
 * Pod carousel with a real slide transition.
 *
 * Track-based rather than a list of absolutely-positioned slides: transform on the
 * track moves every slide on the compositor, and the height comes from the tallest
 * slide so switching never shifts the page (no layout shift, no reserved guess).
 *
 * Autoplay pauses on hover, on focus and when the reader prefers reduced motion.
 * Arrows and dots are real buttons; the live region announces the active pod.
 */

const money = (minor: number, currency: string): string =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(
    minor / 100,
  );

export function PodCarousel() {
  const [pods, setPods] = useState<readonly CapabilityPod[]>([]);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduceMotion = useRef(false);

  useEffect(() => {
    reduceMotion.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let alive = true;
    fetchPods()
      .then((rows) => {
        if (alive) setPods(rows);
      })
      .catch(() => {
        /* decoration: the section still reads without the catalogue */
      });

    return () => {
      alive = false;
    };
  }, []);

  const count = pods.length;

  const go = useCallback(
    (next: number) => {
      if (count === 0) return;
      setIndex(((next % count) + count) % count);
    },
    [count],
  );

  useEffect(() => {
    if (paused || count < 2 || reduceMotion.current) return;

    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % count);
    }, 6000);

    return () => window.clearInterval(timer);
  }, [count, paused]);

  if (count === 0) {
    return <div className="h-[260px] animate-pulse rounded-[16px] border border-hairline bg-obsidian-soft" />;
  }

  return (
    <div
      className="relative w-full min-w-0"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div className="overflow-hidden rounded-[16px] border border-hairline bg-obsidian-soft">
        <div
          className="flex transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform"
          style={{ transform: `translate3d(-${index * 100}%, 0, 0)` }}
          aria-live="polite"
        >
          {pods.map((pod) => {
            const price = pod.isCustomPriced
              ? `${money(pod.creditRateCents, pod.currency)}/credit`
              : `${money(pod.monthlyPriceCents, pod.currency)}/mo`;

            return (
              <article key={pod.code} className="w-full shrink-0 p-6 sm:p-8" aria-hidden={undefined}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="font-mono text-[9px] uppercase tracking-[0.18em] text-emerald-300/80">
                      {pod.code}
                    </p>
                    <h3 className="mt-2 font-display text-[clamp(1.3rem,2.2vw,1.9rem)] leading-[1.1] tracking-[-0.02em] text-ghost">
                      {pod.name}
                    </h3>
                    <p className="mt-2 max-w-[46ch] text-[12.5px] leading-relaxed text-ghost-muted">
                      {pod.tagline}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="font-mono text-[24px] font-medium tabular-nums leading-none text-ghost">
                      {price}
                    </p>
                    <p className="mt-1.5 font-mono text-[9px] uppercase tracking-[0.12em] text-slate-500">
                      {pod.creditsIncluded > 0
                        ? `${pod.creditsIncluded} credits / mo`
                        : pod.hoursIncluded > 0
                          ? `${pod.hoursIncluded}h · ${pod.peakHoursIncluded}h peak`
                          : 'custom scoping'}
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid gap-2 border-t border-hairline pt-4 sm:grid-cols-2">
                  <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-slate-400">
                    team{' '}
                    <span className="text-ghost">
                      {pod.managers + pod.specialists + pod.agents > 0
                        ? `${pod.managers} / ${pod.specialists} / ${pod.agents}`
                        : 'custom'}
                    </span>
                  </p>
                  <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-slate-400 sm:text-right">
                    {pod.includesCodes.length > 0 ? `carries ${pod.includesCodes.join(' + ')}` : 'standalone'}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          {pods.map((pod, dotIndex) => (
            <button
              key={pod.code}
              type="button"
              onClick={() => go(dotIndex)}
              aria-label={`Show ${pod.name}`}
              aria-current={dotIndex === index}
              className={`h-1 rounded-full transition-all duration-300 ${
                dotIndex === index ? 'w-6 bg-emerald-400' : 'w-2.5 bg-slate-700 hover:bg-slate-500'
              }`}
            />
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/pricing"
            className="mr-2 inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.12em] text-emerald-300 underline-offset-4 hover:underline"
          >
            All six
            <ArrowRight aria-hidden className="size-3" strokeWidth={1.9} />
          </Link>
          <button
            type="button"
            onClick={() => go(index - 1)}
            aria-label="Previous pod"
            className="grid size-8 place-items-center rounded-lg border border-hairline text-slate-400 transition-colors hover:border-emerald-400/40 hover:text-emerald-300"
          >
            <ChevronLeft aria-hidden className="size-4" strokeWidth={1.9} />
          </button>
          <button
            type="button"
            onClick={() => go(index + 1)}
            aria-label="Next pod"
            className="grid size-8 place-items-center rounded-lg border border-hairline text-slate-400 transition-colors hover:border-emerald-400/40 hover:text-emerald-300"
          >
            <ChevronRight aria-hidden className="size-4" strokeWidth={1.9} />
          </button>
        </div>
      </div>
    </div>
  );
}
