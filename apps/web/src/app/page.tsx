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
import { GlowCards } from '@/components/marketing/glow-cards';
import { ResourceCards } from '@/components/marketing/resource-cards';
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
 * evidence — the numbers, the catalogue, the path to a working pod, the commitments and the
 * resources. The day-one band, the comparison table, the commitment clock and the FAQ were
 * removed at the client's request; their routes still carry the same material.
 */

export default function HomePage() {
  return (
    <div className="landing min-h-dvh bg-transparent">
      <SessionGate />
      <ScrollProgress />
      <CommandPalette />
      <BookDemoDialog />
      <SiteNav />

      {/* Two full-height sections over one stage. */}
      <div className="nova-hero">
        <LandingStage />
        <LandingSections />
      </div>

      <StatBand />
      <CapabilityGrid />
      <HowItWorks />

      <GlowCards />
      <ResourceCards />
      <CtaBand />

      <SiteFooter />
    </div>
  );
}
