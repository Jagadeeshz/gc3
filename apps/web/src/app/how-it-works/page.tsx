import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpRight, Check } from 'lucide-react';
import { SiteNav } from '@/components/marketing/site-nav';
import { CommandPalette } from '@/components/marketing/command-palette';
import { BookDemoDialog } from '@/components/marketing/book-demo';
import { PageHero } from '@/components/marketing/page-hero';
import { HowItWorks } from '@/components/marketing/how-it-works';
import { CtaBand } from '@/components/marketing/cta-band';
import { SiteFooter } from '@/components/marketing/site-footer';

export const metadata: Metadata = {
  title: 'How it works — Quantocos',
  description:
    'From a scoping conversation to work already in the queue: how a GC³ pod is composed, who owns it, and what the client sees on day one.',
};

const DAY_ONE = [
  {
    title: 'A workspace that is already populated',
    body: 'The subscription, the pod roster and the request queue exist before you sign in. Nothing is configured per client.',
  },
  {
    title: 'One manager with the account',
    body: 'The manager who scoped the pod runs it. Escalation is a name, not a mailbox.',
  },
  {
    title: 'Commitments attached to work',
    body: 'Every request carries its window — urgent 8 hours through low 168 hours — and shows when it is at risk before it breaches.',
  },
  {
    title: 'Records you can hand to finance',
    body: 'Invoices, deliverables and approvals are per tenant, dated, and attributable to the person who acted.',
  },
] as const;

export default function HowItWorksPage() {
  return (
    <div className="min-h-dvh bg-transparent">
      <CommandPalette />
      <BookDemoDialog />
      <SiteNav />

      <PageHero
        eyebrow="How it works"
        title="Four steps between this page and a working pod."
        lede="No procurement cycle and no statement of work for each piece of work. The pod is composed once against the outcome, and the work moves through it as requests rather than as projects."
        primary="demo"
        secondary={{ label: 'See the pods', href: '/pods' }}
      />

      <HowItWorks showHeader={false} />

      <section className="border-b border-hairline bg-transparent py-20 sm:py-24">
        <div className="shell grid gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16">
          <div className="reveal">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[color:var(--color-gold-light)]">
              What you have on day one
            </p>
            <h2 className="mt-3 font-display text-[clamp(1.9rem,3.4vw,2.9rem)] leading-[1.06] tracking-[-0.025em] text-ghost">
              The pod starts standing, not ramping.
            </h2>
            <p className="mt-4 max-w-[46ch] text-[14px] leading-[1.8] text-ghost-muted">
              The difference between a pod and a new supplier is what exists before the first request. These
              four things are already in place when access is handed over.
            </p>
            <Link
              href="/why-a-pod"
              className="mt-6 inline-flex items-center gap-1.5 text-[12.5px] text-ghost transition-colors hover:text-gold-light"
            >
              Why a pod rather than an agency
              <ArrowUpRight aria-hidden className="size-3.5" strokeWidth={1.9} />
            </Link>
          </div>

          <ul className="reveal-stagger grid gap-3 sm:grid-cols-2">
            {DAY_ONE.map((item) => (
              <li key={item.title} className="rounded-[14px] border border-hairline bg-obsidian-soft p-5">
                <Check aria-hidden className="size-4 text-emerald-300" strokeWidth={2.2} />
                <h3 className="mt-3 font-display text-[16px] leading-snug text-ghost">{item.title}</h3>
                <p className="mt-2 text-[12px] leading-[1.7] text-ghost-muted">{item.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <CtaBand />
      <SiteFooter />
    </div>
  );
}
