import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';

/**
 * The bands below the stage.
 *
 * The stage alone was a poster: three screens of proposition with nothing underneath to
 * read. These bands carry the detail a buyer actually needs before booking — what exists on
 * day one, how a request moves, what the commitment windows are, how a pod compares to the
 * two alternatives, and the questions that come up on every call.
 *
 * Every figure here is the published one: the commitment windows are the seeded SLA
 * defaults, the pod counts and pools come from the catalogue, and the commercial terms are
 * the ones the portal invoices against.
 */

const COMMITMENTS = [
  { level: 'Urgent', window: '8 hours', detail: 'Production stopped, campaign live, a page down.' },
  { level: 'High', window: '24 hours', detail: 'A launch this week that cannot slip past it.' },
  { level: 'Normal', window: '72 hours', detail: 'Scheduled work inside the current sprint.' },
  { level: 'Low', window: '168 hours', detail: 'Backlog and anything that can batch.' },
];

const FAQ = [
  {
    q: 'What am I actually buying?',
    a: 'A standing team on a monthly credit pool. Not seats, not timesheets, and not a scope agreed per project. The pod arrives composed and the pool is published, so the cost of the month is known before the work starts.',
  },
  {
    q: 'What happens at the end of a month?',
    a: 'The pool resets with the subscription. Work already in the queue carries over and keeps its original commitment window — a request does not lose its clock because the calendar turned.',
  },
  {
    q: 'How many clients share a pod?',
    a: 'Three at most, and the roster is fixed rather than pooled across accounts. No pod is over-subscribed and no specialist is split silently between more clients than the pod was sold to carry.',
  },
  {
    q: 'Can we start with one pod and add another?',
    a: 'Yes, and it is the normal path. A second pod is added without renegotiating the first, because they are separate pools with separate rosters. Growth also carries the Creative catalogue, so the second pod is often a step up rather than a second subscription.',
  },
  {
    q: 'Who can see our work?',
    a: 'Your organisation is the tenant boundary. Every request, deliverable, approval and invoice is stamped with the organisation that owns it, and the API refuses a cross-tenant read rather than filtering it out of a response.',
  },
  {
    q: 'Do we have to use the portal?',
    a: 'The portal is where commitments are measured — the request, its window, its owner and whether it is at risk. Using it is what makes the delivery commitment auditable, for both sides, rather than a recollection at quarter end.',
  },
];


const DAY_ONE = [
  {
    title: 'A workspace that is already populated',
    body: 'The subscription, the pod roster and the request queue exist before you sign in. Nothing is configured per client, and nothing is empty on the first morning.',
    meta: 'Day one',
  },
  {
    title: 'One manager with the account',
    body: 'The manager who scoped the pod runs it. Escalation is a name rather than a mailbox, and the person answering already knows what the outcome is meant to be.',
    meta: 'Named',
  },
  {
    title: 'Commitments attached to work',
    body: 'Every request carries its window — urgent 8 hours through low 168 hours — and shows when it is at risk before it breaches, not after.',
    meta: 'Measured',
  },
  {
    title: 'Records you can hand to finance',
    body: 'Invoices, deliverables and approvals are per tenant, dated, and attributable to the person who acted. Nothing has to be reconciled from email.',
    meta: 'Per tenant',
  },
];

export function DayOneGrid() {
  return (
    <div className="grid gap-px overflow-hidden rounded-2xl border border-hairline bg-[var(--color-border-hairline)] sm:grid-cols-2">
      {DAY_ONE.map((c, i) => (
        <div key={c.title} className="group relative bg-obsidian p-7 transition-colors hover:bg-obsidian-soft">
          <span className="font-mono text-[10px] tracking-[0.18em] text-ghost-muted">
            {String(i + 1).padStart(2, '0')} · {c.meta}
          </span>
          <h3 className="mt-4 font-display text-[1.15rem] leading-[1.25] tracking-[-0.01em] text-ghost">
            {c.title}
          </h3>
          <p className="mt-3 text-[13.5px] leading-[1.7] text-ghost-muted">{c.body}</p>
          <p className="mt-5 flex items-center gap-2 border-t border-hairline pt-3 font-mono text-[9.5px] uppercase tracking-[0.14em] text-ghost-muted">
            In place before the first request
          </p>
        </div>
      ))}
    </div>
  );
}

export function CommitmentBand() {
  return (
    <section className="border-b border-hairline py-20 sm:py-24" aria-label="Delivery commitments">
        <div className="shell grid gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-16">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ghost-muted">
              The commitment clock
            </p>
            <h2 className="mt-3 font-display text-[clamp(1.9rem,3.4vw,2.9rem)] leading-[1.06] tracking-[-0.025em] text-ghost">
              A window on every request, measured the same way on both sides.
            </h2>
            <p className="mt-4 max-w-[46ch] text-[14px] leading-[1.8] text-ghost-muted">
              Priority is chosen when the request is raised and the window is attached at that moment. The
              console flags a request before it breaches, so a slipped commitment is visible while it can
              still be fixed rather than reconciled afterwards.
            </p>
            <Link
              href="/how-it-works"
              className="mt-6 inline-flex items-center gap-1.5 text-[12.5px] text-ghost transition-colors hover:text-ghost"
            >
              See the request lifecycle
              <ArrowUpRight aria-hidden className="size-3.5" strokeWidth={1.9} />
            </Link>
          </div>

          <div className="overflow-hidden rounded-2xl border border-hairline">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-hairline bg-obsidian-soft">
                  <th className="px-5 py-3 font-mono text-[9.5px] font-normal uppercase tracking-[0.16em] text-ghost-muted">
                    Priority
                  </th>
                  <th className="px-5 py-3 font-mono text-[9.5px] font-normal uppercase tracking-[0.16em] text-ghost-muted">
                    Window
                  </th>
                  <th className="px-5 py-3 font-mono text-[9.5px] font-normal uppercase tracking-[0.16em] text-ghost-muted">
                    What it covers
                  </th>
                </tr>
              </thead>
              <tbody>
                {COMMITMENTS.map((c) => (
                  <tr key={c.level} className="border-b border-hairline last:border-0 transition-colors hover:bg-obsidian-soft">
                    <td className="px-5 py-4 text-[13.5px] text-ghost">{c.level}</td>
                    <td className="whitespace-nowrap px-5 py-4 font-mono text-[12.5px] tabular-nums text-ghost">
                      {c.window}
                    </td>
                    <td className="px-5 py-4 text-[13px] leading-[1.6] text-ghost-muted">{c.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

  );
}

export function FaqBand() {
  return (
      <section className="border-b border-hairline py-20 sm:py-24" aria-label="Frequently asked questions">
        <div className="shell grid gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:gap-16">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ghost-muted">Questions</p>
            <h2 className="mt-3 font-display text-[clamp(1.9rem,3.4vw,2.9rem)] leading-[1.06] tracking-[-0.025em] text-ghost">
              The six that come up on every call.
            </h2>
            <p className="mt-4 max-w-[42ch] text-[14px] leading-[1.8] text-ghost-muted">
              Answered plainly, including the parts that are a constraint rather than a benefit.
            </p>
          </div>

          <dl className="divide-y divide-[var(--color-border-hairline)] border-y border-hairline">
            {FAQ.map((f) => (
              <div key={f.q} className="py-6 first:pt-0 last:pb-0">
                <dt className="font-display text-[1.05rem] leading-[1.35] tracking-[-0.01em] text-ghost">
                  {f.q}
                </dt>
                <dd className="mt-2.5 max-w-[62ch] text-[13.5px] leading-[1.75] text-ghost-muted">{f.a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
  );
}
