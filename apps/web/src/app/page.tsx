import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowUpRight, Check, Minus } from 'lucide-react';
import { SiteNav } from '@/components/marketing/site-nav';
import { SessionGate } from '@/components/marketing/session-gate';
import { PodTabs } from '@/components/marketing/pod-tabs';
import { Pipeline } from '@/components/marketing/pipeline';

export const metadata: Metadata = {
  title: 'Quantocos GC³ — A complete capability. Not another vendor.',
  description:
    'GC³ assembles dedicated multidisciplinary Pods around defined business outcomes — product, cloud, brand and supervised automation — backed by the operating systems we build for ourselves.',
  openGraph: {
    title: 'Quantocos GC³ — A complete capability. Not another vendor.',
    description:
      'Dedicated multidisciplinary Pods, composed around your outcome and strengthened by the systems we build for ourselves.',
    type: 'website',
  },
};

/**
 * Public landing page at `/`.
 *
 * Server component so it renders without a session; the client islands are the
 * navigation, the two interactive explainers, and `SessionGate`, which keeps `/`
 * session-aware for visitors who are already signed in.
 */
const CONTACT_HREF = 'mailto:hello@quantocos.com?subject=GC%C2%B3%20capability%20conversation';

const OPERATING_PROOF = [
  {
    index: '01',
    title: 'Multidisciplinary by design',
    body: 'Pods assemble engineers, cloud architects, product strategists and domain specialists together from day one — not one hire at a time.',
  },
  {
    index: '02',
    title: 'One accountable lead',
    body: 'A dedicated Capability Lead owns the delivery outcome and removes the handoff friction that quietly eats a quarter.',
  },
  {
    index: '03',
    title: 'Flexible capability',
    body: 'Composition adapts across discovery, foundation build, scale and steady-state governance without renegotiating the relationship.',
  },
  {
    index: '04',
    title: 'Shared operating memory',
    body: 'Architecture decisions, runbooks and domain rationale persist in the client environment — not in someone’s head or a vendor wiki.',
  },
] as const;

const FRAGMENTED = [
  'Scope sold in pieces, then reassembled by the client',
  'Context rebuilt at every vendor handoff',
  'Account layers between you and the people doing the work',
  'Change orders when the work outgrows the statement',
] as const;

const CONNECTED = [
  'One pod composed around the outcome before kickoff',
  'Decisions and rationale kept where the work happens',
  'A single Capability Lead who owns delivery',
  'Composition that adapts as the phase changes',
] as const;

const CAPABILITIES = [
  {
    tag: 'Product',
    title: 'Digital product & engineering',
    body: 'From user validation to a production release that survives contact with real usage — design, engineering and release in one pod.',
    span: 'lg:col-span-4',
  },
  {
    tag: 'Cloud',
    title: 'Cloud & resilient infrastructure',
    body: 'Multi-region backbones, failover and cost governance designed before scale arrives.',
    span: 'lg:col-span-2',
  },
  {
    tag: 'Brand',
    title: 'Brand systems & visual direction',
    body: 'Editorial systems, typography and narrative that hold across every surface.',
    span: 'lg:col-span-2',
  },
  {
    tag: 'Data / AI',
    title: 'Data, knowledge & supervised AI',
    body: 'Retrieval, evaluation and human review gates — automation that leaves an audit trail rather than a black box.',
    span: 'lg:col-span-4',
  },
  {
    tag: 'Telemetry',
    title: 'Operational telemetry & observability',
    body: 'Signal from delivery: what moved, what stalled, and what the numbers actually mean.',
    span: 'lg:col-span-3',
  },
  {
    tag: 'Governance',
    title: 'Operating model & GCC governance',
    body: 'Captive, build–operate–transfer, managed or federated — the operating model chosen before the org chart.',
    span: 'lg:col-span-3',
  },
] as const;

const COMPARISON = {
  criteria: [
    'Capability assembly',
    'Range of senior disciplines',
    'Knowledge & context continuity',
    'Delivery accountability',
    'Delivery sizing flexibility',
    'Access to internal tooling',
  ],
  columns: [
    {
      name: 'Conventional agency',
      values: [
        'Sold as separate scopes, assembled per brief',
        'Deep in one lane',
        'Lost when the engagement ends',
        'An account layer between you and the work',
        'Change orders',
        'Rarely exposed',
      ],
    },
    {
      name: 'Pure in-house',
      values: [
        'Hired role by role, over quarters',
        'Depends on which roles closed',
        'Held by individuals, not systems',
        'Spread across team leads',
        'Hiring or losing people',
        'Built, rarely governed',
      ],
    },
    {
      name: 'Quantocos pod',
      values: [
        'Composed around the outcome before kickoff',
        'Product, cloud, brand and data in one pod',
        'Kept in the client environment as runbooks',
        'One accountable Capability Lead',
        'Composition adapts across phases',
        'Signal, Memory and Proof in the loop',
      ],
    },
  ],
} as const;

const PLANES = [
  {
    name: 'Human plane',
    line: 'Discovery, architecture and delivery leads who own the outcome.',
    modules: ['Discovery', 'Architecture', 'Delivery lead', 'Domain review'],
  },
  {
    name: 'Agent plane',
    line: 'Supervised automation for research, drafting and verification — every action behind a human gate.',
    modules: ['Research agents', 'Drafting agents', 'Verification agents', 'Telemetry agents'],
  },
  {
    name: 'Shared plane',
    line: 'The memory both planes read from: decisions, runbooks, rationale and evidence.',
    modules: ['Decision log', 'Runbooks', 'Context index', 'Evidence trace'],
  },
] as const;

const GCC_MODELS = [
  {
    name: 'Captive / in-house',
    line: 'You own the capability center, its hiring plan and its operating cadence.',
  },
  {
    name: 'Build–operate–transfer',
    line: 'We build the pod and the operating system, run it, then transfer it intact.',
  },
  {
    name: 'Managed services',
    line: 'We run the capability against agreed outcomes while you keep direction.',
  },
  {
    name: 'Hybrid federated',
    line: 'A central core with distributed specialists, governed by shared standards.',
  },
] as const;

const ENVIRONMENTS = [
  { name: 'Regulated operations', line: 'Traceable decisions and a review gate before anything ships.' },
  { name: 'Knowledge workflows', line: 'Context that compounds instead of resetting at each handoff.' },
  { name: 'Distributed teams', line: 'One operating cadence across time zones and functions.' },
  { name: 'Human–agent coordination', line: 'Automation with a named owner and an evidence trail.' },
] as const;

const OUTCOME_AREAS = [
  'Better decision context',
  'Clearer accountability',
  'More coordinated execution',
] as const;

const INSIGHTS = [
  {
    title: 'Why capability compounds and capacity does not',
    dek: 'The difference between adding people and compounding a delivery system.',
    read: '6 min',
  },
  {
    title: 'The first 30 days of a multidisciplinary pod',
    dek: 'What has to be true in week one for a composed pod to outperform a bench.',
    read: '8 min',
  },
  {
    title: 'When an internal delivery tool is ready for the market',
    dek: 'Signal, Memory and Proof — and the threshold we hold them to.',
    read: '5 min',
  },
] as const;

const FOOTER_NAV = [
  {
    heading: 'Pods',
    links: [
      { label: 'Product Pod', href: '#pods' },
      { label: 'Cloud Pod', href: '#pods' },
      { label: 'Creative Pod', href: '#pods' },
      { label: 'Interactive Pod', href: '#pods' },
    ],
  },
  {
    heading: 'Capabilities',
    links: [
      { label: 'Product & engineering', href: '#capabilities' },
      { label: 'Cloud & infrastructure', href: '#capabilities' },
      { label: 'Brand systems', href: '#capabilities' },
      { label: 'Data & supervised AI', href: '#capabilities' },
    ],
  },
  {
    heading: 'Delivery',
    links: [
      { label: 'Delivery model', href: '#delivery' },
      { label: 'Execution pipeline', href: '#delivery' },
      { label: 'Operating model', href: '#operating-model' },
      { label: 'Target environments', href: '#outcomes' },
    ],
  },
  {
    heading: 'Portal',
    links: [
      { label: 'Client portal', href: '#contact' },
      { label: 'Portal access', href: '#contact' },
      { label: 'Insights', href: '#insights' },
      { label: 'Start a conversation', href: '#contact' },
    ],
  },
] as const;

export default function MarketingHome() {
  return (
    <>
      <SessionGate />
      <SiteNav />

      <main id="top">
        {/* ---------------------------------------------------------------- hero */}
        <section className="relative overflow-hidden border-b border-hairline bg-obsidian">
          <div aria-hidden="true" className="blueprint absolute inset-0 opacity-[0.22]" />
          <div
            aria-hidden="true"
            className="absolute -top-40 left-1/2 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle_at_50%_50%,rgba(217,182,93,0.16),transparent_62%)] blur-[2px]"
          />

          <div className="shell relative grid gap-16 py-16 lg:grid-cols-[minmax(0,1.04fr)_minmax(0,0.96fr)] lg:items-center lg:py-24">
            <div>
              <p className="flex flex-wrap items-center gap-x-3 gap-y-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ghost-muted">
                <span className="rounded-full border border-gold/30 bg-gold/10 px-2.5 py-1 text-gold-light">
                  GC³ · Global Cloud Capability Center
                </span>
                <span className="hidden sm:inline">Pod delivery</span>
              </p>

              <h1 className="mt-7 max-w-[24ch] font-display text-[clamp(2.6rem,5.1vw,4.3rem)] leading-[1.02] tracking-[-0.025em] text-ghost">
                A complete capability.
                <span className="block italic text-ghost/90">Not another vendor.</span>
              </h1>

              <p className="mt-7 max-w-[46ch] text-[15px] leading-[1.7] text-ghost-muted sm:text-base">
                Dedicated multidisciplinary Pods, composed around your outcome and strengthened by the
                systems we build for ourselves.
              </p>

              <div className="mt-9 flex flex-wrap items-center gap-3">
                <Link
                  href="/login"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[10px] border border-gold-deep/40 bg-[linear-gradient(180deg,#E2C777_0%,#D9B65D_100%)] px-6 text-sm font-medium text-ink shadow-[0_1px_0_rgba(255,255,255,0.35)_inset,0_16px_40px_-22px_rgba(217,182,93,0.8)] transition-[filter,transform] duration-200 hover:brightness-105 active:translate-y-px"
                >
                  Portal Access
                  <ArrowUpRight size={16} aria-hidden="true" />
                </Link>
                <a
                  href="#pods"
                  className="inline-flex min-h-12 items-center justify-center rounded-[10px] border border-hairline bg-white/[0.03] px-6 text-sm text-ghost backdrop-blur-sm transition-colors duration-200 hover:border-gold/40 hover:bg-white/[0.06]"
                >
                  Explore the Pod model
                </a>
              </div>

              <p className="mt-8 font-mono text-[10px] uppercase tracking-[0.16em] text-ghost-muted/80">
                Governed capability architecture · Unified delivery cohesion
              </p>
            </div>

            {/* Capability orbit — CSS/SVG only, no runtime 3D dependency. */}
            <div className="relative mx-auto aspect-square w-full max-w-[520px]">
              <div
                aria-hidden="true"
                className="absolute inset-[14%] rounded-full bg-[radial-gradient(circle_at_50%_42%,rgba(217,182,93,0.16),transparent_65%)]"
              />
              <svg
                viewBox="0 0 400 400"
                className="absolute inset-0 size-full"
                role="img"
                aria-label="Diagram: human, agent and shared planes orbiting one accountable capability core"
              >
                <defs>
                  <linearGradient id="gc3-arc" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#D9B65D" stopOpacity="0.85" />
                    <stop offset="55%" stopColor="#D9B65D" stopOpacity="0.15" />
                    <stop offset="100%" stopColor="#D9B65D" stopOpacity="0" />
                  </linearGradient>
                  <radialGradient id="gc3-core" cx="50%" cy="45%" r="60%">
                    <stop offset="0%" stopColor="#D9B65D" stopOpacity="0.22" />
                    <stop offset="100%" stopColor="#D9B65D" stopOpacity="0" />
                  </radialGradient>
                </defs>

                <circle cx="200" cy="200" r="186" fill="none" stroke="#1E293B" strokeWidth="1" />
                <circle cx="200" cy="200" r="138" fill="none" stroke="#1E293B" strokeWidth="1" strokeDasharray="1 6" />
                <circle cx="200" cy="200" r="86" fill="none" stroke="#1E293B" strokeWidth="1" />
                <circle cx="200" cy="200" r="86" fill="url(#gc3-core)" />

                <g className="orbit-ring">
                  <circle
                    cx="200"
                    cy="200"
                    r="186"
                    fill="none"
                    stroke="url(#gc3-arc)"
                    strokeWidth="1.5"
                    strokeDasharray="118 1050"
                    strokeLinecap="round"
                  />
                </g>
                <g className="orbit-ring-reverse">
                  <circle
                    cx="200"
                    cy="200"
                    r="138"
                    fill="none"
                    stroke="#D9B65D"
                    strokeOpacity="0.35"
                    strokeWidth="1"
                    strokeDasharray="46 820"
                    strokeLinecap="round"
                  />
                </g>

                <g stroke="#1E293B" strokeWidth="1">
                  <line x1="200" y1="6" x2="200" y2="20" />
                  <line x1="200" y1="380" x2="200" y2="394" />
                  <line x1="6" y1="200" x2="20" y2="200" />
                  <line x1="380" y1="200" x2="394" y2="200" />
                </g>

                <g>
                  <circle cx="200" cy="62" r="4" fill="#D9B65D" />
                  <circle cx="330" cy="270" r="4" fill="#94A3B8" />
                  <circle cx="70" cy="270" r="4" fill="#94A3B8" />
                  <circle cx="200" cy="200" r="3" fill="#E8EEF7" />
                </g>
              </svg>

              <div className="absolute inset-0 grid place-items-center">
                <div className="grid place-items-center gap-1">
                  <span className="grid size-16 place-items-center rounded-full border border-gold/40 bg-obsidian/80 font-display text-lg font-semibold text-gold-light shadow-[0_0_40px_-8px_rgba(217,182,93,0.45)]">
                    GC³
                  </span>
                  <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-ghost-muted">
                    One lead
                  </span>
                </div>
              </div>

              <span className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 rounded-full border border-hairline bg-obsidian/90 px-3 py-1 font-mono text-[9px] uppercase tracking-[0.16em] text-ghost">
                Human
              </span>
              <span className="absolute bottom-[13%] right-0 rounded-full border border-hairline bg-obsidian/90 px-3 py-1 font-mono text-[9px] uppercase tracking-[0.16em] text-ghost-muted">
                Agent
              </span>
              <span className="absolute bottom-[13%] left-0 rounded-full border border-hairline bg-obsidian/90 px-3 py-1 font-mono text-[9px] uppercase tracking-[0.16em] text-ghost-muted">
                Shared
              </span>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------ operating proof */}
        <section className="border-b border-hairline bg-obsidian-soft">
          <div className="shell grid md:grid-cols-2 lg:grid-cols-4">
            {OPERATING_PROOF.map((item) => (
              <div
                key={item.index}
                className="rise relative border-b border-hairline/70 py-8 pr-6 last:border-b-0 md:border-b-0 md:border-l md:pl-6 md:first:border-l-0 md:first:pl-0 lg:py-10"
              >
                <p className="figures font-mono text-[10px] tracking-[0.16em] text-gold/70">{item.index}</p>
                <h2 className="mt-3 text-[15px] font-medium tracking-[-0.01em] text-ghost">{item.title}</h2>
                <p className="mt-2 text-[13px] leading-[1.65] text-ghost-muted">{item.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* --------------------------------------------------- structural challenge */}
        <section className="relative border-b border-hairline bg-obsidian py-20 sm:py-24">
          <div className="shell grid gap-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-16">
            <div className="rise lg:sticky lg:top-28 lg:self-start">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-gold/80">
                The structural problem
              </p>
              <h2 className="mt-4 max-w-[20ch] font-display text-[clamp(1.9rem,3.2vw,2.75rem)] leading-[1.08] tracking-[-0.02em] text-ghost">
                Your ambitions rarely fit inside one job description.
              </h2>
              <p className="mt-5 max-w-[46ch] text-[14px] leading-[1.75] text-ghost-muted">
                Modern enterprise initiatives demand cloud architecture, systems engineering, product
                strategy and domain governance working in unison. Yet legacy sourcing forces teams into
                fractured vendor handoffs.
              </p>
            </div>

            <div className="rise grid gap-4 sm:grid-cols-2">
              <div className="rounded-[14px] border border-hairline bg-obsidian-soft p-6">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ghost-muted">Today</p>
                <h3 className="mt-3 text-[15px] font-medium leading-snug text-ghost">
                  Disconnected vendors &amp; diluted context
                </h3>
                <ul className="mt-5 grid gap-3">
                  {FRAGMENTED.map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-[13px] leading-relaxed text-ghost-muted">
                      <Minus size={14} className="mt-0.5 shrink-0 text-hairline" aria-hidden="true" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="relative overflow-hidden rounded-[14px] border border-gold/25 bg-[linear-gradient(180deg,rgba(217,182,93,0.08),rgba(217,182,93,0.01))] p-6">
                <div
                  aria-hidden="true"
                  className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent"
                />
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-gold-light">With GC³</p>
                <h3 className="mt-3 text-[15px] font-medium leading-snug text-ghost">
                  One connected pod, shared accountability
                </h3>
                <ul className="mt-5 grid gap-3">
                  {CONNECTED.map((item) => (
                    <li key={item} className="flex items-start gap-2.5 text-[13px] leading-relaxed text-ghost">
                      <Check size={14} className="mt-0.5 shrink-0 text-gold" aria-hidden="true" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------- pod model */}
        <section id="pods" className="border-b border-hairline bg-obsidian-soft py-20 sm:py-24">
          <div className="shell">
            <div className="rise max-w-[62ch]">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-emerald-300/90">
                Capability pods &amp; pricing
              </p>
              <h2 className="mt-4 font-display text-[clamp(1.9rem,3.4vw,2.9rem)] leading-[1.06] tracking-[-0.02em] text-ghost">
                Six pods. Published prices. No bench.
              </h2>
              <p className="mt-5 text-[14px] leading-[1.75] text-ghost-muted">
                Every pod is a standing multidisciplinary team on a monthly credit pool, priced and
                published rather than quoted. Pods stack upward: Growth carries the entire Creative
                catalogue on the same pool, and Strategy carries both.
              </p>
            </div>

            <div className="rise mt-10">
              <PodTabs />
            </div>
          </div>
        </section>

        {/* ---------------------------------------------------------- capabilities */}
        <section id="capabilities" className="border-b border-hairline bg-obsidian py-20 sm:py-24">
          <div className="shell">
            <div className="rise flex flex-wrap items-end justify-between gap-6">
              <div className="max-w-[58ch]">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-gold/80">Capabilities</p>
                <h2 className="mt-4 font-display text-[clamp(1.9rem,3.4vw,2.9rem)] leading-[1.06] tracking-[-0.02em] text-ghost">
                  Capabilities in action across the enterprise stack.
                </h2>
              </div>
              <p className="max-w-[34ch] font-mono text-[10px] uppercase leading-[1.9] tracking-[0.14em] text-ghost-muted">
                Each discipline carries its own rigour.
                <br />
                All of them connect.
              </p>
            </div>

            <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
              {CAPABILITIES.map((capability) => (
                <article
                  key={capability.title}
                  className={`rise group relative overflow-hidden rounded-[14px] border border-hairline bg-obsidian-soft p-6 transition-[border-color,transform,background-color] duration-300 hover:-translate-y-0.5 hover:border-gold/35 hover:bg-obsidian-raised ${capability.span}`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-gold/70">
                      {capability.tag}
                    </span>
                    <ArrowUpRight
                      size={15}
                      aria-hidden="true"
                      className="text-hairline transition-colors duration-300 group-hover:text-gold/70"
                    />
                  </div>
                  <h3 className="mt-4 max-w-[24ch] text-[16px] font-medium leading-snug tracking-[-0.01em] text-ghost">
                    {capability.title}
                  </h3>
                  <p className="mt-2.5 max-w-[42ch] text-[13px] leading-[1.65] text-ghost-muted">
                    {capability.body}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* --------------------------------------------------- delivery comparison */}
        <section id="delivery" className="border-b border-hairline bg-obsidian-soft py-20 sm:py-24">
          <div className="shell">
            <div className="rise max-w-[62ch]">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-gold/80">Delivery model</p>
              <h2 className="mt-4 font-display text-[clamp(1.9rem,3.4vw,2.9rem)] leading-[1.06] tracking-[-0.02em] text-ghost">
                Designed between agency and in-house.
              </h2>
              <p className="mt-5 text-[14px] leading-[1.75] text-ghost-muted">
                Comparing delivery characteristics across traditional outsourcing, internal scaling and
                the Quantocos pod capability center model.
              </p>
            </div>

            <div className="rise mt-10 hidden overflow-hidden rounded-[14px] border border-hairline lg:block">
              <table className="w-full border-collapse text-left">
                <caption className="sr-only">
                  Delivery model comparison across conventional agency, pure in-house and the Quantocos pod
                </caption>
                <thead>
                  <tr className="bg-obsidian">
                    <th
                      scope="col"
                      className="w-[26%] px-5 py-4 font-mono text-[10px] font-normal uppercase tracking-[0.16em] text-ghost-muted"
                    >
                      Criterion
                    </th>
                    {COMPARISON.columns.map((column) => (
                      <th
                        key={column.name}
                        scope="col"
                        className={[
                          'px-5 py-4 font-mono text-[10px] font-normal uppercase tracking-[0.16em]',
                          column.name === 'Quantocos pod'
                            ? 'bg-gold/[0.06] text-gold-light'
                            : 'text-ghost-muted',
                        ].join(' ')}
                      >
                        {column.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON.criteria.map((criterion, rowIndex) => (
                    <tr key={criterion} className="border-t border-hairline">
                      <th scope="row" className="px-5 py-4 text-[13px] font-medium text-ghost">
                        {criterion}
                      </th>
                      {COMPARISON.columns.map((column) => (
                        <td
                          key={column.name}
                          className={[
                            'px-5 py-4 text-[13px] leading-relaxed',
                            column.name === 'Quantocos pod' ? 'bg-gold/[0.045] text-ghost' : 'text-ghost-muted',
                          ].join(' ')}
                        >
                          {column.values[rowIndex]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-8 grid gap-3 lg:hidden">
              {COMPARISON.columns.map((column) => (
                <div
                  key={column.name}
                  className={[
                    'rounded-[14px] border p-5',
                    column.name === 'Quantocos pod'
                      ? 'border-gold/25 bg-gold/[0.05]'
                      : 'border-hairline bg-obsidian',
                  ].join(' ')}
                >
                  <p
                    className={[
                      'font-mono text-[10px] uppercase tracking-[0.16em]',
                      column.name === 'Quantocos pod' ? 'text-gold-light' : 'text-ghost-muted',
                    ].join(' ')}
                  >
                    {column.name}
                  </p>
                  <dl className="mt-4 grid gap-3">
                    {COMPARISON.criteria.map((criterion, index) => (
                      <div key={criterion} className="grid gap-0.5">
                        <dt className="text-[11px] uppercase tracking-[0.08em] text-ghost-muted/70">
                          {criterion}
                        </dt>
                        <dd className="text-[13px] leading-relaxed text-ghost-muted">
                          {column.values[index]}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              ))}
            </div>

            <div className="rise mt-16">
              <div className="max-w-[58ch]">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-gold/80">Execution</p>
                <h3 className="mt-4 font-display text-[clamp(1.6rem,2.6vw,2.2rem)] leading-[1.1] tracking-[-0.02em] text-ghost">
                  From strategic intent to coordinated action.
                </h3>
                <p className="mt-4 text-[14px] leading-[1.75] text-ghost-muted">
                  A five-stage progression from leadership intent to governed execution — with an
                  artefact captured at every gate.
                </p>
              </div>
              <div className="mt-9">
                <Pipeline />
              </div>
            </div>
          </div>
        </section>

        {/* -------------------------------------------------------- operating model */}
        <section id="operating-model" className="border-b border-hairline bg-obsidian py-20 sm:py-24">
          <div className="shell">
            <div className="rise max-w-[62ch]">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-gold/80">Operating model</p>
              <h2 className="mt-4 font-display text-[clamp(1.9rem,3.4vw,2.9rem)] leading-[1.06] tracking-[-0.02em] text-ghost">
                Human, agent and shared — one plane of accountability.
              </h2>
              <p className="mt-5 text-[14px] leading-[1.75] text-ghost-muted">
                The delivery model is three planes with one owner. Automation is supervised, context is
                shared, and every decision keeps its reasoning.
              </p>
            </div>

            <div className="mt-10 grid gap-3 lg:grid-cols-3">
              {PLANES.map((plane, index) => (
                <article
                  key={plane.name}
                  className="rise group relative overflow-hidden rounded-[14px] border border-hairline bg-obsidian-soft p-6 transition-colors duration-300 hover:border-gold/35"
                >
                  <span
                    aria-hidden="true"
                    className="absolute right-5 top-5 font-mono text-[10px] tracking-[0.16em] text-hairline"
                  >
                    0{index + 1}
                  </span>
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-gold/70">{plane.name}</p>
                  <p className="mt-3 min-h-[72px] text-[13px] leading-[1.7] text-ghost-muted">{plane.line}</p>
                  <ul className="mt-5 grid gap-px overflow-hidden rounded-[10px] border border-hairline bg-hairline">
                    {plane.modules.map((module) => (
                      <li
                        key={module}
                        className="bg-obsidian px-3 py-2 font-mono text-[11px] tracking-[0.02em] text-ghost-muted transition-colors duration-200 group-hover:text-ghost"
                      >
                        {module}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>

            <div className="rise mt-16">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <h3 className="font-display text-[clamp(1.5rem,2.4vw,2rem)] leading-[1.1] tracking-[-0.02em] text-ghost">
                  Global Capability Center guidance
                </h3>
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ghost-muted">
                  Four operating models
                </p>
              </div>
              <div className="mt-6 grid gap-px overflow-hidden rounded-[14px] border border-hairline bg-hairline sm:grid-cols-2 lg:grid-cols-4">
                {GCC_MODELS.map((model, index) => (
                  <div
                    key={model.name}
                    className="bg-obsidian-soft p-5 transition-colors duration-300 hover:bg-obsidian-raised"
                  >
                    <p className="figures font-mono text-[10px] tracking-[0.16em] text-gold/60">0{index + 1}</p>
                    <p className="mt-3 text-[14px] font-medium text-ghost">{model.name}</p>
                    <p className="mt-2 text-[12.5px] leading-[1.6] text-ghost-muted">{model.line}</p>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-[11.5px] leading-relaxed text-ghost-muted/70">
                Specific recommendations require organizational, legal, financial and technical discovery.
              </p>
            </div>
          </div>
        </section>

        {/* -------------------------------------------------------------- outcomes */}
        <section id="outcomes" className="border-b border-hairline bg-obsidian-soft py-20 sm:py-24">
          <div className="shell grid gap-12 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-16">
            <div className="rise">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-gold/80">Target environments</p>
              <h2 className="mt-4 max-w-[18ch] font-display text-[clamp(1.9rem,3.2vw,2.6rem)] leading-[1.08] tracking-[-0.02em] text-ghost">
                Built for the places complexity actually lives.
              </h2>
              <div className="mt-8 rounded-[12px] border border-hairline bg-obsidian p-5">
                <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ghost-muted">
                  Intended outcome areas
                </p>
                <ul className="mt-3 grid gap-2">
                  {OUTCOME_AREAS.map((area) => (
                    <li key={area} className="flex items-center gap-2 text-[13px] text-ghost">
                      <Check size={13} className="text-gold" aria-hidden="true" />
                      {area}
                    </li>
                  ))}
                </ul>
                <p className="mt-4 border-t border-hairline pt-3 text-[11px] leading-relaxed text-ghost-muted/70">
                  Intended outcome areas — not measured customer results.
                </p>
              </div>
            </div>

            <div className="rise grid gap-px overflow-hidden rounded-[14px] border border-hairline bg-hairline sm:grid-cols-2">
              {ENVIRONMENTS.map((item, index) => (
                <div
                  key={item.name}
                  className="bg-obsidian p-6 transition-colors duration-300 hover:bg-obsidian-raised"
                >
                  <p className="figures font-mono text-[10px] tracking-[0.16em] text-gold/60">0{index + 1}</p>
                  <p className="mt-3 text-[14px] font-medium text-ghost">{item.name}</p>
                  <p className="mt-2 text-[12.5px] leading-[1.65] text-ghost-muted">{item.line}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* -------------------------------------------------------------- insights */}
        <section id="insights" className="border-b border-hairline bg-obsidian py-20 sm:py-24">
          <div className="shell">
            <div className="rise flex flex-wrap items-end justify-between gap-6">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-gold/80">Insights</p>
                <h2 className="mt-4 font-display text-[clamp(1.9rem,3.4vw,2.9rem)] leading-[1.06] tracking-[-0.02em] text-ghost">
                  What we are learning.
                </h2>
                <p className="mt-4 max-w-[52ch] text-[14px] leading-[1.75] text-ghost-muted">
                  Documenting real operational insights from assembling capability centers and running
                  multidisciplinary pods.
                </p>
              </div>
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ghost-muted">
                Publishing shortly
              </p>
            </div>

            <div className="mt-10 grid gap-3 md:grid-cols-3">
              {INSIGHTS.map((insight) => (
                <article
                  key={insight.title}
                  className="rise flex flex-col justify-between rounded-[14px] border border-hairline bg-obsidian-soft p-6"
                >
                  <div>
                    <span className="inline-flex items-center rounded-full border border-hairline px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.14em] text-ghost-muted">
                      In preparation
                    </span>
                    <h3 className="mt-4 font-display text-[19px] leading-[1.25] tracking-[-0.01em] text-ghost">
                      {insight.title}
                    </h3>
                    <p className="mt-2.5 text-[13px] leading-[1.65] text-ghost-muted">{insight.dek}</p>
                  </div>
                  <p className="mt-6 flex items-center justify-between border-t border-hairline pt-4 font-mono text-[10px] uppercase tracking-[0.14em] text-ghost-muted/70">
                    <span>Field note</span>
                    <span className="figures">{insight.read}</span>
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------- final CTA */}
        <section id="contact" className="relative overflow-hidden bg-obsidian py-20 sm:py-28">
          <div aria-hidden="true" className="blueprint absolute inset-0 opacity-[0.16]" />
          <div
            aria-hidden="true"
            className="absolute bottom-0 left-1/2 h-[380px] w-[820px] -translate-x-1/2 translate-y-1/3 rounded-full bg-[radial-gradient(circle_at_50%_50%,rgba(217,182,93,0.18),transparent_65%)]"
          />
          <div className="shell relative">
            <div className="rise mx-auto max-w-[880px] rounded-[18px] border border-hairline bg-[linear-gradient(180deg,rgba(14,21,35,0.92),rgba(9,13,22,0.96))] p-8 text-center shadow-[0_1px_0_rgba(255,255,255,0.06)_inset,0_40px_120px_-60px_rgba(0,0,0,1)] backdrop-blur-sm sm:p-14">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-gold/80">
                GC³ · Enterprise advisory
              </p>
              <h2 className="mx-auto mt-5 max-w-[22ch] font-display text-[clamp(2rem,3.8vw,3.1rem)] leading-[1.05] tracking-[-0.02em] text-ghost">
                A complete capability. Composed around your outcome.
              </h2>
              <p className="mx-auto mt-5 max-w-[54ch] text-[14px] leading-[1.75] text-ghost-muted">
                Connect with Quantocos to assemble a dedicated multidisciplinary pod, or discuss
                establishing your Global Cloud Capability Center.
              </p>
              <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
                <Link
                  href="/login"
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[10px] border border-gold-deep/40 bg-[linear-gradient(180deg,#E2C777_0%,#D9B65D_100%)] px-6 text-sm font-medium text-ink shadow-[0_1px_0_rgba(255,255,255,0.35)_inset,0_16px_40px_-22px_rgba(217,182,93,0.8)] transition-[filter,transform] duration-200 hover:brightness-105 active:translate-y-px"
                >
                  Portal Access
                  <ArrowUpRight size={16} aria-hidden="true" />
                </Link>
                <a
                  href={CONTACT_HREF}
                  className="inline-flex min-h-12 items-center justify-center rounded-[10px] border border-hairline bg-white/[0.03] px-6 text-sm text-ghost transition-colors duration-200 hover:border-gold/40 hover:bg-white/[0.06]"
                >
                  Start a conversation
                </a>
              </div>
              <p className="mt-8 font-mono text-[10px] uppercase tracking-[0.16em] text-ghost-muted/70">
                Governed architecture framework · Portal access provisioned by your delivery lead
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* --------------------------------------------------------------- footer */}
      <footer className="border-t border-hairline bg-obsidian-soft">
        <div className="shell py-14">
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,2fr)]">
            <div>
              <div className="flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-[10px] border border-gold/35 bg-gold/10 font-display text-base font-semibold text-gold-light">
                  Q
                </span>
                <span className="font-display text-[17px] tracking-[-0.01em] text-ghost">
                  Quantocos <span className="text-gold-light">GC³</span>
                </span>
              </div>
              <p className="mt-5 max-w-[46ch] text-[13px] leading-[1.7] text-ghost-muted">
                Quantocos GC³ is a Global Cloud Capability Center that assembles dedicated
                multidisciplinary pods around defined business outcomes, backed by the internal operating
                systems we build for ourselves.
              </p>
              <p className="mt-3 max-w-[46ch] font-mono text-[10px] uppercase leading-[1.9] tracking-[0.14em] text-ghost-muted/70">
                Operating across cloud engineering, full-stack product, brand architecture and supervised
                automation
              </p>
            </div>

            <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
              {FOOTER_NAV.map((column) => (
                <div key={column.heading}>
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ghost-muted">
                    {column.heading}
                  </p>
                  <ul className="mt-4 grid gap-2.5">
                    {column.links.map((link) => (
                      <li key={`${column.heading}-${link.label}`}>
                        <a
                          href={link.href}
                          className="text-[13px] text-ghost-muted transition-colors duration-200 hover:text-ghost"
                        >
                          {link.label}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-12 flex flex-col gap-3 border-t border-hairline pt-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ghost-muted/70">
              © 2026 Quantocos · GC³ is a Global Cloud Capability Center
            </p>
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ghost-muted/70">
              No client names, case studies or performance figures are published on this page
            </p>
          </div>
        </div>
      </footer>
    </>
  );
}
