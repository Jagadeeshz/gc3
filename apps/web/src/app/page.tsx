import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight, Check } from 'lucide-react';
import { SessionGate } from '@/components/marketing/session-gate';
import { SiteNav } from '@/components/marketing/site-nav';
import { SiteFooter } from '@/components/marketing/site-footer';
import { ScrollProgress } from '@/components/marketing/scroll-progress';
import { RibbonHero } from '@/components/marketing/ribbon-hero';
import { PodRail } from '@/components/marketing/pod-rail';
import { CommandPalette } from '@/components/marketing/command-palette';
import { BookDemoDialog, BookDemoTrigger } from '@/components/marketing/book-demo';
import { StatBand } from '@/components/marketing/stat-band';
import { CapabilityGrid } from '@/components/marketing/capability-grid';
import { HowItWorks } from '@/components/marketing/how-it-works';
import { Comparison } from '@/components/marketing/comparison';
import { GlowCards } from '@/components/marketing/glow-cards';
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

export default function HomePage() {
  return (
    <div className="landing min-h-dvh bg-transparent">
      <SessionGate />
      <ScrollProgress />
      <CommandPalette />
      <BookDemoDialog />
      <SiteNav />

      {/* Six pods, folded into a ribbon that unrolls on scroll. */}
      <RibbonHero />

      {/* The catalogue as a moving rail: the one continuous motion on the page. */}
      <div className="site-sheen overflow-hidden border-b border-hairline bg-obsidian py-4">
        <PodRail />
      </div>

      <StatBand />
      <CapabilityGrid />
      <HowItWorks />
      <Comparison />
      <GlowCards />
      <ResourceCards />
      <CtaBand />

      <SiteFooter />
    </div>
  );
}
