'use client';

import { useEffect, useState } from 'react';
import type { CapabilityPod } from '@gc3/types';
import { fetchPods } from '@/lib/api-client';

/**
 * The hero composition: pods orbiting the GC³ core.
 *
 * Built from the live catalogue, not from a picture — every label, price and credit
 * count comes from `GET /api/v1/pricing/pods`. That is the whole point: a hero drawn
 * with our six pods cannot go stale or advertise an offering we do not sell.
 *
 * Placement is a six-point ring around the core on lg, and a plain two-column grid
 * on smaller screens where orbit positions would collide with the headline.
 */

// Hug the right two-thirds: the headline owns the left, and a disc that overlaps
// it makes both unreadable.
// Keep every disc inside the right third: the copy column owns the left, and a disc
// that clips the container edge looks like a bug rather than an orbit.
const RING = [
  { left: '74%', top: '9%' },
  { left: '64%', top: '44%' },
  { left: '70%', top: '76%' },
  { left: '86%', top: '88%' },
  { left: '90%', top: '58%' },
  { left: '88%', top: '30%' },
] as const;

const money = (minor: number, currency: string): string =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(
    minor / 100,
  );

function priceTag(pod: CapabilityPod): string {
  return pod.isCustomPriced
    ? `${money(pod.creditRateCents, pod.currency)}/credit`
    : `${money(pod.monthlyPriceCents, pod.currency)}/mo`;
}

function capacityTag(pod: CapabilityPod): string {
  if (pod.creditsIncluded > 0) return `${pod.creditsIncluded} credits`;
  if (pod.hoursIncluded > 0) return `${pod.hoursIncluded}h · ${pod.peakHoursIncluded}h peak`;
  return 'scoped per engagement';
}

function PodDisc({
  pod,
  position,
  index,
}: {
  readonly pod: CapabilityPod;
  readonly position: { left: string; top: string };
  readonly index: number;
}) {
  return (
    <div
      style={{ left: position.left, top: position.top, animationDelay: `${index * 0.6}s` }}
      className="hero-disc group absolute hidden w-[152px] -translate-x-1/2 -translate-y-1/2 rounded-[14px] border border-emerald-400/20 bg-[#0a111c]/80 px-3.5 py-2.5 backdrop-blur-[3px] transition-colors duration-300 hover:border-emerald-400/50 lg:block"
    >
      {/* human + agent pair: two tokens, one unit */}
      <div className="mb-1.5 flex items-center gap-1">
        <span className="size-1.5 rounded-full bg-slate-300" />
        <span className="size-1.5 rounded-full bg-emerald-400" />
        <span className="ml-1 font-mono text-[7.5px] uppercase tracking-[0.12em] text-slate-500">
          human + ai
        </span>
      </div>

      <p className="text-[11px] font-medium leading-tight text-slate-100">{pod.name}</p>
      <p className="mt-0.5 font-mono text-[10px] tabular-nums text-emerald-300">{priceTag(pod)}</p>
      <p className="font-mono text-[8.5px] uppercase tracking-[0.08em] text-slate-500">
        {capacityTag(pod)}
      </p>
    </div>
  );
}

export function HeroOrbit() {
  const [pods, setPods] = useState<readonly CapabilityPod[]>([]);

  useEffect(() => {
    let alive = true;
    fetchPods()
      .then((rows) => {
        if (alive) setPods(rows);
      })
      .catch(() => {
        /* decoration: if the catalogue is unreachable the hero still reads */
      });

    return () => {
      alive = false;
    };
  }, []);

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Earth limb: the globe the platform sits on. */}
      <div className="absolute -bottom-[46%] left-1/2 h-[92%] w-[150%] -translate-x-1/2 rounded-[50%] border-t border-emerald-400/30 bg-[radial-gradient(60%_60%_at_50%_0%,rgba(16,185,129,0.16),rgba(9,13,22,0.98)_62%)] shadow-[0_-40px_120px_-40px_rgba(16,185,129,0.45)]" />

      {/* Orbit rings */}
      <div className="absolute inset-0 hidden lg:block">
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

      {/* The core */}
      <div className="absolute left-[64%] top-[46%] hidden -translate-x-1/2 -translate-y-1/2 lg:block">
        <div className="core-glow grid size-[132px] place-items-center rounded-[26px] border border-emerald-400/35 bg-[#08101c]/85 backdrop-blur-[2px]">
          <span className="font-display text-[34px] font-semibold tracking-[-0.03em] text-emerald-300">
            GC³
          </span>
          <span className="mt-[-10px] font-mono text-[7px] uppercase tracking-[0.22em] text-slate-500">
            engine
          </span>
        </div>
      </div>

      {/* Pods: orbit on desktop, a plain grid on mobile. */}
      <div className="absolute inset-y-0 right-0 hidden w-[62%] lg:block">
        {pods.map((pod, index) => (
          <PodDisc key={pod.code} pod={pod} position={RING[index] ?? RING[0]} index={index} />
        ))}
      </div>

    </div>
  );
}
