import Link from 'next/link';
import {
  ArrowUpRight,
  Boxes,
  Clock,
  Coins,
  Copy,
  Layers,
  ShieldCheck,
  Users,
  Workflow,
} from 'lucide-react';

/**
 * Bento grid with micro-interactions.
 *
 * Cells are uneven on purpose — a 4/2/2 rhythm at lg so the eye lands on credits
 * and team composition first and the supporting facts fill the remainder. Every
 * cell responds to hover: it lifts, its edge lights, and its detail line slides up.
 * No JS, no library — `group-hover` and transform only, so a 12-cell grid costs
 * nothing to animate.
 *
 * Every claim here is one the platform actually supports: the numbers are the
 * catalogue's, the capabilities are shipped code, not roadmap.
 */

interface Cell {
  readonly icon: typeof Coins;
  readonly label: string;
  readonly value: string;
  readonly detail: string;
  readonly span: string;
  readonly accent?: 'emerald' | 'amber';
}

const CELLS: readonly Cell[] = [
  {
    icon: Coins,
    label: 'Credits, not hours',
    value: '120 – 360',
    detail: 'Monthly credit pool per pod, scoped by your pod manager before work starts.',
    span: 'lg:col-span-2 lg:row-span-2',
    accent: 'emerald',
  },
  {
    icon: Users,
    label: 'Hybrid workforce',
    value: '1 : N : 1',
    detail: 'One manager, N specialists, one supervised agent paired to each specialist.',
    span: 'lg:col-span-2',
  },
  {
    icon: Clock,
    label: 'Delivery commitments',
    value: '48 – 120h',
    detail: 'Published per service in the catalogue. Priority moves the target, not the promise.',
    span: 'lg:col-span-2',
  },
  {
    icon: Layers,
    label: 'Pods stack',
    value: 'Growth ⤴ Creative',
    detail: 'The higher pod carries the catalogues below it on the same credit pool.',
    span: 'lg:col-span-2',
  },
  {
    icon: Workflow,
    label: 'Routing you can see',
    value: 'Live',
    detail: 'Every request shows whether it is routed and to which pod — a record, not a promise.',
    span: 'lg:col-span-2',
  },
  {
    icon: Copy,
    label: 'Versioned deliverables',
    value: 'SHA-256',
    detail: 'A replacement bumps the version and the checksum, so v3 is provably the v3 you signed.',
    span: 'lg:col-span-2',
  },
  {
    icon: ShieldCheck,
    label: 'Computed SLA state',
    value: 'On track · at risk · breached',
    detail: 'Materialised per request from its target and elapsed time, never typed by hand.',
    span: 'lg:col-span-3',
    accent: 'amber',
  },
  {
    icon: Boxes,
    label: 'Terms',
    value: 'Monthly',
    detail: 'Month to month, except REMAU at a three-month minimum. Terms sit on the order form.',
    span: 'lg:col-span-3',
  },
];

export function BentoGrid() {
  return (
    <section className="relative border-b border-hairline bg-obsidian-soft py-20 sm:py-24">
      <div className="shell grid gap-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-[54ch]">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-emerald-300/90">
              Why it holds together
            </p>
            <h2 className="mt-3 font-display text-[clamp(1.7rem,3vw,2.4rem)] leading-[1.08] tracking-[-0.02em] text-ghost">
              Eight facts about the operating model.
            </h2>
          </div>

          <Link
            href="/pricing"
            className="inline-flex items-center gap-1.5 rounded-lg border border-hairline px-3.5 py-2 text-[12px] text-ghost transition-colors hover:border-emerald-400/35 hover:text-emerald-200"
          >
            See the pods
            <ArrowUpRight aria-hidden className="size-3.5" strokeWidth={1.9} />
          </Link>
        </div>

        <div className="grid auto-rows-[minmax(132px,auto)] grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
          {CELLS.map((cell) => {
            const Icon = cell.icon;
            const tone =
              cell.accent === 'amber'
                ? 'text-amber-300 border-amber-400/25'
                : 'text-emerald-300 border-emerald-400/25';

            return (
              <article
                key={cell.label}
                className="group relative flex flex-col justify-between overflow-hidden rounded-[14px] border border-hairline bg-obsidian p-4 transition-[transform,border-color,box-shadow] duration-300 ease-out hover:-translate-y-1 hover:border-emerald-400/30 hover:shadow-[0_22px_50px_-30px_rgba(16,185,129,0.55)] motion-reduce:hover:translate-y-0 ${cell.span}"
              >
                {/* The lit edge: a single gradient hairline that appears on hover. */}
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                />

                <div className="flex items-start justify-between gap-3">
                  <span className={`grid size-8 shrink-0 place-items-center rounded-[9px] border bg-white/[0.02] ${tone}`}>
                    <Icon aria-hidden className="size-4" strokeWidth={1.75} />
                  </span>
                  <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-slate-500">
                    {cell.label}
                  </span>
                </div>

                <div className="mt-4">
                  <p className="font-display text-[clamp(1.15rem,1.8vw,1.6rem)] font-semibold leading-none tracking-[-0.02em] tabular-nums text-ghost">
                    {cell.value}
                  </p>
                  <p className="mt-2 max-h-0 overflow-hidden text-[11.5px] leading-relaxed text-ghost-muted opacity-0 transition-all duration-300 group-hover:max-h-24 group-hover:opacity-100">
                    {cell.detail}
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
