'use client';

import { useEffect, useRef, useState } from 'react';
import type { CapabilityPod } from '@gc3/types';
import { fetchPods } from '@/lib/api-client';

/**
 * Hero right column: the supplied render, whole, on a 3D plane with a 3D pod slide beside it.
 *
 * The artwork is used as delivered — sculpture, holographic panels and light waves all intact.
 * Only the wordmark strip along the bottom was trimmed off, because it is the plate's caption,
 * not part of the sculpture. Nothing is keyed and nothing is re-framed.
 *
 * The plate's ground is near-black, so it sits on the page's obsidian without a visible edge; a
 * short mask on the bottom and the outer sides dissolves the frame line where the two differ
 * slightly, which is the only treatment applied.
 *
 * Both interactions are 3D, and both are CSS perspective rather than WebGL:
 *
 *  · the sculpture plane tilts with the pointer, written straight to --rx / --ry so movement
 *    never re-renders React;
 *  · each slide sits in its own perspective and, on hover or focus, comes forward on Z and turns
 *    a few degrees on Y — it moves out of the stack toward the viewer rather than just changing
 *    colour.
 *
 * Nothing here animates on its own: no loops, no keyframes, no autoplay. The page stays static
 * until the pointer arrives.
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

  const handleMove = (event: React.PointerEvent<HTMLDivElement>): void => {
    const stage = stageRef.current;
    if (!stage || event.pointerType === 'touch') return;

    const box = stage.getBoundingClientRect();
    const x = (event.clientX - box.left) / box.width - 0.5;
    const y = (event.clientY - box.top) / box.height - 0.5;

    stage.style.setProperty('--ry', `${(x * 10).toFixed(2)}deg`);
    stage.style.setProperty('--rx', `${(-y * 8).toFixed(2)}deg`);
  };

  const handleLeave = (): void => {
    const stage = stageRef.current;
    if (!stage) return;
    stage.style.setProperty('--ry', '0deg');
    stage.style.setProperty('--rx', '0deg');
  };

  return (
    <div className={className}>
      <div className="grid items-center gap-6 lg:grid-cols-[minmax(0,172px)_minmax(0,1fr)]">
        {/* slides: their own perspective stack, so each one can come forward on hover */}
        <ul className="slide-stack order-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:order-1 lg:grid-cols-1">
          {pods.map((pod, index) => {
            const isActive = active === pod.code;
            const colour = POD_COLOURS[index % POD_COLOURS.length] ?? '#00ddaa';

            return (
              <li key={pod.code} className="slide-item">
                <button
                  type="button"
                  onMouseEnter={() => setActive(pod.code)}
                  onFocus={() => setActive(pod.code)}
                  onMouseLeave={() => setActive(null)}
                  onBlur={() => setActive(null)}
                  aria-pressed={isActive}
                  className={`slide-card flex w-full items-center gap-2 rounded-[8px] border px-2.5 py-2 text-left ${
                    isActive ? 'is-active border-white/25 bg-white/[0.07]' : 'border-white/10 bg-white/[0.02]'
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
        <div className="order-1 min-w-0 lg:order-2">
          <div
            ref={stageRef}
            onPointerMove={handleMove}
            onPointerLeave={handleLeave}
            className="sculpture-stage relative mx-auto w-full max-w-[640px]"
            style={{ ['--glow' as string]: glow }}
          >
            <div aria-hidden="true" className="sculpture-halo absolute inset-[6%] rounded-full" />

            <div className="sculpture-plane relative">
              <img
                src="/images/gc3-sculpture.webp"
                alt=""
                width={1600}
                height={748}
                loading="eager"
                decoding="async"
                className="sculpture-plate relative block w-full"
              />
            </div>
          </div>

          {/* what the hovered pod covers — name and one line, never a figure */}
          <div className="mt-3 min-h-[38px] text-center lg:text-left">
            {activePod ? (
              <>
                <p className="font-mono text-[9px] uppercase tracking-[0.16em]" style={{ color: glow }}>
                  {activePod.name}
                </p>
                <p className="mt-1 max-w-[42ch] text-[11.5px] leading-snug text-ghost-muted">{activePod.tagline}</p>
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
