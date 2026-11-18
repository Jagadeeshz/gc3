import type { Metadata } from 'next';
import { SiteNav } from '@/components/marketing/site-nav';
import { CommandPalette } from '@/components/marketing/command-palette';
import { BookDemoDialog } from '@/components/marketing/book-demo';
import { PageHero } from '@/components/marketing/page-hero';
import { StatBand } from '@/components/marketing/stat-band';
import { CapabilityGrid } from '@/components/marketing/capability-grid';
import { GlowCards } from '@/components/marketing/glow-cards';
import { CtaBand } from '@/components/marketing/cta-band';
import { SiteFooter } from '@/components/marketing/site-footer';

export const metadata: Metadata = {
  title: 'Pods — Quantocos',
  description:
    'Six capability pods: Creative, Growth, Strategy, Automation, Interactive and REMAU. Each is a standing team with a published credit pool and a fixed composition.',
};

export default function PodsPage() {
  return (
    <div className="min-h-dvh bg-transparent">
      <CommandPalette />
      <BookDemoDialog />
      <SiteNav />

      <PageHero
        eyebrow="The catalogue"
        title="Six pods. One of them is already the team you needed."
        lede="A pod is a standing team assembled around one outcome, with one accountable manager and a fixed specialist roster. Each carries a published credit pool, so the team and the price are decided before the first request rather than negotiated around it."
        primary={{ label: 'See published pricing', href: '/pricing' }}
        secondary={{ label: 'How it works', href: '/how-it-works' }}
        backgroundSrc="/brand/pods-hall-clean.jpg"
      />

      <StatBand />
      <CapabilityGrid showHeader={false} />
      <GlowCards />
      <CtaBand />
      <SiteFooter />
    </div>
  );
}
