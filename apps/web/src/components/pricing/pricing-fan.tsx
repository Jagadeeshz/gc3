import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { PODS } from '@/lib/pods';

/**
 * The price fan.
 *
 * The motion from the reference — cards held in perspective as a stack that fans
 * open — rebuilt with our own content. The reference itself could not be used: it
 * is a screen capture of another agency's site, with other agencies' work inside
 * it, and nothing about it is ours to publish.
 *
 * The fan opens on scroll rather than on a timer, so it is already open when a
 * reader arrives at it and does not animate past someone who scrolls quickly. Only
 * transform and opacity move, and reduced motion renders the fan already open.
 */

const PRICES: Record<string, string> = {
  Creative: '$3,000',
  Growth: '$6,000',
  Strategy: '$9,000',
  Automation: '$25',
  Interactive: '$25',
  REMAU: '$8,000',
};

const UNITS: Record<string, string> = {
  Creative: '/mo',
  Growth: '/mo',
  Strategy: '/mo',
  Automation: '/credit',
  Interactive: '/credit',
  REMAU: '/mo',
};

export function PricingFan() {
  return (
    <section className="fan-band border-b border-hairline py-20 sm:py-24">
      <div className="shell grid items-center gap-14 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-8">
        <div className="reveal max-w-[46ch]">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-gold-light)]">
            The whole catalogue, one glance
          </p>
          <h2 className="mt-3 font-display text-[clamp(1.9rem,3.2vw,2.7rem)] leading-[1.06] tracking-[-0.025em] text-ghost">
            Six pods. Six prices. Nothing behind a call.
          </h2>
          <p className="mt-4 text-[14px] leading-[1.8] text-ghost-muted">
            Every pod on this page is a standing team on a published credit pool. The number you read here
            is the number on the order form — the catalogue is read from the same record at request time.
          </p>
          <Link
            href="#rates"
            className="mt-7 inline-flex items-center gap-2 rounded-full btn-gold px-5 py-2.5 text-[13px] font-semibold"
          >
            See the rate table
            <ArrowUpRight aria-hidden className="size-3.5" strokeWidth={2} />
          </Link>
        </div>

        <div className="fan" aria-label="The six capability pods and their published prices">
          {PODS.map((pod, i) => (
            <article
              key={pod.name}
              className="fan-card"
              style={{ '--i': i } as React.CSSProperties}
              aria-hidden="true"
            >
              <div className="fan-card__top">
                <span className="fan-card__name">{pod.name}</span>
                <span className="fan-card__index">{String(i + 1).padStart(2, '0')}</span>
              </div>

              <p className="fan-card__price">
                {PRICES[pod.name] ?? '—'}
                <span>{UNITS[pod.name] ?? ''}</span>
              </p>

              <p className="fan-card__meta">{pod.pool} · {pod.composition}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
