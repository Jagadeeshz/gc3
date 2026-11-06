'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CapabilityPod } from '@gc3/types';
import { fetchPods } from '@/lib/api-client';

/**
 * The hero's orbital system.
 *
 * Six glass pods around the GC³ core, driven by the live catalogue — every name,
 * price, credit pool and team count comes from `GET /api/v1/pricing/pods`, so the
 * composition cannot advertise an offering we do not sell.
 *
 * Motion is split across nested wrappers so no two animations claim the same
 * property:
 *
 *   outer    position + cursor parallax   (CSS custom properties → transform)
 *   float    the slow drift               (translate3d)
 *   breathe  the glass breathing          (scale + opacity)
 *   button   hover elevation + drawer      (bordered transitions)
 *
 * Parallax is written straight to two custom properties inside a single
 * requestAnimationFrame callback: no React state per pointer move, no layout, no
 * paint — the compositor shifts six already-composited layers.
 *
 * Every disc is a real <button aria-expanded aria-controls>, so the drawer opens by
 * keyboard and touch as well as hover and is announced correctly.
 */

const RING = [
  { left: '74%', top: '9%', depth: 18 },
  { left: '64%', top: '44%', depth: 26 },
  { left: '70%', top: '76%', depth: 14 },
  { left: '86%', top: '88%', depth: 22 },
  { left: '90%', top: '58%', depth: 12 },
  { left: '88%', top: '30%', depth: 20 },
] as const;

const money = (minor: number, currency: string): string =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(
    minor / 100,
  );

const priceTag = (pod: CapabilityPod): string =>
  pod.isCustomPriced
    ? `${money(pod.creditRateCents, pod.currency)}/credit`
    : `${money(pod.monthlyPriceCents, pod.currency)}/mo`;

const capacityTag = (pod: CapabilityPod): string => {
  if (pod.creditsIncluded > 0) return `${pod.creditsIncluded} credits`;
  if (pod.hoursIncluded > 0) return `${pod.hoursIncluded}h · ${pod.peakHoursIncluded}h peak`;
  return 'scoped';
};

function Disc({
  pod,
  index,
  open,
  onOpen,
  onClose,
}: {
  readonly pod: CapabilityPod;
  readonly index: number;
  readonly open: boolean;
  readonly onOpen: () => void;
  readonly onClose: () => void;
}) {
  const spot = RING[index] ?? RING[0];
  const panelId = `hero-pod-${pod.code.toLowerCase()}`;

  return (
    <div
      className="absolute hidden -translate-x-1/2 -translate-y-1/2 lg:block"
      style={{
        left: spot.left,
        top: spot.top,
        // Depth per disc: the ring shifts like layered glass, not a flat plane.
        transform: `translate(-50%, -50%) translate3d(calc(var(--mx, 0) * ${spot.depth}px), calc(var(--my, 0) * ${spot.depth * 0.6}px), 0)`,
      }}
    >
      <div className="disc-float" style={{ animationDelay: `${index * 0.7}s` }}>
        <div className="disc-breathe" style={{ animationDelay: `${index * 0.45}s` }}>
          <button
            type="button"
            aria-expanded={open}
            aria-controls={panelId}
            onClick={() => (open ? onClose() : onOpen())}
            onMouseEnter={onOpen}
            onMouseLeave={onClose}
            onFocus={onOpen}
            onBlur={onClose}
            className={`group w-[172px] cursor-pointer rounded-[14px] border px-3.5 py-2.5 text-left backdrop-blur-[3px] transition-[border-color,transform,box-shadow,background-color] duration-300 ease-out ${
              open
                ? '-translate-y-1 border-emerald-400/55 bg-[#0a111c]/95 shadow-[0_26px_60px_-28px_rgba(16,185,129,0.7)]'
                : 'border-emerald-400/20 bg-[#0a111c]/75 hover:-translate-y-0.5 hover:border-emerald-400/40'
            }`}
          >
            <span className="mb-1.5 flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-slate-300" />
              <span className="size-1.5 rounded-full bg-emerald-400" />
              <span className="ml-1 font-mono text-[7.5px] uppercase tracking-[0.12em] text-slate-500">
                human + ai
              </span>
            </span>

            <span className="block text-[11px] font-medium leading-tight text-slate-100">
              {pod.name}
            </span>
            <span className="mt-0.5 block font-mono text-[10px] tabular-nums text-emerald-300">
              {priceTag(pod)}
            </span>
            <span className="block font-mono text-[8.5px] uppercase tracking-[0.08em] text-slate-500">
              {capacityTag(pod)}
            </span>

            {/* Drawer: 0fr → 1fr — an unknown height with no measurement in JS. */}
            <span
              id={panelId}
              className={`grid overflow-hidden transition-[grid-template-rows] duration-300 ease-out ${
                open ? 'mt-2 grid-rows-[1fr]' : 'grid-rows-[0fr]'
              }`}
            >
              <span className="overflow-hidden">
                <span className="block border-t border-emerald-400/15 pt-2">
                  <span className="block font-mono text-[7.5px] uppercase tracking-[0.14em] text-slate-500">
                    team
                  </span>
                  <span className="mt-1 block font-mono text-[9px] tabular-nums text-slate-300">
                    {pod.managers + pod.specialists + pod.agents > 0
                      ? `${pod.managers} mgr · ${pod.specialists} spec · ${pod.agents} agents`
                      : (pod.teamSummary ?? 'custom team')}
                  </span>

                  <span className="mt-2 block font-mono text-[7.5px] uppercase tracking-[0.14em] text-slate-500">
                    covers
                  </span>
                  <span className="mt-1 block text-[9px] leading-[1.45] text-slate-400">
                    {pod.perks.slice(0, 4).join(' · ')}
                  </span>
                </span>
              </span>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

export function HeroOrbit() {
  const [pods, setPods] = useState<readonly CapabilityPod[]>([]);
  const [openCode, setOpenCode] = useState<string | null>(null);
  const frame = useRef(0);
  const pointer = useRef({ x: 0, y: 0 });
  const stage = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let alive = true;

    fetchPods()
      .then((rows) => {
        if (alive) setPods(rows);
      })
      .catch(() => {
        /* decoration: the hero still reads if the catalogue is unreachable */
      });

    return () => {
      alive = false;
    };
  }, []);

  const onPointerMove = useCallback((event: PointerEvent) => {
    pointer.current = {
      x: (event.clientX / window.innerWidth - 0.5) * 2,
      y: (event.clientY / window.innerHeight - 0.5) * 2,
    };

    if (frame.current !== 0) {
      return;
    }

    frame.current = window.requestAnimationFrame(() => {
      frame.current = 0;
      const node = stage.current;
      if (!node) return;

      node.style.setProperty('--mx', pointer.current.x.toFixed(3));
      node.style.setProperty('--my', pointer.current.y.toFixed(3));
    });
  }, []);

  useEffect(() => {
    // Coarse pointers get no parallax: there is no cursor to track, and the
    // listener would only spend frames on a device already short of them.
    if (!window.matchMedia('(pointer: fine)').matches) {
      return;
    }

    window.addEventListener('pointermove', onPointerMove, { passive: true });

    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      if (frame.current !== 0) window.cancelAnimationFrame(frame.current);
    };
  }, [onPointerMove]);

  return (
    <div ref={stage} className="absolute inset-0 overflow-hidden">
      {/* Earth limb */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-[46%] left-1/2 h-[92%] w-[150%] -translate-x-1/2 rounded-[50%] border-t border-emerald-400/30 bg-[radial-gradient(60%_60%_at_50%_0%,rgba(16,185,129,0.16),rgba(9,13,22,0.98)_62%)] shadow-[0_-40px_120px_-40px_rgba(16,185,129,0.45)]"
      />

      {/* Orbit rings */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 hidden lg:block">
        {[
          { w: '58%', h: '34%', d: '0s' },
          { w: '76%', h: '48%', d: '1.2s' },
          { w: '94%', h: '64%', d: '2.4s' },
        ].map((ring) => (
          <div
            key={ring.w}
            style={{ width: ring.w, height: ring.h, animationDelay: ring.d }}
            className="orbit-ring-pulse absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-[50%] border border-dashed border-emerald-400/20"
          />
        ))}
      </div>

      {/* Pods */}
      <div className="absolute inset-y-0 right-0 w-[62%]">
        {pods.map((pod, index) => (
          <Disc
            key={pod.code}
            pod={pod}
            index={index}
            open={openCode === pod.code}
            onOpen={() => setOpenCode(pod.code)}
            onClose={() => setOpenCode((current) => (current === pod.code ? null : current))}
          />
        ))}
      </div>
    </div>
  );
}
