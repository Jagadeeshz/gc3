'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import type { CapabilityPod } from '@gc3/types';
import { fetchPods } from '@/lib/api-client';

/**
 * The pod rail: six capability pods you can move through.
 *
 * Movable three ways, because a rail that answers only one input is a rail half the visitors
 * cannot use:
 *   · drag — pointer down and pull, with the pointer captured so the drag survives leaving a card;
 *   · scroll — native horizontal scroll with snap points, so trackpads and touch work untouched;
 *   · buttons — arrows step one card, and they are real buttons.
 *
 * Each card carries a pod's name, what it covers, and two things it delivers. No figures and no
 * money language: pricing lives on /pricing, and a price on a hero card invites a comparison this
 * section cannot answer.
 *
 * Nothing animates by itself. The page is static until the pointer arrives.
 */

const POD_COLOURS = ['#00ddaa', '#7b00ff', '#ffdd00', '#0099ff', '#ff8800', '#aaff00'];

const shortName = (name: string): string =>
  name.replace(/\s*\(?Digital\)?\s*/i, ' ').replace(/\s*Pod$/i, '').trim();

/**
 * Taglines in the catalogue describe the credit-priced pods in money terms ("Custom team, priced
 * per credit."). A clause about money is dropped whole rather than edited: trimming words out of
 * the sentence leaves fragments like "Custom team, per", which reads worse than a neutral line.
 */
const NEUTRAL_TAGLINE = 'Scoped to the work, not to a licence count.';
const MONEY = /(priced|price|pricing|cost|credit|per month)/i;

const safeTagline = (tagline: string): string => {
  const text = tagline.trim();
  if (text === '') return NEUTRAL_TAGLINE;
  return MONEY.test(text) ? NEUTRAL_TAGLINE : text;
};

export function PodSlides({ className }: { readonly className?: string }) {
  const [pods, setPods] = useState<readonly CapabilityPod[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ startX: number; startLeft: number } | null>(null);

  useEffect(() => {
    let alive = true;

    fetchPods()
      .then((rows) => {
        if (alive) setPods(rows);
      })
      .catch(() => {
        // The rail simply renders nothing rather than a broken one.
      });

    return () => {
      alive = false;
    };
  }, []);

  const step = (direction: -1 | 1): void => {
    const rail = railRef.current;
    if (!rail) return;

    const card = rail.querySelector<HTMLElement>('[data-card]');
    const amount = (card?.offsetWidth ?? 240) + 12;
    rail.scrollBy({ left: amount * direction, behavior: 'smooth' });
  };

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>): void => {
    const rail = railRef.current;
    if (!rail || event.pointerType === 'touch') return; // touch already scrolls natively

    drag.current = { startX: event.clientX, startLeft: rail.scrollLeft };
    rail.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>): void => {
    const rail = railRef.current;
    if (!rail || !drag.current) return;
    rail.scrollLeft = drag.current.startLeft - (event.clientX - drag.current.startX);
  };

  const endDrag = (event: React.PointerEvent<HTMLDivElement>): void => {
    const rail = railRef.current;
    if (rail?.hasPointerCapture(event.pointerId)) rail.releasePointerCapture(event.pointerId);
    drag.current = null;
  };

  if (pods.length === 0) return null;

  return (
    <div className={className}>
      <div className="mb-3 flex items-end justify-between gap-4">
        <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-ghost-muted">
          Capability pods — drag to move
        </p>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => step(-1)}
            aria-label="Previous pods"
            className="grid size-7 place-items-center rounded-full border border-white/12 text-ghost-muted transition-colors hover:border-white/25 hover:text-ghost"
          >
            <ArrowLeft aria-hidden className="size-3.5" strokeWidth={1.9} />
          </button>
          <button
            type="button"
            onClick={() => step(1)}
            aria-label="Next pods"
            className="grid size-7 place-items-center rounded-full border border-white/12 text-ghost-muted transition-colors hover:border-white/25 hover:text-ghost"
          >
            <ArrowRight aria-hidden className="size-3.5" strokeWidth={1.9} />
          </button>
        </div>
      </div>

      <div
        ref={railRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        tabIndex={0}
        role="group"
        aria-label="Capability pods"
        className="pod-rail flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2"
      >
        {pods.map((pod, index) => {
          const isActive = active === pod.code;
          const colour = POD_COLOURS[index % POD_COLOURS.length] ?? '#00ddaa';

          return (
            <article
              key={pod.code}
              data-card
              onMouseEnter={() => setActive(pod.code)}
              onMouseLeave={() => setActive(null)}
              className={`slide-card w-[228px] shrink-0 snap-start rounded-[10px] border p-3 sm:w-[248px] ${
                isActive ? 'is-active border-white/25 bg-white/[0.07]' : 'border-white/10 bg-white/[0.025]'
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="size-1.5 shrink-0 rounded-full"
                  style={{ background: isActive ? colour : 'rgba(255,255,255,0.25)' }}
                />
                <h3 className="min-w-0 truncate text-[12px] font-medium text-ghost">{shortName(pod.name)}</h3>
                <span className="ml-auto font-mono text-[9px] tabular-nums text-ghost-muted">
                  {String(index + 1).padStart(2, '0')}
                </span>
              </div>

              <p className="mt-2 line-clamp-3 text-[11px] leading-snug text-ghost-muted">
                {safeTagline(pod.tagline ?? '')}
              </p>

              {pod.perks.length > 0 ? (
                <ul className="mt-2.5 grid gap-1">
                  {pod.perks.slice(0, 2).map((perk) => (
                    <li key={perk} className="flex items-start gap-1.5 text-[10px] leading-snug text-ghost-muted/85">
                      <span
                        aria-hidden="true"
                        className="mt-[5px] size-1 shrink-0 rounded-full"
                        style={{ background: colour }}
                      />
                      <span className="line-clamp-1">{perk}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </article>
          );
        })}
      </div>
    </div>
  );
}
