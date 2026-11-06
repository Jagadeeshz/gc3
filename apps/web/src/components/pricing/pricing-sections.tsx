'use client';

import { useState } from 'react';
import type { CapabilityPod } from '@gc3/types';
import {
  BadgeCheck,
  ChevronDown,
  ClipboardCheck,
  FileSignature,
  GitBranch,
  ScrollText,
  ShieldCheck,
} from 'lucide-react';

/**
 * The commercial page's working sections.
 *
 * Modelled on how the productised-design category sells — proof, grouped tier
 * cards, an objection-handling FAQ, and a look at the software — but written for a
 * corporate buyer and built from GC³'s own catalogue. Nothing here is copied from
 * another company's page: the structure is a pattern, their words and assets are not.
 */

const money = (minor: number, currency: string): string =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(
    minor / 100,
  );

function priceCell(pod: CapabilityPod): string {
  return pod.isCustomPriced
    ? `${money(pod.creditRateCents, pod.currency)}/credit`
    : `${money(pod.monthlyPriceCents, pod.currency)}/mo`;
}

function capacityCell(pod: CapabilityPod): string {
  if (pod.creditsIncluded > 0) return `${pod.creditsIncluded} credits`;
  if (pod.hoursIncluded > 0) return `${pod.hoursIncluded}h${pod.peakHoursIncluded > 0 ? ` / ${pod.peakHoursIncluded}h peak` : ''}`;
  return 'Scoped';
}

function teamCell(pod: CapabilityPod): string {
  if (pod.managers + pod.specialists + pod.agents === 0) return pod.teamSummary ?? 'Custom';

  return `${pod.managers} / ${pod.specialists} / ${pod.agents}`;
}

/** A real comparison table: the buying decision in one screen, tabular throughout. */
export function PodComparison({ pods }: { readonly pods: readonly CapabilityPod[] }) {
  const names = new Map(pods.map((pod) => [pod.code, pod.name.replace(' (Digital)', '')]));

  return (
    <div className="overflow-x-auto rounded-[12px] border border-[#1E293B]">
      <table className="w-full min-w-[720px] border-collapse text-left">
        <thead>
          <tr className="bg-white/[0.03]">
            {['Pod', 'Price', 'Capacity', 'Mgr / Spec / Agents', 'Carries', 'Minimum'].map((head) => (
              <th
                key={head}
                className="whitespace-nowrap px-4 py-3 font-mono text-[9px] uppercase tracking-[0.14em] text-slate-500"
              >
                {head}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {pods.map((pod) => (
            <tr key={pod.code} className="border-t border-[#1E293B] transition-colors hover:bg-white/[0.02]">
              <td className="px-4 py-3">
                <span className="text-[12px] font-medium text-slate-100">{pod.name}</span>
              </td>
              <td className="px-4 py-3 font-mono text-[12px] tabular-nums text-emerald-300">
                {priceCell(pod)}
              </td>
              <td className="px-4 py-3 font-mono text-[11px] tabular-nums text-slate-300">
                {capacityCell(pod)}
              </td>
              <td className="px-4 py-3 font-mono text-[11px] tabular-nums text-slate-300">
                {teamCell(pod)}
              </td>
              <td className="px-4 py-3 text-[11px] text-slate-400">
                {pod.includesCodes.length > 0
                  ? pod.includesCodes.map((code) => names.get(code) ?? code).join(' + ')
                  : '—'}
              </td>
              <td className="px-4 py-3 font-mono text-[11px] text-slate-400">
                {pod.minTermMonths > 0 ? `${pod.minTermMonths} months` : 'Monthly'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const PLATFORM = [
  {
    icon: ClipboardCheck,
    title: 'Intake that becomes work',
    body: 'A request enters triage, gets a pod and an SLA clock in the same action. Nothing sits in an inbox.',
  },
  {
    icon: FileSignature,
    title: 'Deliverable review, versioned',
    body: 'Every deliverable is approved or returned with a version bump and a checksum, so v3 is provably the v3 you signed off.',
  },
  {
    icon: GitBranch,
    title: 'Pod routing you can see',
    body: 'A client sees whether each request is routed and to which pod — the routing is a record, not a promise.',
  },
  {
    icon: ScrollText,
    title: 'An audit trail by default',
    body: 'Role changes, tenant edits and invoice movements are recorded with who, when and from where.',
  },
  {
    icon: ShieldCheck,
    title: 'Role-based by construction',
    body: 'Owner, member and approver each see a different surface. Billing is the owner’s, delivery is the team’s.',
  },
  {
    icon: BadgeCheck,
    title: 'SLA measured, not implied',
    body: 'Targets are materialised per request and the state — on track, at risk, breached — is computed, not typed.',
  },
] as const;

export function PlatformBand() {
  return (
    <section className="grid gap-5">
      <div className="max-w-[62ch]">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-emerald-300/90">
          Inside the portal
        </p>
        <h2 className="mt-3 font-display text-[clamp(1.6rem,2.8vw,2.2rem)] leading-[1.1] tracking-[-0.02em] text-slate-100">
          The pod is the service. This is the software you get with it.
        </h2>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {PLATFORM.map((feature) => {
          const Icon = feature.icon;

          return (
            <article
              key={feature.title}
              className="rounded-[12px] border border-[#1E293B] bg-[#0B1220] p-4 transition-colors hover:border-emerald-400/25"
            >
              <Icon aria-hidden className="size-4 text-emerald-300" strokeWidth={1.75} />
              <h3 className="mt-2.5 text-[13px] font-semibold text-slate-100">{feature.title}</h3>
              <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">{feature.body}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}

/**
 * Objection handling.
 *
 * Every answer here states something the platform or the order form actually does.
 * There is no cancellation or refund promise because terms are agreed per engagement —
 * a marketing page does not get to invent contract language.
 */
const FAQ = [
  {
    q: 'How do credits work?',
    a: 'Each pod ships a monthly credit pool — 120 for Creative, 240 for Growth, 360 for Strategy. Requests are scoped against that pool by your pod manager before work starts, so you always know what a piece of work costs before it is queued.',
  },
  {
    q: 'What does “carries” mean?',
    a: 'Pods stack upward. Growth carries the entire Creative catalogue on the same credit pool, and Strategy carries both Growth and Creative. You buy the highest pod you need; the ones beneath it are included, not added.',
  },
  {
    q: 'How fast is delivery?',
    a: 'Every service in the catalogue carries its own commitment, from 48 hours for strategy and back office to 120 hours for learning. Priority raises or lowers the target per request, and the portal computes whether a request is on track, at risk or breached rather than leaving it to email.',
  },
  {
    q: 'Who is actually on the pod?',
    a: 'One manager accountable for the outcome, a fixed number of specialists, and one supervised agent paired to each specialist. The manager does not rotate; the pairing is the control that keeps automation behind a human gate.',
  },
  {
    q: 'How do reviews and revisions work?',
    a: 'Work arrives as a deliverable with a version and a checksum. Approving or returning it records who did what, and a replacement bumps the version — so the file you approved in v2 is still identifiable after v3 exists.',
  },
  {
    q: 'Is there a minimum term?',
    a: 'Monthly pods run month to month. REMAU, the shared real-estate pod, carries a three-month minimum because launch campaigns do not fit a shorter window. Terms are confirmed on the order form rather than on this page.',
  },
  {
    q: 'How does this differ from buying licenses?',
    a: 'A licence gives you a tool and leaves the assembling to you. A pod arrives composed around one outcome, on one subscription, with one owner — which is the entire argument of this platform.',
  },
] as const;

export function PricingFaq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section className="grid gap-5">
      <div className="max-w-[62ch]">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-emerald-300/90">
          Questions buyers actually ask
        </p>
        <h2 className="mt-3 font-display text-[clamp(1.6rem,2.8vw,2.2rem)] leading-[1.1] tracking-[-0.02em] text-slate-100">
          The detail behind the price list.
        </h2>
      </div>

      <div className="grid gap-px overflow-hidden rounded-[12px] border border-[#1E293B] bg-[#1E293B]">
        {FAQ.map((item, index) => {
          const expanded = open === index;

          return (
            <div key={item.q} className="bg-[#0B1220]">
              <button
                type="button"
                onClick={() => setOpen(expanded ? null : index)}
                aria-expanded={expanded}
                className="flex w-full items-center justify-between gap-4 px-4 py-3.5 text-left transition-colors hover:bg-white/[0.02]"
              >
                <span className="text-[13px] font-medium text-slate-100">{item.q}</span>
                <ChevronDown
                  aria-hidden
                  className={`size-4 shrink-0 text-slate-500 transition-transform duration-300 ${
                    expanded ? 'rotate-180 text-emerald-300' : ''
                  }`}
                  strokeWidth={1.9}
                />
              </button>

              <div
                className={`grid transition-[grid-template-rows] duration-300 ease-out ${
                  expanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                }`}
              >
                <div className="overflow-hidden">
                  <p className="px-4 pb-4 pr-10 text-[12px] leading-relaxed text-slate-400">{item.a}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
