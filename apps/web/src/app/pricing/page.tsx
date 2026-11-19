import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpRight, Coins, Layers, Users } from 'lucide-react';
import { SiteNav } from '@/components/marketing/site-nav';
import { BookDemoDialog } from '@/components/marketing/book-demo';
import { PageHero } from '@/components/marketing/page-hero';
import { SiteFooter } from '@/components/marketing/site-footer';
import { PodCatalogue } from '@/components/pricing/pod-catalogue';
import { PlatformBand, PricingFaq } from '@/components/pricing/pricing-sections';
import { QuantocosMark } from '@/components/brand/quantocos-mark';

export const metadata: Metadata = {
  title: 'GC³ — Capability pods, credits and pricing',
  description:
    'Creative, Growth, Strategy, Automation, Interactive and REMAU pods: monthly credit pools, standing teams, and stacking that carries the pods below.',
};

/**
 * Public pricing.
 *
 * Every number on this page is read from `capability_pods` at request time — the
 * page holds no prices of its own. A price change is a seed change, which is the
 * only way a published price and a billed price stay the same number.
 */
export const dynamic = 'force-dynamic';

const RULES = [
  {
    icon: Coins,
    title: 'Credits, not hours',
    body: 'Each pod ships a monthly credit pool. Work draws from the pool; the pod absorbs the scheduling, so you are not buying seats or timesheets.',
  },
  {
    icon: Layers,
    title: 'Pods stack upward',
    body: 'Growth carries the entire Creative catalogue on the same pool. Strategy carries Growth and Creative. You buy the highest pod you need, never the stack.',
  },
  {
    icon: Users,
    title: 'A standing team',
    body: 'Every pod is a named manager, specialists and supervised agents — a team that already knows your account, not a queue of tickets.',
  },
] as const;

export default function PricingPage() {
  return (
    <div className="min-h-dvh bg-transparent">
      <SiteNav />
      <BookDemoDialog />

      <PageHero
        eyebrow="Pricing"
        title="A complete capability. Not another vendor."
        lede="Six pods, each a standing multidisciplinary team on a monthly credit pool. Start at the capability you need; the pods above carry the ones below at no extra credit cost."
        primary="demo"
        secondary={{ label: 'How it works', href: '/how-it-works' }}
        backgroundSrc="/brand/pricing-hero.jpg"
        backgroundMode="photo"
      />

      <main className="mx-auto max-w-[1240px] px-6 py-12">
        <section className="reveal">
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-[12px] border border-hairline bg-hairline sm:grid-cols-4">
            {[
              ['6', 'Capability pods'],
              ['48–120h', 'Delivery commitments'],
              ['1:1', 'Agent per specialist'],
              ['Monthly', 'No annual lock-in'],
            ].map(([value, label]) => (
              <div key={label} className="bg-obsidian-soft px-4 py-3.5">
                <dd className="font-display text-[20px] font-semibold tabular-nums leading-none text-ghost">
                  {value}
                </dd>
                <dt className="mt-1.5 font-mono text-[9px] uppercase tracking-[0.12em] text-ghost-muted">
                  {label}
                </dt>
              </div>
            ))}
          </dl>
        </section>

        <section className="reveal mt-10">
          <PodCatalogue />
        </section>

        <section className="reveal mt-14">
          <PlatformBand />
        </section>

        <section className="reveal mt-14">
          <PricingFaq />
        </section>

        <section className="reveal-stagger mt-12 grid gap-4 border-t border-[rgba(255,255,255,0.10)] pt-10 sm:grid-cols-3">
          {RULES.map((rule) => {
            const Icon = rule.icon;

            return (
              <div key={rule.title} className="rounded-[12px] border border-[rgba(255,255,255,0.10)] bg-[#13121a] b-surface p-4">
                <Icon aria-hidden className="size-4 text-[color:var(--color-gold-light)]" strokeWidth={1.75} />
                <h2 className="mt-2.5 text-[13px] font-semibold text-ghost">{rule.title}</h2>
                <p className="mt-1.5 text-[11px] leading-relaxed text-ghost-muted">{rule.body}</p>
              </div>
            );
          })}
        </section>

        <section className="reveal mt-10 rounded-[12px] border border-[rgba(255,255,255,0.10)] bg-[#13121a] b-surface/60 b-surface px-4 py-3.5">
          <p className="text-[11px] leading-relaxed text-ghost-muted">
            <span className="text-ghost">Custom pods.</span> Automation and Interactive are scoped
            per engagement at a per-credit rate: process audits, RAG chatbots, voice agents, 3D and VR
            work do not fit a fixed monthly shape. Ask for a scoping call and the team is assembled
            around the outcome rather than a template.
          </p>
        </section>

      </main>

      <SiteFooter />
    </div>
  );
}
