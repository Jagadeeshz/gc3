import { Check } from 'lucide-react';

/**
 * How a pod starts.
 *
 * Design Pickle's four-step onboarding, rewritten for this model: every step says
 * what the client does, not what the vendor does, and the last step ends with work
 * already in the queue rather than a promise about it.
 */

const STEPS = [
  {
    title: 'A scoping conversation',
    body: 'Thirty minutes on the outcome, not the org chart: what has to ship, how much of it, and by when. We size the pod from that, not from a rate card.',
    detail: 'You bring the outcome. We bring the composition.',
  },
  {
    title: 'Your pod and your pool',
    body: 'A named pod, a published credit pool and a delivery commitment per priority. The numbers are agreed before the first request, so nothing is renegotiated mid-quarter.',
    detail: 'One subscription. No seat arithmetic.',
  },
  {
    title: 'Meet the pod manager',
    body: 'The manager who owns your account is introduced before the work starts. They learn the brand, choose the specialists, and stay accountable for the output.',
    detail: 'One owner, named from day one.',
  },
  {
    title: 'Go live in the portal',
    body: 'Your workspace opens with the subscription, the roster and the request queue already in place. The first request goes in at kickoff and ships from the queue.',
    detail: 'No integrations to build.',
  },
] as const;

export function HowItWorks({ showHeader = true }: { readonly showHeader?: boolean } = {}) {
  return (
    <section id="how-it-works" className="border-b border-hairline bg-transparent-soft py-20 sm:py-24">
      <div className="shell">
        {showHeader ? (
          <div className="reveal max-w-[62ch]">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-emerald-300/90">
              How it works
            </p>
            <h2 className="mt-3 font-display text-[clamp(1.9rem,3.4vw,2.9rem)] leading-[1.06] tracking-[-0.025em] text-ghost">
              Four steps between this page and a working pod.
            </h2>
          </div>
        ) : null}

        <ol className="reveal-stagger mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <li
              key={step.title}
              className="b-surface flex flex-col rounded-[14px] border border-hairline bg-obsidian p-6"
            >
              <div className="flex items-center justify-between">
                <span className="figures font-mono text-[11px] tracking-[0.16em] text-ghost-muted">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span
                  aria-hidden="true"
                  className="h-px w-10 bg-[linear-gradient(90deg,transparent,var(--bindu-rim-spectrum-mid))]"
                />
              </div>

              <h3 className="mt-4 font-display text-[17px] leading-snug tracking-[-0.01em] text-ghost">
                {step.title}
              </h3>
              <p className="mt-2 flex-1 text-[12.5px] leading-[1.7] text-ghost-muted">{step.body}</p>

              <p className="mt-4 flex items-start gap-2 border-t border-hairline pt-4 text-[11.5px] text-ghost">
                <Check aria-hidden className="mt-0.5 size-3.5 shrink-0 text-emerald-300" strokeWidth={2.2} />
                {step.detail}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
