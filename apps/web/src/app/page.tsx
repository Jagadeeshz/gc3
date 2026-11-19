import type { Metadata } from 'next';
import { SessionGate } from '@/components/marketing/session-gate';
import { SiteNav } from '@/components/marketing/site-nav';
import { SiteFooter } from '@/components/marketing/site-footer';
import { ScrollProgress } from '@/components/marketing/scroll-progress';
import { LandingStage } from '@/components/marketing/landing-stage';
import { LandingSections } from '@/components/marketing/landing-sections';
import { CommandPalette } from '@/components/marketing/command-palette';
import { BookDemoDialog } from '@/components/marketing/book-demo';
import { StatBand } from '@/components/marketing/stat-band';
import { CapabilityGrid } from '@/components/marketing/capability-grid';
import { HowItWorks } from '@/components/marketing/how-it-works';
import { Comparison } from '@/components/marketing/comparison';
import { GlowCards } from '@/components/marketing/glow-cards';
import { ResourceCards } from '@/components/marketing/resource-cards';
import { CommitmentBand, DayOneGrid, FaqBand } from '@/components/marketing/landing-below';
import { CtaBand } from '@/components/marketing/cta-band';

export const metadata: Metadata = {
  title: 'Quantocos — Explore possibilities',
  description:
    'One standing pod around one outcome, on a published credit pool. A named manager, a fixed specialist roster and a delivery commitment on every request.',
};

/**
 * The public landing page.
 *
 * The stage carries the proposition in three screens; everything under it carries the
 * evidence — the numbers, the catalogue, the path to a working pod, what exists on day one,
 * how a pod compares to a team or an agency, the commitment windows, and the questions a
 * buyer asks on the first call. A page that stops at the stage is a poster: it shows what we
 * claim and gives the reader nothing to decide with.
 */

export default function HomePage() {
  return (
    <div className="landing min-h-dvh bg-transparent">
      <SessionGate />
      <ScrollProgress />
      <CommandPalette />
      <BookDemoDialog />
      <SiteNav />

      {/* Three full-height sections over one stage. */}
      <div className="nova-hero">
        <LandingStage />
        <LandingSections />
      </div>

      <StatBand />
      <CapabilityGrid />
      <HowItWorks />

      {/* What exists before the first request — the same stack the how-it-works route uses. */}
      <section className="border-b border-hairline py-20 sm:py-24" aria-label="What you have on day one">
        <div className="shell grid gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ghost-muted">
              What you have on day one
            </p>
            <h2 className="mt-3 font-display text-[clamp(1.9rem,3.4vw,2.9rem)] leading-[1.06] tracking-[-0.025em] text-ghost">
              The pod starts standing, not ramping.
            </h2>
            <p className="mt-4 max-w-[46ch] text-[14px] leading-[1.8] text-ghost-muted">
              The difference between a pod and a new supplier is what already exists before the first
              request. These four things are in place when access is handed over.
            </p>
          </div>
          <DayOneGrid />
        </div>
      </section>

      <Comparison />
      <CommitmentBand />
      <GlowCards />
      <ResourceCards />
      <FaqBand />
      <CtaBand />

      <SiteFooter />
    </div>
  );
}
