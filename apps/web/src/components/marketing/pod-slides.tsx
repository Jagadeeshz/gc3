'use client';

import { useEffect, useState } from 'react';
import type { CapabilityPod } from '@gc3/types';
import { fetchPods } from '@/lib/api-client';

/**
 * The pods, as a rail that travels left to right.
 *
 * No boxes. Each pod is a name, an index and one line about what it covers, sitting directly on
 * the plate — no card border, no fill, no divider, and no container edge: the rail is full-bleed,
 * so it reads as a band of type crossing the page rather than as a component in a slot.
 *
 * The loop: the set is rendered twice and the track travels exactly half its width, so the second
 * copy arrives where the first began and there is no seam and no gap.
 *
 * Motion is the only animation on the page, by request. It pauses on hover or keyboard focus so a
 * line can be read, and stops entirely under prefers-reduced-motion.
 *
 * Copy rules: no figures, and no money language. Two catalogue taglines describe credit-priced
 * pods in money terms, so those are replaced whole rather than edited — trimming words out of the
 * sentence leaves fragments like "Custom team, per".
 */

const POD_COLOURS = ['#00ddaa', '#7b00ff', '#ffdd00', '#0099ff', '#ff8800', '#aaff00'];

const shortName = (name: string): string =>
  name.replace(/\s*\(?Digital\)?\s*/i, ' ').replace(/\s*Pod$/i, '').trim();

const NEUTRAL_TAGLINE = 'Scoped to the work, not to a licence count.';
const MONEY = /(priced|price|pricing|cost|credit|per month)/i;

const safeTagline = (tagline: string): string => {
  const text = tagline.trim();
  if (text === '') return NEUTRAL_TAGLINE;
  return MONEY.test(text) ? NEUTRAL_TAGLINE : text;
};

export function PodMarquee({ className }: { readonly className?: string }) {
  const [pods, setPods] = useState<readonly CapabilityPod[]>([]);

  useEffect(() => {
    let alive = true;

    fetchPods()
      .then((rows) => {
        if (alive) setPods(rows);
      })
      .catch(() => {
        // The band simply renders nothing rather than a broken rail.
      });

    return () => {
      alive = false;
    };
  }, []);

  if (pods.length === 0) return null;

  return (
    <div
      className={`pod-marquee relative overflow-hidden ${className ?? ''}`}
      style={{ marginLeft: 'calc(50% - 50vw)', marginRight: 'calc(50% - 50vw)' }}
    >
      <div className="pod-track flex w-max">
        {[0, 1].map((pass) => (
          <ul key={pass} aria-hidden={pass === 1 ? 'true' : undefined} className="flex shrink-0">
            {pods.map((pod, index) => {
              const colour = POD_COLOURS[index % POD_COLOURS.length] ?? '#00ddaa';

              return (
                <li key={pod.code} className="w-[248px] shrink-0 px-5 sm:w-[286px]">
                  <div className="flex items-baseline gap-2">
                    <span
                      aria-hidden="true"
                      className="mb-[3px] size-1 shrink-0 rounded-full"
                      style={{ background: colour }}
                    />
                    <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-ghost-muted">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <h3 className="text-[13px] font-medium tracking-[-0.01em] text-ghost">
                      {shortName(pod.name)}
                    </h3>
                  </div>
                  <p className="mt-1.5 line-clamp-2 pl-3 text-[11px] leading-snug text-ghost-muted">
                    {safeTagline(pod.tagline ?? '')}
                  </p>
                </li>
              );
            })}
          </ul>
        ))}
      </div>
    </div>
  );
}
