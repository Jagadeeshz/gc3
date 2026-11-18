import Link from 'next/link';
import {
  ArrowUpRight,
  Bot,
  Compass,
  Headset,
  MousePointerClick,
  Palette,
  TrendingUp,
  type LucideIcon,
} from 'lucide-react';

/**
 * The catalogue, as a card grid.
 *
 * Design language: every pod is a surface you could pick up — icon chip, a name,
 * one sentence about the outcome, and the commercial fact underneath. The card is
 * the unit of the whole site, so this grid is the page in miniature.
 */

type Pod = {
  name: string;
  outcome: string;
  composition: string;
  pool: string;
  icon: LucideIcon;
};

const PODS: readonly Pod[] = [
  {
    name: 'Creative',
    outcome: 'Brand systems, campaign visuals and production artwork, made by a standing team.',
    composition: '1 manager · 2 specialists · 2 agents',
    pool: '120 credits a month',
    icon: Palette,
  },
  {
    name: 'Growth',
    outcome: 'Performance campaigns, lifecycle marketing and the analytics behind them.',
    composition: '1 manager · 4 specialists · 4 agents',
    pool: '240 credits a month',
    icon: TrendingUp,
  },
  {
    name: 'Strategy',
    outcome: 'Positioning, roadmaps and commercial models that decide where the work goes.',
    composition: '1 manager · 6 specialists · 6 agents',
    pool: '360 credits a month',
    icon: Compass,
  },
  {
    name: 'Automation',
    outcome: 'Process audits, internal tooling and the workflows that remove the manual step.',
    composition: 'Custom team, scoped per engagement',
    pool: 'Priced per credit',
    icon: Bot,
  },
  {
    name: 'Interactive',
    outcome: 'Product surfaces, prototypes and front-end builds that hold up in production.',
    composition: 'Custom team, scoped per engagement',
    pool: 'Priced per credit',
    icon: MousePointerClick,
  },
  {
    name: 'REMAU',
    outcome: 'Remote assistance unit: continuous capacity for the work that never stops.',
    composition: 'Shared pod · 240h, 280h peak',
    pool: 'Three-month minimum',
    icon: Headset,
  },
];

export function CapabilityGrid({ showHeader = true }: { readonly showHeader?: boolean } = {}) {
  return (
    <section id="pods" className="border-b border-hairline bg-transparent py-20 sm:py-24">
      <div className="shell">
        {showHeader ? (
          <div className="reveal max-w-[62ch]">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-gold-light)]">
              The catalogue
            </p>
            <h2 className="mt-3 font-display text-[clamp(1.9rem,3.4vw,2.9rem)] leading-[1.06] tracking-[-0.025em] text-ghost">
              Six pods. One of them is already the team you needed.
            </h2>
            <p className="mt-4 text-[14px] leading-[1.8] text-ghost-muted">
              Each pod carries a published pool and a fixed composition, so the team is decided before the work
              begins. Pick the capability, not the headcount.
            </p>
          </div>
        ) : null}

        <div className="reveal-stagger mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PODS.map((pod) => {
            const Icon = pod.icon;

            return (
              <article
                key={pod.name}
                className="group flex flex-col justify-between gap-6 rounded-[14px] border border-hairline bg-obsidian-soft p-6 transition-colors duration-200 hover:border-[color:var(--bindu-rim-spectrum-mid)] b-surface"
              >
                <div>
                  <span className="inline-grid size-10 place-items-center rounded-[10px] border border-hairline bg-obsidian text-ghost">
                    <Icon aria-hidden className="size-[18px]" strokeWidth={1.7} />
                  </span>

                  <h3 className="mt-5 font-display text-[20px] leading-tight tracking-[-0.01em] text-ghost">
                    {pod.name}
                  </h3>
                  <p className="mt-2 text-[13px] leading-[1.7] text-ghost-muted">{pod.outcome}</p>
                </div>

                <div>
                  <dl className="grid gap-1 border-t border-hairline pt-4">
                    <div className="flex items-baseline justify-between gap-4">
                      <dt className="font-mono text-[9px] uppercase tracking-[0.14em] text-ghost-muted">
                        Composition
                      </dt>
                      <dd className="text-right text-[11px] text-ghost-muted">{pod.composition}</dd>
                    </div>
                    <div className="flex items-baseline justify-between gap-4">
                      <dt className="font-mono text-[9px] uppercase tracking-[0.14em] text-ghost-muted">
                        Pool
                      </dt>
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
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
