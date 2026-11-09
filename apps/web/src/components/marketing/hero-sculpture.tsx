'use client';

import { useEffect, useRef, useState } from 'react';
import type { CapabilityPod } from '@gc3/types';
import { fetchPods } from '@/lib/api-client';

/**
 * Hero right column: the sculpture in an interactive 3D stage, with a pod slide beside it.
 *
 * The 3D is CSS perspective, not a WebGL scene. A canvas renderer would be the wrong trade here:
 * one still image on a tilted plane reads as depth at this size, costs nothing at runtime, and
 * keeps the page static — which is the requirement. The tilt is written straight to custom
 * properties on the element, so pointer movement never re-renders React.
 *
 * The slides are the six operational pods from the catalogue. Hovering one does two things: it
 * lights that slide, and it re-tints the light behind the sculpture to that pod's colour, so the
 * stage answers the pointer. Selecting is a hover/focus interaction only — there is no carousel,
 * no autoplay and no motion, because the layout is meant to sit still.
 *
 * No commercial figures appear here by design: the slides carry a pod's name and what it covers,
 * and nothing else. Pricing lives on /pricing.
 */

const POD_COLOURS = ['#00ddaa', '#7b00ff', '#ffdd00', '#0099ff', '#ff8800', '#aaff00'];

/** "Growth (Digital) Pod" → "Growth" for the slide; the suffix is noise at this size. */
const shortName = (name: string): string =>
  name.replace(/\s*\(?Digital\)?\s*/i, ' ').replace(/\s*Pod$/i, '').trim();

export function HeroSculpture({ className }: { readonly className?: string }) {
  const [pods, setPods] = useState<readonly CapabilityPod[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;

    fetchPods()
      .then((rows) => {
        if (alive) setPods(rows);
      })
      .catch(() => {
        // The stage stands on its own without the slides.
      });

    return () => {
      alive = false;
    };
  }, []);

  const activeIndex = pods.findIndex((pod) => pod.code === active);
  const glow = activeIndex >= 0 ? (POD_COLOURS[activeIndex % POD_COLOURS.length] ?? '#00ddaa') : '#ededed';
  const activePod = activeIndex >= 0 ? pods[activeIndex] : null;

  /** Tilt with custom properties: no state, no re-render, no animation loop. */
  const handleMove = (event: React.PointerEvent<HTMLDivElement>): void => {
    const stage = stageRef.current;
    if (!stage || event.pointerType === 'touch') return;

    const box = stage.getBoundingClientRect();
    const x = (event.clientX - box.left) / box.width - 0.5;
    const y = (event.clientY - box.top) / box.height - 0.5;

    stage.style.setProperty('--ry', `${(x * 12).toFixed(2)}deg`);
    stage.style.setProperty('--rx', `${(-y * 9).toFixed(2)}deg`);
  };

  const handleLeave = (): void => {
    const stage = stageRef.current;
    if (!stage) return;
    stage.style.setProperty('--ry', '0deg');
    stage.style.setProperty('--rx', '0deg');
  };

  return (
    <div className={className}>
      <div className="grid items-center gap-5 sm:gap-6 lg:grid-cols-[minmax(0,168px)_minmax(0,1fr)]">
        {/* slides — a column beside the sculpture on desktop, a row beneath it on phones */}
        <ul className="order-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3 lg:order-1 lg:grid-cols-1">
          {pods.map((pod, index) => {
            const isActive = active === pod.code;
            const colour = POD_COLOURS[index % POD_COLOURS.length] ?? '#00ddaa';

            return (
              <li key={pod.code}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(pod.code)}
                  onFocus={() => setActive(pod.code)}
                  onMouseLeave={() => setActive(null)}
                  onBlur={() => setActive(null)}
                  aria-pressed={isActive}
                  className={`group flex w-full items-center gap-2 rounded-[8px] border px-2.5 py-2 text-left transition-colors ${
                    isActive
                      ? 'border-white/25 bg-white/[0.06]'
                      : 'border-white/10 bg-transparent hover:border-white/20'
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className="size-1.5 shrink-0 rounded-full"
                    style={{ background: isActive ? colour : 'rgba(255,255,255,0.25)' }}
                  />
                  <span className="min-w-0 truncate text-[11px] text-ghost">{shortName(pod.name)}</span>
                </button>
              </li>
            );
          })}
        </ul>

        {/* the stage */}
        <div className="order-1 lg:order-2">
          <div
            ref={stageRef}
            onPointerMove={handleMove}
            onPointerLeave={handleLeave}
            className="sculpture-stage relative mx-auto w-full max-w-[400px]"
            style={{ ['--glow' as string]: glow }}
          >
            <div aria-hidden="true" className="sculpture-halo absolute inset-x-[6%] bottom-[8%] top-[10%] rounded-full" />

            <div className="sculpture-plane relative">
              <img
                src="/images/gc3-sculpture.png"
                alt=""
                width={650}
                height={598}
                loading="eager"
                decoding="async"
                className="relative block w-full [mask-image:linear-gradient(to_bottom,#000_84%,transparent_100%)]"
              />
            </div>
          </div>

          {/* what the hovered pod covers — name and one line, never a figure */}
          <div className="mt-2 min-h-[34px] text-center lg:text-left">
            {activePod ? (
              <>
                <p className="font-mono text-[9px] uppercase tracking-[0.16em]" style={{ color: glow }}>
                  {activePod.name}
                </p>
                <p className="mt-1 text-[11.5px] leading-snug text-ghost-muted">{activePod.tagline}</p>
              </>
            ) : (
              <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-ghost-muted/70">
                Hover a pod to preview it
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
