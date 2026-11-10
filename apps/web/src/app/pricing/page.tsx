import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpRight, Coins, Layers, Users } from 'lucide-react';
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
      <header className="border-b border-[#1E293B]">
        <div className="mx-auto flex max-w-[1240px] items-center justify-between px-6 py-5">
          <Link href="/" className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-[10px] border border-gold/35 bg-gold/10 font-display text-base font-semibold text-gold-light">
              G
            </span>
            <span className="leading-tight">
              <span className="block text-sm font-semibold text-slate-100">GC³ Portal</span>
              <span className="block font-mono text-[9px] uppercase tracking-[0.16em] text-slate-500">
                Global Cloud Capability &amp; Consulting
              </span>
            </span>
          </Link>

          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/35 bg-emerald-400/10 px-3 py-1.5 text-[12px] font-medium text-emerald-200 transition-colors hover:bg-emerald-400/20"
          >
            Sign in
            <ArrowUpRight aria-hidden className="size-3.5" strokeWidth={1.75} />
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-[1240px] px-6 py-12">
        <section className="max-w-[62ch]">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">
            Capability pods
          </p>
          <h1 className="mt-3 font-display text-4xl leading-[1.05] tracking-[-0.02em] text-slate-100 sm:text-5xl">
            A complete capability. Not another vendor.
          </h1>
          <p className="mt-5 text-sm leading-relaxed text-slate-400">
            Six pods, each a standing multidisciplinary team on a monthly credit pool. Start at the
            capability you need; the pods above carry the ones below at no extra credit cost.
          </p>

          <dl className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-[12px] border border-[#1E293B] bg-[#1E293B] sm:grid-cols-4">
            {[
              ['6', 'Capability pods'],
              ['48–120h', 'Delivery commitments'],
              ['1:1', 'Agent per specialist'],
              ['Monthly', 'No annual lock-in'],
            ].map(([value, label]) => (
              <div key={label} className="bg-[#0B1220] px-4 py-3.5">
                <dd className="font-display text-[20px] font-semibold tabular-nums leading-none text-slate-100">
                  {value}
                </dd>
                <dt className="mt-1.5 font-mono text-[9px] uppercase tracking-[0.12em] text-slate-500">
                  {label}
                </dt>
              </div>
            ))}
          </dl>
        </section>

        <section className="mt-10">
          <PodCatalogue />
        </section>

        <section className="mt-14">
          <PlatformBand />
        </section>

        <section className="mt-14">
          <PricingFaq />
        </section>

        <section className="mt-12 grid gap-4 border-t border-[#1E293B] pt-10 sm:grid-cols-3">
          {RULES.map((rule) => {
            const Icon = rule.icon;

            return (
              <div key={rule.title} className="rounded-[12px] border border-[#1E293B] bg-[#0B1220] p-4">
                <Icon aria-hidden className="size-4 text-emerald-300" strokeWidth={1.75} />
                <h2 className="mt-2.5 text-[13px] font-semibold text-slate-100">{rule.title}</h2>
                <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">{rule.body}</p>
              </div>
            );
          })}
        </section>

        <section className="mt-10 rounded-[12px] border border-[#1E293B] bg-[#0B1220]/60 px-4 py-3.5">
          <p className="text-[11px] leading-relaxed text-slate-400">
            <span className="text-slate-200">Custom pods.</span> Automation and Interactive are scoped
            per engagement at a per-credit rate: process audits, RAG chatbots, voice agents, 3D and VR
            work do not fit a fixed monthly shape. Ask for a scoping call and the team is assembled
            around the outcome rather than a template.
          </p>
        </section>

        <footer className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-[#1E293B] pt-6 font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500">
          <span>Prices in USD · per pod · per month unless stated</span>
          <span className="inline-flex items-center gap-1.5">GC³ — <QuantocosMark size="sm" /></span>
        </footer>
      </main>
    </div>
  );
}
