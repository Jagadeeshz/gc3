import { AlertTriangle, Boxes, FileX2, Layers3, UserX } from 'lucide-react';

/**
 * Act I — The enterprise AI bottleneck.
 *
 * The visual is the argument: forty separate licences, no shared memory. It is
 * drawn in DOM because forty tiles cost nothing to paint and stay crisp at any
 * zoom — a bitmap would have been heavier and worse.
 */

const LICENCES = Array.from({ length: 40 }, (_, index) => index);

const FRICTIONS = [
  {
    icon: FileX2,
    title: 'Forty licences, forty contracts',
    body: 'Each tool procured on its own paper, renewed on its own date, governed by its own terms.',
  },
  {
    icon: UserX,
    title: 'Hires without a spine',
    body: 'A specialist arrives, learns the domain, then leaves and takes the context with them.',
  },
  {
    icon: Layers3,
    title: 'Integrations nobody owns',
    body: 'The glue between the tools becomes a system in itself, maintained by no one in particular.',
  },
] as const;

export function ActProblem() {
  return (
    <section id="act-problem" className="act-anchor relative border-b border-hairline bg-obsidian py-20 sm:py-28">
      <div className="shell grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)] lg:gap-16">
        <div className="stage rise">
          <div className="relative overflow-hidden rounded-[16px] border border-hairline bg-obsidian-soft p-5 sm:p-7">
            <div className="flex items-center justify-between">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ghost-muted">
                Licence estate
              </p>
              <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-amber-300">
                40 tools
              </span>
            </div>

            <div className="group/estate mt-5 grid grid-cols-8 gap-1.5" aria-hidden="true">
              {LICENCES.map((index) => (
                <span
                  key={index}
                  style={{ opacity: 0.55 + (index % 7) * 0.08 }}
                  className="aspect-square rounded-[3px] border border-ghost/15 bg-ghost/[0.07] transition-[background-color,border-color,transform,opacity] duration-200 ease-out hover:scale-[1.25] hover:border-amber-400/70 hover:bg-amber-400/25 hover:opacity-100 group-hover/estate:opacity-55"
                />
              ))}
            </div>
            <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.14em] text-ghost-muted/70">
              Hover any tile — forty separate decisions, none of them shared
            </p>

            <div className="mt-6 grid gap-2 border-t border-hairline pt-5">
              {[
                ['Seats procured', '40'],
                ['Systems of record', '9'],
                ['Shared context', '0'],
              ].map(([label, value]) => (
                <div key={label} className="flex items-baseline justify-between gap-3">
                  <span className="text-[11px] text-ghost-muted">{label}</span>
                  <span
                    className={`font-mono text-sm tabular-nums ${
                      value === '0' ? 'text-amber-300' : 'text-ghost'
                    }`}
                  >
                    {value}
                  </span>
                </div>
              ))}
            </div>

            <p className="mt-5 flex items-start gap-2 rounded-[10px] border border-amber-400/20 bg-amber-400/[0.06] px-3 py-2 text-[11px] leading-relaxed text-amber-200/90">
              <AlertTriangle aria-hidden className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.75} />
              Nine systems of record and not one shared memory. Every handoff pays the same toll again.
            </p>
          </div>
        </div>

        <div className="grid content-start gap-10">
          <div className="fade-scale">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-emerald-300/90">
              Act I — The bottleneck
            </p>
            <h2 className="mt-4 font-display text-[clamp(1.9rem,3.6vw,3rem)] leading-[1.06] tracking-[-0.02em] text-ghost">
              Buying more AI has become the problem.
            </h2>
            <p className="mt-5 max-w-[54ch] text-[14px] leading-[1.8] text-ghost-muted">
              An enterprise arrives at AI the way it arrived at software: one licence at a time. Forty
              tools, forty procurement cycles, and a workforce that has to be taught the same context
              over and over because nothing carries it forward.
            </p>
          </div>

          {FRICTIONS.map((friction, index) => {
            const Icon = friction.icon;

            return (
              <div key={friction.title} className="fade-scale">
                <div className="flex items-center gap-2.5">
                  <span className="grid size-8 place-items-center rounded-[9px] border border-hairline bg-obsidian-soft text-amber-300">
                    <Icon aria-hidden className="size-4" strokeWidth={1.75} />
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ghost-muted">
                    Friction 0{index + 1}
                  </span>
                </div>
                <h3 className="mt-3 text-[17px] font-medium tracking-[-0.01em] text-ghost">
                  {friction.title}
                </h3>
                <p className="mt-2 max-w-[52ch] text-[13px] leading-[1.8] text-ghost-muted">
                  {friction.body}
                </p>
              </div>
            );
          })}

          <p className="flex items-start gap-2 border-t border-hairline pt-6 text-[13px] leading-relaxed text-ghost-muted">
            <Boxes aria-hidden className="mt-0.5 size-4 shrink-0 text-ghost-muted" strokeWidth={1.75} />
            <span>
              The cost was never the model. It was the estate built around it —{' '}
              <span className="text-ghost">operational bloat, compounding quietly.</span>
            </span>
          </p>
        </div>
      </div>
    </section>
  );
}
