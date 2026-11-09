import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowDown, ArrowRight, ArrowUpRight } from 'lucide-react';
import { SessionGate } from '@/components/marketing/session-gate';
import { SiteNav } from '@/components/marketing/site-nav';
import { ScrollProgress } from '@/components/marketing/scroll-progress';
import { HeroAurora } from '@/components/marketing/hero-aurora';
import { BentoGrid } from '@/components/marketing/bento-grid';
import { PodCarousel } from '@/components/marketing/pod-carousel';
import { CommandPalette } from '@/components/marketing/command-palette';
import { BookDemoDialog, BookDemoTrigger } from '@/components/marketing/book-demo';
import { ActProblem } from '@/components/marketing/act-problem';
import { ActParadigm } from '@/components/marketing/act-paradigm';
import { ActPods } from '@/components/marketing/act-pods';
import { PlatformBand, PricingFaq } from '@/components/pricing/pricing-sections';
import { QuantocosMark } from '@/components/brand/quantocos-mark';

export const metadata: Metadata = {
  title: 'GC³ — Global Capability Center 3.0',
  description:
    'Enterprise AI does not fail on models; it fails on operations. GC³ composes one pod around one outcome and sells it on one subscription: one manager, specialists, and a published credit pool.',
};

/**
 * The landing page, as a four-act story.
 *
 * Structure, and why:
 *  - Each act is a two-column grid with a `sticky` visual and a scrolling
 *    narrative. That is scrollytelling without scroll listeners: the browser's
 *    own sticky positioning does the choreography, so there is nothing to
 *    hydrate and nothing to break.
 *  - Motion comes from `animation-timeline: view()` utilities in globals.css.
 *    Content is visible if the CSS never applies, which is the only acceptable
 *    failure mode for a page whose entire job is to be read.
 *  - The only stateful client components are the reading-progress bar and the pod
 *    act, which fetches the live catalogue. The rest is server-rendered HTML.
 *
 *  - There is no fourth act. The internal platform agents are not part of the
 *    public argument and are not named on this page.
 */

const FOOTER_NAV = [
  {
    heading: 'Pods & pricing',
    links: [
      { label: 'Creative Pod — $3,000/mo', href: '/pricing' },
      { label: 'Growth Pod — $6,000/mo', href: '/pricing' },
      { label: 'Strategy Pod — $9,000/mo', href: '/pricing' },
      { label: 'Automation Pod — $25/credit', href: '/pricing' },
      { label: 'Interactive Pod — $25/credit', href: '/pricing' },
      { label: 'REMAU Pod — $8,000/mo', href: '/pricing' },
    ],
  },
  {
    heading: 'The story',
    links: [
      { label: 'The bottleneck', href: '#act-problem' },
      { label: 'The paradigm shift', href: '#act-paradigm' },
      { label: 'Capability pods', href: '#act-pods' },
    ],
  },
  {
    heading: 'Portal',
    links: [
      { label: 'Sign in', href: '/login' },
      { label: 'Client portal', href: '/login' },
      { label: 'Full pricing', href: '/pricing' },
      { label: 'Start a conversation', href: '#contact' },
    ],
  },
] as const;

const ACTS = [
  { id: 'act-problem', label: 'I', title: 'The bottleneck' },
  { id: 'act-paradigm', label: 'II', title: 'The paradigm shift' },
  { id: 'act-pods', label: 'III', title: 'Capability pods' },
] as const;


export default function ScrollytellingHome() {
  return (
    <div className="min-h-dvh bg-obsidian">
      <SessionGate />
      <ScrollProgress />
      <CommandPalette />
      <BookDemoDialog />
      <SiteNav />

      {/* ---------------------------------------------------------------- hero */}
      <header className="relative overflow-hidden border-b border-hairline bg-obsidian">
        {/*
         * The hero canvas: the GC³ hub render, cropped to remove its icon rail, at
         * 55% over obsidian. Four overlays do the blending — a radial core, top and
         * bottom fades, and side scrims — so the artwork dissolves into #090D16 at
         * every edge instead of ending on a hard rectangle. The image itself carries
         * no text, so nothing in it competes with the headline for contrast.
         *
         * blur(2px) + scale(1.04): the blur softens the render's fine detail so type
         * stays dominant, and the scale hides the transparent fringe blur leaves at
         * the edges. Both are compositor-only properties.
         */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">

          {/* Architectural staging: a 4.5% grid, then a soft core behind the headline.
              Order matters — the grid sits under the vignette so the centre of the type block
              stays clean. */}
          <div className="arch-grid absolute inset-0" />
          <div className="arch-vignette absolute inset-0" />
          <div className="absolute inset-0 [background:radial-gradient(78%_64%_at_50%_42%,transparent_0%,var(--color-obsidian)_76%)]" />
          <div className="absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-obsidian via-obsidian/70 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-obsidian via-obsidian/85 to-transparent" />
          <div className="absolute inset-y-0 left-0 w-[46%] bg-gradient-to-r from-obsidian via-obsidian/55 to-transparent" />
          <div className="absolute inset-y-0 right-0 w-[26%] bg-gradient-to-l from-obsidian/85 to-transparent" />
        </div>

        {/* Generated from the catalogue: our six pods orbiting the core. */}
        <HeroAurora />

        <div className="shell relative flex min-h-[86svh] flex-col justify-center py-16">
          <p className="rise font-mono text-[10px] uppercase tracking-[0.2em] text-emerald-300/90">
            GC³ — Global Capability Center 3.0
          </p>

          <h1 className="rise mt-5 max-w-[17ch] font-display text-[clamp(2.2rem,5vw,4.3rem)] leading-[1.0] tracking-[-0.03em] text-ghost lg:max-w-[52%]">
            Enterprise AI does not fail on models.
            <span className="mt-2 block text-ghost/60">It fails on operations.</span>
          </h1>

          <p className="rise mt-7 max-w-[48ch] text-[15px] leading-[1.8] text-ghost-muted lg:max-w-[46%]">
            GC³ composes one pod around one outcome and sells it on one subscription — a standing
            team, a monthly credit pool, and none of the procurement that used to sit between you and
            the work. This page is the argument, in three acts.
          </p>

          <div className="rise mt-9 flex flex-wrap items-center gap-3">
            <Link
              href="#act-problem"
              className="inline-flex items-center gap-2 rounded-lg border border-hairline px-4 py-2.5 text-[13px] text-ghost-muted transition-colors hover:border-[color:var(--bindu-rim-spectrum-mid)] hover:text-ghost"
            >
              Begin the story
              <ArrowDown aria-hidden className="size-3.5" strokeWidth={1.9} />
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 rounded-lg border border-hairline px-4 py-2.5 text-[13px] text-ghost transition-colors hover:border-emerald-400/30 hover:text-emerald-200"
            >
              See the pods
              <ArrowUpRight aria-hidden className="size-3.5" strokeWidth={1.9} />
            </Link>
          </div>

          <dl className="rise mt-12 grid grid-cols-2 gap-px overflow-hidden rounded-[12px] border border-hairline bg-hairline sm:grid-cols-4">
            {[
              ['6', 'Capability pods'],
              ['48–120h', 'Delivery commitments'],
              ['1:1', 'Agent per specialist'],
              ['Monthly', 'No annual lock-in'],
            ].map(([value, label]) => (
              <div key={label} className="bg-obsidian-soft px-4 py-3.5">
                <dd className="font-display text-[22px] font-semibold tabular-nums leading-none text-ghost">
                  {value}
                </dd>
                <dt className="mt-1.5 font-mono text-[9px] uppercase tracking-[0.12em] text-ghost-muted">
                  {label}
                </dt>
              </div>
            ))}
          </dl>

          <nav aria-label="Acts" className="rise mt-12 flex flex-wrap gap-x-6 gap-y-2">
            {ACTS.map((act) => (
              <Link
                key={act.id}
                href={`#${act.id}`}
                className="group inline-flex items-baseline gap-2 text-[11px] text-ghost-muted transition-colors hover:text-ghost"
              >
                <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-emerald-300/70">
                  {act.label}
                </span>
                {act.title}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      {/* ------------------------------------------------------------ the acts */}
      <div className="spectrum-rule" aria-hidden="true" />

      <ActProblem />
      <div className="spectrum-rule" aria-hidden="true" />

      <ActParadigm />
      <div className="spectrum-rule" aria-hidden="true" />

      <ActPods />

      {/* ------------------------------------------------------------ carousel */}
      <section className="border-b border-hairline bg-obsidian py-20 sm:py-24">
        <div className="shell grid min-w-0 gap-8 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] lg:gap-14">
          <div className="min-w-0 lg:pt-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-emerald-300/90">
              One at a time
            </p>
            <h2 className="mt-3 font-display text-[clamp(1.6rem,2.8vw,2.2rem)] leading-[1.1] tracking-[-0.02em] text-ghost">
              The same six pods, read as a deck.
            </h2>
            <p className="mt-4 max-w-[42ch] text-[13px] leading-relaxed text-ghost-muted">
              Advance with the arrows, the dots, or let it turn on its own — it pauses the moment
              you hover or focus inside it.
            </p>
          </div>

          <PodCarousel />
        </div>
      </section>

      <div className="spectrum-rule" aria-hidden="true" />

      <BentoGrid />

      {/* -------------------------------------------------- the software + FAQ */}
      <section className="ambient ambient--teal border-b border-hairline bg-obsidian py-20 sm:py-24">
        <div className="shell relative z-10">
          <PlatformBand />
        </div>
      </section>

      <section className="border-b border-hairline bg-obsidian-soft py-20 sm:py-24">
        <div className="shell">
          <PricingFaq />
        </div>
      </section>

      {/* ------------------------------------------------------------- closing */}
      <section id="contact" className="ambient ambient--soma relative overflow-hidden bg-obsidian py-20 sm:py-28">
        <div aria-hidden="true" className="blueprint pointer-events-none absolute inset-0 opacity-[0.18]" />
        <div className="shell relative grid gap-8">
          <div className="max-w-[58ch]">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-emerald-300/90">
              The close
            </p>
            <h2 className="mt-4 font-display text-[clamp(1.9rem,3.6vw,3rem)] leading-[1.04] tracking-[-0.025em] text-ghost">
              One pod. One subscription. Zero operational overhead.
            </h2>
            <p className="mt-5 text-[14px] leading-[1.8] text-ghost-muted">
              Start from the capability you need. The pod arrives composed, the credit pool is
              published, and the team is already standing.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <BookDemoTrigger label="Book a demo" />
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 rounded-lg border border-hairline px-4 py-2.5 text-[13px] text-ghost transition-colors hover:border-emerald-400/30 hover:text-emerald-200"
            >
              Full pricing
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-[13px] text-ghost-muted transition-colors hover:text-ghost"
            >
              Client portal
              <ArrowUpRight aria-hidden className="size-3.5" strokeWidth={1.9} />
            </Link>
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------------- footer */}
      <footer className="border-t border-hairline bg-obsidian-soft">
        <div className="shell grid gap-10 py-12 sm:grid-cols-3">
          {FOOTER_NAV.map((column) => (
            <div key={column.heading}>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ghost-muted">
                {column.heading}
              </p>
              <ul className="mt-3 grid gap-1.5">
                {column.links.map((link) => (
                  <li key={`${column.heading}-${link.label}`}>
                    <Link
                      href={link.href}
                      className="text-[12px] text-ghost-muted transition-colors hover:text-ghost"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="shell flex flex-wrap items-center justify-between gap-3 border-t border-hairline py-5 font-mono text-[9px] uppercase tracking-[0.14em] text-ghost-muted">
          <span className="inline-flex items-center gap-1.5">© 2026 <QuantocosMark size="sm" /> · GC³ is a Global Capability Center</span>
          <span>Prices in USD · published, not quoted</span>
        </div>
      </footer>
    </div>
  );
}
