import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight, Check } from 'lucide-react';
import { SessionGate } from '@/components/marketing/session-gate';
import { SiteNav } from '@/components/marketing/site-nav';
import { SiteFooter } from '@/components/marketing/site-footer';
import { ScrollProgress } from '@/components/marketing/scroll-progress';
import { PodRail } from '@/components/marketing/pod-rail';
import { CommandPalette } from '@/components/marketing/command-palette';
import { BookDemoDialog, BookDemoTrigger } from '@/components/marketing/book-demo';
import { StatBand } from '@/components/marketing/stat-band';
import { CapabilityGrid } from '@/components/marketing/capability-grid';
import { HowItWorks } from '@/components/marketing/how-it-works';
import { Comparison } from '@/components/marketing/comparison';
import { ResourceCards } from '@/components/marketing/resource-cards';
import { CtaBand } from '@/components/marketing/cta-band';

export const metadata: Metadata = {
  title: 'Quantocos — Explore possibilities',
  description:
    'Your challenges, our solutions. GC³ composes one pod around one outcome and sells it on one subscription: one manager, specialists, and a published credit pool.',
};

/**
 * The public landing page.
 *
 * Composition follows the enterprise pattern: a proposition, the numbers that
 * support it, the catalogue as cards, the path to start, and a comparison for the
 * reader who is still deciding. Every band is a static section — no scroll-linked
 * choreography, no canvas layer, no moving marquee — so the page reads the same in
 * a screenshot, a print, a low-power laptop and a screen reader.
 */

const HERO_FACTS = [
  'One manager, accountable from day one',
  'A published credit pool, not a rate card',
  'Up to three clients per pod, never more',
] as const;

const POD_PANEL_ROWS = [
  ['Manager', '1, accountable'],
  ['Specialists', '4'],
  ['Agents', '4, paired 1:1'],
  ['Credit pool', '240 a month'],
  ['Clients on this pod', 'up to 3'],
  ['Delivery commitment', '48–120h by priority'],
] as const;

export default function HomePage() {
  return (
    <div className="landing min-h-dvh bg-transparent">
      <SessionGate />
      <ScrollProgress />
      <CommandPalette />
      <BookDemoDialog />
      <SiteNav />

      {/* ------------------------------------------------------------- hero */}
      <header className="relative overflow-hidden border-b border-hairline bg-obsidian">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0">
          <img
            src="/images/gc3-sculpture.webp"
            alt=""
            width={1600}
            height={748}
            loading="eager"
            decoding="async"
            className="absolute inset-0 size-full object-cover object-[68%_45%] opacity-70 mix-blend-screen"
          />
          <div className="absolute inset-0 [background:linear-gradient(90deg,rgba(8,11,18,0.98)_0%,rgba(8,11,18,0.92)_42%,rgba(8,11,18,0.55)_70%,rgba(8,11,18,0.25)_100%)]" />
          <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-obsidian to-transparent" />
          {/* Ambient field: one slow drift, no spin, decoration only. */}
          <div className="site-ambient absolute -left-[10%] top-[-25%] size-[62vw] rounded-full opacity-60 blur-[90px] [background:radial-gradient(circle_at_center,rgba(0,221,170,0.16),rgba(161,92,255,0.10)_45%,transparent_70%)]" />
          <div className="site-ambient absolute -right-[8%] bottom-[-30%] size-[52vw] rounded-full opacity-50 blur-[110px] [animation-delay:-9s] [background:radial-gradient(circle_at_center,rgba(242,213,130,0.14),rgba(0,221,170,0.08)_50%,transparent_72%)]" />
        </div>

        <div className="shell relative grid gap-12 py-16 sm:py-20 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-center lg:gap-16">
          <div className="min-w-0">
            <span className="site-enter site-enter-1 inline-flex items-center gap-2 rounded-full border border-hairline bg-obsidian-soft/80 px-3 py-1.5 font-mono text-[9px] uppercase tracking-[0.16em] text-ghost-muted">
              <span className="size-1.5 rounded-full bg-emerald-400/80" aria-hidden="true" />
              Quantocos · capability pods
            </span>

            <h1 className="site-enter site-enter-2 mt-6 font-display text-[clamp(2.3rem,5vw,4rem)] leading-[1.02] tracking-[-0.03em] text-ghost">
              Your challenges.
              <span className="mt-1.5 block text-ghost/55">Our solutions.</span>
            </h1>

            <p className="site-enter site-enter-3 mt-6 max-w-[52ch] text-[15px] leading-[1.8] text-ghost-muted">
              GC³ composes one standing team around one outcome and sells it on one subscription. A named
              manager, a defined specialist roster and a published credit pool — no procurement cycle, no
              seat arithmetic, no vendor layers.
            </p>

            <ul className="site-enter site-enter-4 mt-7 grid gap-2">
              {HERO_FACTS.map((fact) => (
                <li key={fact} className="flex items-start gap-2.5 text-[13px] text-ghost">
                  <Check aria-hidden className="mt-0.5 size-4 shrink-0 text-emerald-300" strokeWidth={2.2} />
                  {fact}
                </li>
              ))}
            </ul>

            <div className="site-enter site-enter-5 mt-9 flex flex-wrap items-center gap-3">
              <BookDemoTrigger label="Book a demo" />
              <Link
                href="/pricing"
                className="inline-flex items-center gap-2 rounded-full border border-ghost/25 px-5 py-2.5 text-[13px] font-medium text-ghost transition-colors hover:border-ghost/55"
              >
                See published pricing
                <ArrowUpRight aria-hidden className="size-3.5" strokeWidth={1.9} />
              </Link>
            </div>
          </div>

          {/* The pod as a card: what the subscription actually contains. */}
          <div className="site-enter site-enter-4 min-w-0 lg:w-full lg:max-w-[420px] lg:justify-self-end">
            <div className="rounded-[16px] border border-hairline bg-obsidian-soft/90 p-6 backdrop-blur-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-ghost-muted">
                    A pod, in full
                  </p>
                  <p className="mt-2 font-display text-[22px] leading-tight tracking-[-0.01em] text-ghost">
                    Growth Pod
                  </p>
                </div>
                <span className="rounded-full border border-hairline px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-emerald-300">
                  Standing
                </span>
              </div>

              <dl className="mt-5 grid gap-3">
                {POD_PANEL_ROWS.map(([term, value]) => (
                  <div
                    key={term}
                    className="flex items-baseline justify-between gap-4 border-b border-hairline/70 pb-2.5 last:border-0 last:pb-0"
                  >
                    <dt className="font-mono text-[9px] uppercase tracking-[0.14em] text-ghost-muted">
                      {term}
                    </dt>
                    <dd className="text-right text-[12px] text-ghost">{value}</dd>
                  </div>
                ))}
              </dl>

              <Link
                href="/pricing"
                className="mt-5 inline-flex items-center gap-1.5 text-[12px] text-ghost transition-colors hover:text-gold-light"
              >
                Compare the six pods
                <ArrowRight aria-hidden className="size-3.5" strokeWidth={1.9} />
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* The catalogue as a moving rail: the one continuous motion on the page. */}
      <div className="site-sheen overflow-hidden border-b border-hairline bg-obsidian py-4">
        <PodRail />
      </div>

      <StatBand />
      <CapabilityGrid />
      <HowItWorks />
      <Comparison />
      <ResourceCards />
      <CtaBand />

      <SiteFooter />
    </div>
  );
}
