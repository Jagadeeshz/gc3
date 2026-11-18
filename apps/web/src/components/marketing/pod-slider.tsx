'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, ArrowUpRight } from 'lucide-react';
import { PODS } from '@/lib/pods';

/**
 * The catalogue as a slider.
 *
 * A snap rail rather than a carousel library: the browser already knows how to
 * fling a scroll container, and on a phone this is simply a swipe. What the code
 * adds is the part the browser does not give you — the counter, the progress rail,
 * arrow keys, and the depth treatment that lifts whichever card is centred.
 *
 * Drag-to-scroll is implemented for pointers, with the click suppressed past a
 * few pixels of travel: without that, dragging a card ends by opening its link.
 */
export function PodSlider() {
  const rail = useRef<HTMLDivElement | null>(null);
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);

  const drag = useRef({ down: false, startX: 0, startLeft: 0, moved: 0 });

  const sync = useCallback(() => {
    const el = rail.current;
    if (!el) return;
    const cards = Array.from(el.querySelectorAll<HTMLElement>('[data-pod]'));
    if (!cards.length) return;

    const first = cards[0];
    const second = cards[1];
    if (!first) return;

    // index from the rail's own step, not from an assumed centre: with the rail
    // padded, scrollLeft / step lands exactly on the card in the middle
    const step = second ? second.offsetLeft - first.offsetLeft : first.offsetWidth;
    const best = Math.max(0, Math.min(cards.length - 1, Math.round(el.scrollLeft / (step || 1))));

    cards.forEach((card, i) => {
      card.toggleAttribute('data-active', i === best);
      card.toggleAttribute('data-past', i < best);
    });

    setIndex(best);
    const max = el.scrollWidth - el.clientWidth;
    setProgress(max > 0 ? el.scrollLeft / max : 0);
  }, []);

  const go = useCallback((dir: -1 | 1) => {
    const el = rail.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>('[data-pod]');
    const step = card ? card.offsetWidth + 16 : el.clientWidth * 0.8;
    el.scrollBy({ left: step * dir, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const el = rail.current;
    if (!el) return;

    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        sync();
      });
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', sync);
    sync();

    return () => {
      el.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', sync);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [sync]);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse') return;
    const el = rail.current;
    if (!el) return;
    drag.current = { down: true, startX: e.clientX, startLeft: el.scrollLeft, moved: 0 };
    setDragging(true);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = rail.current;
    if (!el || !drag.current.down) return;
    const dx = e.clientX - drag.current.startX;
    drag.current.moved = Math.max(drag.current.moved, Math.abs(dx));
    el.scrollLeft = drag.current.startLeft - dx;
  };

  const endDrag = () => {
    drag.current.down = false;
    setDragging(false);
  };

  // a drag that travelled should not also open the card's link
  const onClickCapture = (e: React.MouseEvent<HTMLDivElement>) => {
    if (drag.current.moved > 6) {
      e.preventDefault();
      e.stopPropagation();
      drag.current.moved = 0;
    }
  };

  return (
    <section id="pods" className="border-b border-hairline bg-transparent py-20 sm:py-24">
      <div className="shell">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="reveal max-w-[52ch]">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-gold-light)]">
              The catalogue
            </p>
            <h2 className="mt-3 font-display text-[clamp(1.9rem,3.4vw,2.9rem)] leading-[1.06] tracking-[-0.025em] text-ghost">
              Slide through the pods.
            </h2>
          </div>

          <div className="flex items-center gap-4">
            <p className="font-mono text-[11px] tabular-nums text-ghost-muted">
              <span className="text-ghost">{String(index + 1).padStart(2, '0')}</span>
              <span className="mx-1 opacity-40">/</span>
              {String(PODS.length).padStart(2, '0')}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => go(-1)}
                aria-label="Previous pod"
                className="grid size-10 place-items-center rounded-full border border-hairline text-ghost transition-colors hover:border-[color:var(--color-gold-light)] hover:text-[color:var(--color-gold-light)] disabled:opacity-30"
                disabled={index === 0}
              >
                <ArrowLeft aria-hidden className="size-4" strokeWidth={1.8} />
              </button>
              <button
                type="button"
                onClick={() => go(1)}
                aria-label="Next pod"
                className="grid size-10 place-items-center rounded-full border border-hairline text-ghost transition-colors hover:border-[color:var(--color-gold-light)] hover:text-[color:var(--color-gold-light)] disabled:opacity-30"
                disabled={index === PODS.length - 1}
              >
                <ArrowRight aria-hidden className="size-4" strokeWidth={1.8} />
              </button>
            </div>
          </div>
        </div>

        <div
          ref={rail}
          className={`pod-rail mt-10 ${dragging ? 'is-dragging' : ''}`}
          onScroll={sync}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerLeave={endDrag}
          onClickCapture={onClickCapture}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight') {
              e.preventDefault();
              go(1);
            }
            if (e.key === 'ArrowLeft') {
              e.preventDefault();
              go(-1);
            }
          }}
          tabIndex={0}
          role="group"
          aria-label="Capability pods"
        >
          {PODS.map((pod, i) => {
            const Icon = pod.icon;

            return (
              <article
                key={pod.name}
                data-pod={pod.name}
                className="pod-card pod-slide b-surface"
                style={{ '--i': i } as React.CSSProperties}
              >
                <span aria-hidden="true" className="pod-card__beam" />
                <span aria-hidden="true" className="pod-card__sheen" />
                <span aria-hidden="true" className="pod-slide__index">
                  {String(i + 1).padStart(2, '0')}
                </span>

                <span className="pod-card__chip inline-grid size-10 place-items-center rounded-[10px] border border-hairline bg-obsidian text-ghost">
                  <Icon aria-hidden className="size-[18px]" strokeWidth={1.7} />
                </span>

                <h3 className="mt-5 font-display text-[22px] leading-tight tracking-[-0.01em] text-ghost">
                  {pod.name}
                </h3>
                <p className="mt-2 text-[13px] leading-[1.7] text-ghost-muted">{pod.outcome}</p>

                <dl className="mt-auto grid gap-1 border-t border-hairline pt-4">
                  <div className="flex items-baseline justify-between gap-4">
                    <dt className="font-mono text-[9px] uppercase tracking-[0.14em] text-ghost-muted">
                      Composition
                    </dt>
                    <dd className="text-right text-[11px] text-ghost-muted">{pod.composition}</dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-4">
                    <dt className="font-mono text-[9px] uppercase tracking-[0.14em] text-ghost-muted">Pool</dt>
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
              </article>
            );
          })}
        </div>

        <div className="mt-6 h-px w-full bg-hairline">
          <div
            className="h-px bg-[var(--color-gold-light)] transition-[width] duration-300"
            style={{ width: `${(1 / PODS.length) * 100 + progress * (1 - 1 / PODS.length) * 100}%` }}
          />
        </div>
      </div>
    </section>
  );
}
