'use client';

import Link from 'next/link';
import { PODS, type Pod } from '@/lib/pods';
import { useCallback, useRef } from 'react';
import {
  ArrowUpRight,
  Bot,
  Compass,
  Headset,
  MousePointerClick,
  Palette,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';

/**
 * The catalogue, as a card grid.
 *
 * Design language: every pod is a surface you could pick up — icon chip, a name,
 * one sentence about the outcome, and the commercial fact underneath. The card is
 * the unit of the whole site, so this grid is the page in miniature.
 */



/**
 * Pointer-tracked spotlight and tilt for the catalogue.
 *
 * One listener on the grid, not six on the cards, and the position is written to
 * the card's own custom properties rather than to React state: a `setState` per
 * pointermove re-renders all six cards and the highlight visibly trails the
 * cursor. `requestAnimationFrame` collapses the writes to one per frame.
 *
 * Coarse pointers are excluded — a tilt under a finger is shake, not depth.
 */
function usePointerTilt() {
  const grid = useRef<HTMLDivElement | null>(null);
  const frame = useRef(0);
  const pending = useRef<{ card: HTMLElement; x: number; y: number } | null>(null);

  const onPointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'mouse') return;

    const card = (event.target as HTMLElement).closest<HTMLElement>('.pod-card');
    if (!card) return;

    const rect = card.getBoundingClientRect();
    pending.current = {
      card,
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };

    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      const next = pending.current;
      if (!next) return;

      const { card: target, x, y } = next;
      const { width, height } = target.getBoundingClientRect();
      const px = x / width - 0.5;
      const py = y / height - 0.5;

      target.style.setProperty('--mx', `${x}px`);
      target.style.setProperty('--my', `${y}px`);
      target.style.setProperty('--ry', `${px * 7}deg`);
      target.style.setProperty('--rx', `${-py * 7}deg`);
    });
  }, []);

  const onPointerLeave = useCallback(() => {
    const card = grid.current?.querySelector<HTMLElement>('.pod-card[style]');
    for (const node of grid.current?.querySelectorAll<HTMLElement>('.pod-card') ?? []) {
      node.style.removeProperty('--rx');
      node.style.removeProperty('--ry');
    }
    card?.style.removeProperty('--mx');
  }, []);

  return { grid, onPointerMove, onPointerLeave };
}

export function CapabilityGrid({
  showHeader = true,
  background = false,
}: { readonly showHeader?: boolean; readonly background?: boolean } = {}) {
  const pointer = usePointerTilt();

  return (
    <section
      id="pods"
      className={`relative overflow-hidden border-b border-hairline py-20 sm:py-24 ${background ? '' : 'bg-transparent'}`}
    >
      {background ? (
        <>
          {/* The hall, as the section's ground. Dimmed and scrimmed from both ends
              so the cards keep their contrast and the section blends into the page
              instead of sitting on it as a photograph. */}
          <div
            aria-hidden="true"
            className="podbg pointer-events-none absolute inset-0 -z-10"
            style={{ backgroundImage: "url('/brand/pods-hall.jpg')" }}
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 -z-10"
            style={{
              background:
                'linear-gradient(180deg, #0d0c11 0%, rgba(13,12,17,0.55) 22%, rgba(13,12,17,0.62) 72%, #0d0c11 100%)',
            }}
          />
        </>
      ) : null}

      <div className="shell">
        {showHeader ? (
          <div className="reveal max-w-[62ch]">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-gold-light)]">
              The catalogue
            </p>
            <h2 className="mt-3 font-display text-[clamp(1.9rem,3.4vw,2.9rem)] leading-[1.06] tracking-[-0.025em] text-ghost">
              Six pods. One of them is already the team you needed.
            </h2>
            <p className="mt-4 text-[14px] leading-[1.8] text-ghost-muted">
              Each pod carries a published pool and a fixed composition, so the team is decided before the work
              begins. Pick the capability, not the headcount.
            </p>
          </div>
        ) : null}

        <div
          ref={pointer.grid}
          onPointerMove={pointer.onPointerMove}
          onPointerLeave={pointer.onPointerLeave}
          className="reveal-stagger mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          {PODS.map((pod) => {
            const Icon = pod.icon;

            return (
              <div key={pod.name}>
                <article className="pod-card group flex h-full flex-col justify-between gap-6 rounded-[14px] border border-hairline bg-obsidian-soft p-6 b-surface">
                  {/* a light that travels the card's edge; decoration only */}
                  <span aria-hidden="true" className="pod-card__beam" />
                  <span aria-hidden="true" className="pod-card__sheen" />
                <div>
                  <span className="pod-card__chip inline-grid size-10 place-items-center rounded-[10px] border border-hairline bg-obsidian text-ghost">
                    <Icon aria-hidden className="size-[18px]" strokeWidth={1.7} />
                  </span>

                  <h3 className="mt-5 font-display text-[20px] leading-tight tracking-[-0.01em] text-ghost">
                    {pod.name}
                  </h3>
                  <p className="mt-2 text-[13px] leading-[1.7] text-ghost-muted">{pod.outcome}</p>
                </div>

                <div>
                  <dl className="grid gap-1 border-t border-hairline pt-4">
                    <div className="flex items-baseline justify-between gap-4">
                      <dt className="font-mono text-[9px] uppercase tracking-[0.14em] text-ghost-muted">
                        Composition
                      </dt>
                      <dd className="text-right text-[11px] text-ghost-muted">{pod.composition}</dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-4">
                      <dt className="font-mono text-[9px] uppercase tracking-[0.14em] text-ghost-muted">
                        Pool
                      </dt>
                      <dd className="text-right font-mono text-[11px] text-ghost">{pod.pool}</dd>
                    </div>
                  </dl>

                  <Link
                    href="/pricing"
                    className="mt-4 inline-flex items-center gap-1.5 text-[12px] text-ghost transition-colors hover:text-gold-light"
                  >
                    See the price
                    <ArrowUpRight aria-hidden className="size-3.5" strokeWidth={1.9} />
                  </Link>
                </div>
                </article>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
