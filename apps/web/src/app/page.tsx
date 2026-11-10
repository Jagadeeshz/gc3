import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowDown, ArrowRight, ArrowUpRight } from 'lucide-react';
import { SessionGate } from '@/components/marketing/session-gate';
import { SiteNav } from '@/components/marketing/site-nav';
import { ScrollProgress } from '@/components/marketing/scroll-progress';
import { BentoGrid } from '@/components/marketing/bento-grid';
import { PodCarousel } from '@/components/marketing/pod-carousel';
import { CommandPalette } from '@/components/marketing/command-palette';
import { BookDemoDialog, BookDemoTrigger } from '@/components/marketing/book-demo';
import { ActProblem } from '@/components/marketing/act-problem';
import { ActParadigm } from '@/components/marketing/act-paradigm';
import { ActPods } from '@/components/marketing/act-pods';
import { PlatformBand, PricingFaq } from '@/components/pricing/pricing-sections';
import { QuantocosMark } from '@/components/brand/quantocos-mark';

import { PodMarquee } from '@/components/marketing/pod-slides';
export const metadata: Metadata = {
  title: 'Quantocos — Explore possibilities',
  description:
    'Your challenges, our solutions. GC³ composes one pod around one outcome and sells it on one subscription: one manager, specialists, and a published credit pool.',
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
    heading: 'Portal',
    links: [
      { label: 'Sign in', href: '/login' },
      { label: 'Client portal', href: '/login' },
      { label: 'Full pricing', href: '/pricing' },
      { label: 'Start a conversation', href: '#contact' },
    ],
  },
] as const;


export default function ScrollytellingHome() {
  return (
    <div className="landing min-h-dvh bg-transparent">
      <SessionGate />
      <ScrollProgress />
      <CommandPalette />
      <BookDemoDialog />
      <SiteNav />

      {/* ---------------------------------------------------------------- hero */}
      <header className="relative overflow-hidden border-b border-hairline bg-obsidian">
        {/* The supplied render, whole, as the hero ground. Screen blending drops its black so the
            artwork sits in the page rather than on it, and the scrims carry the left column's
            contrast — the type never sits on the brightest part of the plate. */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
          <img
            src="/images/gc3-sculpture.webp"
            alt=""
            width={1600}
            height={748}
            loading="eager"
            decoding="async"
            className="absolute inset-0 size-full object-cover object-[62%_42%] opacity-95 mix-blend-screen [transform:translate(2.5%,-4%)_scale(1.06)]"
          />
          <div className="absolute inset-0 [background:linear-gradient(90deg,rgba(8,11,18,0.97)_0%,rgba(8,11,18,0.87)_34%,rgba(8,11,18,0.36)_62%,rgba(8,11,18,0.05)_100%)]" />
          <div className="absolute inset-x-0 bottom-0 h-[46%] bg-gradient-to-t from-obsidian via-obsidian/92 to-transparent" />
          <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-obsidian/90 to-transparent" />
        </div>

        <div className="shell relative flex min-h-[86svh] flex-col justify-center py-16">
          <h1 className="rise mt-5 max-w-[17ch] font-display text-[clamp(2.2rem,5vw,4.3rem)] leading-[1.0] tracking-[-0.03em] text-ghost lg:max-w-[52%]">
            Your Challenges.
            <span className="mt-2 block text-ghost/60">Our Solutions.</span>
          </h1>

          <p className="rise mt-7 max-w-[48ch] text-[15px] leading-[1.8] text-ghost-muted lg:max-w-[46%]">
            One standing team. One monthly credit pool. One outcome. Everything you need to bypass
            traditional procurement and accelerate execution, delivered through a single subscription.
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

          {/* The pods, as a band of type crossing the page. No boxes, no boundaries. */}
          <PodMarquee className="rise mt-10" />

          {/* Proof rail: an infinite ticker travelling left to right. The four facts are rendered
              twice and the track moves exactly half its width, so the second copy arrives where the
              first began and the loop has no seam. The duplicate is aria-hidden — a screen reader
              hears the four facts once. Hover or focus pauses it; reduced motion wraps the tiles
              into a static block instead. */}
          <div
            className="proof-marquee rise relative mt-12 overflow-hidden"
            style={{ marginLeft: 'calc(50% - 50vw)', marginRight: 'calc(50% - 50vw)' }}
          >
            <div className="proof-track flex w-max">
              {[0, 1].map((pass) => (
                <dl key={pass} aria-hidden={pass === 1 ? 'true' : undefined} className="flex shrink-0">
                  {[
                    ['6', 'Capability pods'],
                    ['48–120h', 'Delivery commitments'],
                    ['1:1', 'Agent per specialist'],
                    ['Monthly', 'No annual lock-in'],
                  ].map(([value, label]) => (
                    <div
                      key={label}
                      className="w-[236px] shrink-0 px-6 py-4 sm:w-[300px] lg:w-[340px]"
                    >
                      <dd className="font-display text-[24px] font-semibold tabular-nums leading-none text-ghost">
                        {value}
                      </dd>
                      <dt className="mt-2 font-mono text-[9px] uppercase tracking-[0.12em] text-ghost-muted">
                        {label}
                      </dt>
                    </div>
                  ))}
                </dl>
              ))}
            </div>
          </div>

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
      <section className="border-b border-hairline bg-transparent py-20 sm:py-24">
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
      <section className="ambient ambient--teal border-b border-hairline bg-transparent py-20 sm:py-24">
        <div className="shell relative z-10">
          <PlatformBand />
        </div>
      </section>

      <section className="border-b border-hairline bg-transparent-soft py-20 sm:py-24">
        <div className="shell">
          <PricingFaq />
        </div>
      </section>

      {/* ------------------------------------------------------------- closing */}
      <section id="contact" className="ambient ambient--soma relative overflow-hidden bg-transparent py-20 sm:py-28">
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
      <footer className="border-t border-hairline bg-transparent-soft">
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
          <span className="inline-flex items-center gap-1.5">© 2026 <QuantocosMark size="sm" /> · GC³ is a capability pod platform</span>
          <span>Prices in USD · published, not quoted</span>
        </div>
      </footer>
    </div>
  );
}
