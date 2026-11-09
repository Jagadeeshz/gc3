'use client';

import { useEffect, useState } from 'react';
import {
  Blocks,
  Clock3,
  Compass,
  MousePointerClick,
  Palette,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';
import type { CapabilityPod } from '@gc3/types';
import { fetchPods } from '@/lib/api-client';

/**
 * The hero diagram: GC³ at a fixed centre, the pods on an even ellipse around it.
 *
 * Everything except the centre turns — the cards orbit and counter-rotate so their labels stay
 * upright, and the centre never moves, because a rotating label at the middle of a diagram that
 * is itself rotating is noise.
 *
 * Layering, back to front: the ray burst, the two rings, the cards, the hub. The rays sit behind
 * everything and are the only element with no card attached to it — they give the figure a light
 * source rather than a silhouette.
 *
 * The six names are the pod catalogue, fetched live; only the icons are chosen here, keyed by POD
 * code, because the catalogue has no icon concept and inventing one per row would be a migration.
 */

const ICONS: Record<string, LucideIcon> = {
  CREATIVE: Palette,
  GROWTH: TrendingUp,
  DIGITAL: TrendingUp,
  STRATEGY: Compass,
  INTERACTIVE: MousePointerClick,
  AUTOMATION: Blocks,
  REMAU: Clock3,
};

const CARD_ANGLES = [-90, -30, 30, 90, 150, 210] as const;

const RAY_COUNT = 18;
const REVOLUTION_S = 84;

/** An ellipse, not a circle: the column is taller than it is wide at most viewports. */
const RADIUS_X = 36;
const RADIUS_Y = 32;

const place = (index: number): { left: string; top: string } => {
  const angle = CARD_ANGLES[index % CARD_ANGLES.length] ?? -90;
  const radians = (angle * Math.PI) / 180;
  return {
    left: `${50 + RADIUS_X * Math.cos(radians)}%`,
    top: `${50 + RADIUS_Y * Math.sin(radians)}%`,
  };
};

const RAYS = Array.from({ length: RAY_COUNT }, (_, index) => {
  const degrees = (360 / RAY_COUNT) * index + 6;
  const radians = (degrees * Math.PI) / 180;
  const inner = 26;
  const outer = index % 3 === 0 ? 49 : 44; // every third ray reaches further, so the burst reads as light

  return {
    id: `ray-${index}`,
    x1: 50 + Math.cos(radians) * inner,
    y1: 50 + Math.sin(radians) * inner,
    x2: 50 + Math.cos(radians) * outer,
    y2: 50 + Math.sin(radians) * outer,
    strong: index % 3 === 0,
  };
});

/** "Creative Pod" → "Creative"; the suffix is noise on a 150px card. */
const shortName = (name: string): string => name.replace(/\s*\(?Digital\)?\s*/i, ' ').replace(/\s*Pod$/i, '').trim();

export function HeroDiagram({ className }: { readonly className?: string }) {
  const [pods, setPods] = useState<readonly CapabilityPod[]>([]);

  useEffect(() => {
    let alive = true;

    fetchPods()
      .then((rows) => {
        if (alive) setPods(rows);
      })
      .catch(() => {
        // The diagram still works without the cards; the centre, rings and rays stand alone.
      });

    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className={`hero-diagram relative aspect-square w-full ${className ?? ''}`}>
      {/* ray burst, behind everything */}
      <svg aria-hidden="true" viewBox="0 0 100 100" className="hero-rays absolute inset-0 size-full">
        {RAYS.map((ray) => (
          <line
            key={ray.id}
            x1={ray.x1}
            y1={ray.y1}
            x2={ray.x2}
            y2={ray.y2}
            stroke="var(--bindu-rim-spectrum-mid)"
            strokeWidth={ray.strong ? 0.26 : 0.14}
            strokeOpacity={ray.strong ? 0.7 : 0.34}
            strokeLinecap="round"
          />
        ))}
      </svg>

      {/* two concentric rings */}
      <div aria-hidden="true" className="absolute inset-[19%] rounded-full border border-white/10" />
      <div
        aria-hidden="true"
        className="diagram-ring absolute inset-[31%] rounded-full border border-dashed border-[color:var(--bindu-rim-spectrum-mid)] opacity-50"
        style={{ animationDuration: '120s' }}
      />

      {/* the revolving cards */}
      <div className="diagram-ring absolute inset-0" style={{ animationDuration: `${REVOLUTION_S}s` }}>
        {pods.map((pod, index) => {
          const Icon = ICONS[pod.code] ?? Compass;

          return (
            <div
              key={pod.code}
              style={place(index)}
              className="absolute -translate-x-1/2 -translate-y-1/2"
            >
              <div
                className="diagram-counter"
                style={{ animationDuration: `${REVOLUTION_S}s` }}
              >
                <div className="flex w-[118px] items-center gap-2 rounded-[10px] border border-hairline bg-obsidian-soft/85 px-2.5 py-2 backdrop-blur-sm transition-colors hover:border-[color:var(--bindu-rim-spectrum-mid)] sm:w-[126px]">
                  <span className="grid size-6 shrink-0 place-items-center rounded-[6px] border border-hairline bg-obsidian">
                    <Icon aria-hidden className="size-3 text-ghost-muted" strokeWidth={1.8} />
                  </span>
                  <span className="min-w-0 truncate text-[11px] font-medium tracking-[-0.01em] text-ghost">
                    {shortName(pod.name)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* the hub: fixed, never turns */}
      <div aria-hidden="true" className="hub-core absolute inset-[36%] grid place-items-center rounded-full">
        <span className="font-display text-[clamp(1.4rem,2.6vw,2.1rem)] font-semibold tracking-[-0.02em] text-ghost">
          GC³
        </span>
      </div>
    </div>
  );
}
