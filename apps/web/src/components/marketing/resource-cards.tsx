import Link from 'next/link';
import { ArrowRight, BookOpen, Compass, LayoutDashboard } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/**
 * Reading, in the ServiceNow sense: tagged cards that tell a reader what kind of
 * thing they are about to open. Every card links to something that exists on this
 * site today — no gated PDFs, no report that has not been written.
 */

type Card = {
  tag: string;
  title: string;
  body: string;
  href: string;
  cta: string;
  icon: LucideIcon;
};

const CARDS: readonly Card[] = [
  {
    tag: 'Delivery',
    title: 'What a commitment means',
    body: 'The window a request carries, who owns it, and what happens when it is at risk — measured the same way the console measures it.',
    href: '/why-a-pod',
    cta: 'Read the comparison',
    icon: Compass,
  },
  {
    tag: 'Commercial',
    title: 'How the price is built',
    body: 'The published pool, the composition behind it, and what happens at the boundary of a month.',
    href: '/pricing',
    cta: 'Open pricing',
    icon: BookOpen,
  },
  {
    tag: 'Product',
    title: 'Inside the client portal',
    body: 'The workspace your team signs into: requests, deliverables, invoices and the pod roster, role-scoped.',
    href: '/login',
    cta: 'Enter the portal',
    icon: LayoutDashboard,
  },
];

export function ResourceCards() {
  return (
    <section id="resources" className="border-b border-hairline bg-transparent-soft py-20 sm:py-24">
      <div className="shell">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="reveal max-w-[62ch]">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-emerald-300/90">
              Read next
            </p>
            <h2 className="mt-3 font-display text-[clamp(1.9rem,3.4vw,2.9rem)] leading-[1.06] tracking-[-0.025em] text-ghost">
              Three things worth five minutes.
            </h2>
          </div>
        </div>

        <div className="reveal-stagger mt-10 grid gap-4 lg:grid-cols-3">
          {CARDS.map((card) => {
            const Icon = card.icon;

            return (
              <Link
                key={card.title}
                href={card.href}
                className="group flex flex-col rounded-[14px] border border-hairline bg-obsidian p-6 transition-colors duration-200 hover:border-[color:var(--bindu-rim-spectrum-mid)] b-surface"
              >
                <div className="flex items-center justify-between">
                  <span className="rounded-full border border-hairline px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-ghost-muted">
                    {card.tag}
                  </span>
                  <Icon aria-hidden className="size-4 text-ghost-muted" strokeWidth={1.7} />
                </div>

                <h3 className="mt-5 font-display text-[19px] leading-snug tracking-[-0.01em] text-ghost">
                  {card.title}
                </h3>
                <p className="mt-2 flex-1 text-[12.5px] leading-[1.7] text-ghost-muted">{card.body}</p>

                <span className="mt-5 inline-flex items-center gap-1.5 text-[12px] text-ghost transition-colors group-hover:text-gold-light">
                  {card.cta}
                  <ArrowRight
                    aria-hidden
                    className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5"
                    strokeWidth={1.9}
                  />
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
