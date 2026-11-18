import Link from 'next/link';

/**
 * The catalogue, as a rail.
 *
 * Self-contained on purpose: the published pods are a fixed commercial fact, so the
 * band carries them as data rather than fetching them. An animated band that
 * disappears when an API is slow is worse than a static one.
 *
 * The loop renders the set twice and travels exactly half the track's width, so the
 * second copy lands where the first began: no seam, no gap. It pauses on hover or
 * keyboard focus so a line can be read, and the reduced-motion fallback wraps the
 * set into a static grid with the duplicate hidden.
 */

const PODS = [
  { code: '01', name: 'Creative', note: 'Brand systems and production artwork' },
  { code: '02', name: 'Growth', note: 'Performance campaigns and lifecycle' },
  { code: '03', name: 'Strategy', note: 'Positioning, roadmaps, commercial models' },
  { code: '04', name: 'Automation', note: 'Process audits and internal tooling' },
  { code: '05', name: 'Interactive', note: 'Product surfaces and front-end builds' },
  { code: '06', name: 'REMAU', note: 'Continuous capacity, shared pod' },
] as const;

const POOL = ['#c9911a', '#8b6410', '#f2d582', '#c9911a', '#c9911a', '#aaff00'] as const;

function Row({ duplicate }: { duplicate?: boolean }) {
  return (
    <ul
      aria-hidden={duplicate ? 'true' : undefined}
      className={duplicate ? 'rail-dup flex shrink-0' : 'flex shrink-0'}
    >
      {PODS.map((pod, index) => (
        <li key={pod.code} className="w-[268px] shrink-0 px-5">
          <Link href="/pricing" className="group block">
            <div className="flex items-baseline gap-2">
              <span
                aria-hidden="true"
                className="mb-[3px] size-1 shrink-0 rounded-full"
                style={{ backgroundColor: POOL[index % POOL.length] }}
              />
              <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-ghost-muted">
                {pod.code}
              </span>
              <span className="text-[13px] font-medium tracking-[-0.01em] text-ghost transition-colors group-hover:text-gold-light">
                {pod.name}
              </span>
            </div>
            <p className="mt-1.5 line-clamp-1 pl-3 text-[11px] leading-snug text-ghost-muted">
              {pod.note}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function PodRail() {
  return (
    <div className="rail rail-host relative overflow-hidden">
      <div className="rail-track flex w-max">
        <Row />
        <Row duplicate />
      </div>
    </div>
  );
}
