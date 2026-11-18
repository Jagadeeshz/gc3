import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { BookDemoTrigger } from './book-demo';

/**
 * The close.
 *
 * Two panels, two different intents — the ServiceNow ending: one path for a reader
 * who wants a conversation, one for a reader who wants to see the product. They are
 * not the same door with two labels, so they do not look the same.
 */
export function CtaBand() {
  return (
    <section id="contact" className="relative overflow-hidden border-b border-hairline bg-transparent py-20 sm:py-24">
      <div aria-hidden="true" className="blueprint pointer-events-none absolute inset-0 opacity-[0.14]" />
      <div className="shell relative">
        <div className="reveal max-w-[64ch]">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-emerald-300/90">
            Start here
          </p>
          <h2 className="mt-3 font-display text-[clamp(2rem,3.8vw,3.1rem)] leading-[1.04] tracking-[-0.025em] text-ghost">
            One pod. One subscription. Zero operational overhead.
          </h2>
          <p className="mt-5 text-[14px] leading-[1.8] text-ghost-muted">
            Start from the capability you need. The pod arrives composed, the credit pool is published,
            and the team is already standing.
          </p>
        </div>

        <div className="reveal-stagger mt-10 grid gap-4 lg:grid-cols-2">
          <div className="flex flex-col justify-between gap-6 rounded-[14px] border border-hairline bg-obsidian-soft p-6 sm:p-7">
            <div>
              <h3 className="font-display text-[20px] leading-snug tracking-[-0.01em] text-ghost">
                Talk to an expert
              </h3>
              <p className="mt-2 max-w-[46ch] text-[12.5px] leading-[1.7] text-ghost-muted">
                Thirty minutes on the outcome, the composition and the pool. You leave with a pod and a
                number, not a follow-up email.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <BookDemoTrigger label="Book a demo" />
              <Link
                href="/pricing"
                className="inline-flex items-center gap-1.5 text-[12px] text-ghost-muted transition-colors hover:text-ghost"
              >
                See published pricing
                <ArrowUpRight aria-hidden className="size-3.5" strokeWidth={1.9} />
              </Link>
            </div>
          </div>

          <div className="flex flex-col justify-between gap-6 rounded-[14px] border border-hairline bg-obsidian-soft p-6 sm:p-7">
            <div>
              <h3 className="font-display text-[20px] leading-snug tracking-[-0.01em] text-ghost">
                See it in action
              </h3>
              <p className="mt-2 max-w-[46ch] text-[12.5px] leading-[1.7] text-ghost-muted">
                Sign in to the client workspace: your subscription, requests, deliverables and invoices,
                scoped to your organisation and nothing else.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-full border border-ghost/30 px-4 py-2 text-[12.5px] font-medium text-ghost transition-colors hover:border-ghost/60"
              >
                Enter the portal
                <ArrowUpRight aria-hidden className="size-3.5" strokeWidth={1.9} />
              </Link>
              <Link
                href="/how-it-works"
                className="inline-flex items-center gap-1.5 text-[12px] text-ghost-muted transition-colors hover:text-ghost"
              >
                How a pod starts
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
