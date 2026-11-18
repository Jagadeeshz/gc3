import type { Metadata } from 'next';
import { SiteNav } from '@/components/marketing/site-nav';
import { CommandPalette } from '@/components/marketing/command-palette';
import { BookDemoDialog } from '@/components/marketing/book-demo';
import { PageHero } from '@/components/marketing/page-hero';
import { Comparison } from '@/components/marketing/comparison';
import { ResourceCards } from '@/components/marketing/resource-cards';
import { CtaBand } from '@/components/marketing/cta-band';
import { SiteFooter } from '@/components/marketing/site-footer';

export const metadata: Metadata = {
  title: 'Why a pod — Quantocos',
  description:
    'An in-house team, a traditional agency and a GC³ capability pod compared across time to start, cost model, continuity, commercial records and how each scales.',
};

export default function WhyAPodPage() {
  return (
    <div className="min-h-dvh bg-transparent">
      <CommandPalette />
      <BookDemoDialog />
      <SiteNav />

      <PageHero
        eyebrow="Why a pod"
        title="The same outcome, three ways of buying it."
        lede="Most teams do not lose time to the work itself. They lose it to assembling the team, agreeing a scope for each piece, and reconciling the invoices afterwards. A pod is a different way of buying the same outcome — and it is worth comparing honestly against the two alternatives."
        primary="demo"
        secondary={{ label: 'See published pricing', href: '/pricing' }}
        backgroundSrc="/brand/why-a-pod-fork.webp"
        backgroundMode="art"
      />

      <Comparison />
      <ResourceCards />
      <CtaBand />
      <SiteFooter />
    </div>
  );
}
