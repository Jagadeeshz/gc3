import { Bot, Crown, Link2, UserRound } from 'lucide-react';

/**
 * Act II — the paradigm shift.
 *
 * The reveal is typographic, not animated: the argument lands by being stated
 * plainly at scale. Motion only brings it in.
 *
 * The hybrid workforce figure is built from the pod data's own shape — one
 * manager, N specialists, one paired agent per specialist — which is why the
 * specialist count here is a variable and not a drawing.
 */

const PILLARS = [
  {
    label: 'One pod',
    line: 'A standing team assembled around one outcome, with one owner.',
  },
  {
    label: 'One subscription',
    line: 'A monthly credit pool. No seat arithmetic, no licence renewals.',
  },
  {
    label: 'Zero operational overhead',
    line: 'No integrations to own, no vendor layers between you and the work.',
  },
] as const;

/** A specialist and the agent paired to them, drawn as one unit. */
function SpecialistAgentPair({ index }: { readonly index: number }) {
  return (
    <div className="group/pair relative flex items-stretch gap-px overflow-hidden rounded-[10px] border border-hairline bg-hairline transition-colors duration-200 hover:border-emerald-400/35">
      <div className="flex flex-1 items-center gap-2 bg-obsidian-raised px-3 py-2.5">
        <UserRound aria-hidden className="size-3.5 text-ghost-muted transition-colors group-hover/pair:text-ghost" strokeWidth={1.75} />
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ghost-muted transition-colors group-hover/pair:text-ghost">
          Specialist {index}
        </span>
      </div>
      {/* The pairing marker: one human, one agent, one accountable unit. */}
      <div className="flex items-center gap-1 bg-obsidian px-1.5">
        <span className="size-1 rounded-full bg-emerald-400/80" />
        <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-emerald-300/80">1:1</span>
      </div>
      <div className="flex items-center gap-2 bg-emerald-400/[0.07] px-3 py-2.5 transition-colors group-hover/pair:bg-emerald-400/[0.13]">
        <Bot aria-hidden className="size-3.5 text-emerald-300" strokeWidth={1.75} />
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-emerald-300">
          Agent {index}
        </span>
      </div>
    </div>
  );
}

export function ActParadigm() {
  return (
    <section
      id="act-paradigm"
      className="act-anchor relative overflow-hidden border-b border-hairline bg-obsidian-soft py-20 sm:py-28"
    >
      {/* Convergence: Act I's scattered grid becomes one line. A single 1px spine on the
          centre line, one accent instead of nine, feathered at both ends so it reads as the
          story drawing down the page rather than a divider. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-1/2 hidden w-px -translate-x-1/2 bg-gradient-to-b from-transparent via-[var(--spectrum-accent)] to-transparent opacity-60 lg:block"
      />
      <div className="shell relative z-10 grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)] lg:gap-16">
        <div className="grid content-start gap-10">
          <div className="fade-scale">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-emerald-300/90">
              Act II — The paradigm shift
            </p>
            <h2 className="mt-4 font-display text-[clamp(2rem,4vw,3.4rem)] leading-[1.02] tracking-[-0.025em] text-ghost">
              Enterprise AI fails on
              <span className="block text-ghost/55">operational bloat.</span>
              <span className="block">Not on weak models.</span>
            </h2>
          </div>

          <p className="fade-scale max-w-[58ch] text-[15px] leading-[1.85] text-ghost-muted">
            GC³ — Global Capability Center 3.0 — starts from the opposite end. Instead of assembling
            tools and hoping a team forms around them, one pod is composed around the outcome and one
            subscription pays for it. The capability arrives whole.
          </p>

          <div className="grid gap-px overflow-hidden rounded-[14px] border border-hairline bg-hairline sm:grid-cols-3">
            {PILLARS.map((pillar, index) => (
              <div key={pillar.label} className="fade-scale bg-obsidian-raised p-5">
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-emerald-300/80">
                  0{index + 1}
                </p>
                <h3 className="mt-3 text-[15px] font-medium tracking-[-0.01em] text-ghost">
                  {pillar.label}
                </h3>
                <p className="mt-2 text-[12px] leading-[1.75] text-ghost-muted">{pillar.line}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="stage">
          <div className="rise overflow-hidden rounded-[16px] border border-hairline bg-obsidian p-5 sm:p-7">
            <div className="flex items-center justify-between">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-ghost-muted">
                Hybrid workforce
              </p>
              <span className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.12em] text-emerald-300">
                Human + supervised
              </span>
            </div>

            <div className="mt-5 flex items-center gap-3 rounded-[12px] border border-hairline bg-obsidian-raised px-4 py-3.5">
              <span className="grid size-9 place-items-center rounded-[9px] border border-hairline bg-obsidian text-ghost">
                <Crown aria-hidden className="size-4" strokeWidth={1.75} />
              </span>
              <div>
                <p className="text-[13px] font-medium text-ghost">1 Manager</p>
                <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-ghost-muted">
                  Accountable for the outcome
                </p>
              </div>
            </div>

            <div className="relative mt-4 pl-6">
              <span
                aria-hidden="true"
                className="absolute left-2 top-0 h-full w-px bg-hairline"
              />
              <div className="grid gap-2">
                {[1, 2].map((index) => (
                  <div key={index} className="relative">
                    <span
                      aria-hidden="true"
                      className="absolute -left-4 top-1/2 h-px w-4 bg-hairline"
                    />
                    <SpecialistAgentPair index={index} />
                  </div>
                ))}
                <div className="relative">
                  <span aria-hidden="true" className="absolute -left-4 top-1/2 h-px w-4 bg-hairline" />
                  <div className="flex items-center justify-between rounded-[10px] border border-dashed border-hairline px-3 py-2.5">
                    <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ghost-muted">
                      … N specialists
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-emerald-300">
                      each paired with 1 agent
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-hairline pt-4">
              <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-ghost-muted">
                1 Manager : N Specialists : 1 Agent each
              </span>
              <span className="inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.14em] text-emerald-300/80">
                <span className="size-1 rounded-full bg-emerald-400/80" />
                paired
              </span>
            </div>

            <p className="mt-4 flex items-start gap-2 border-t border-hairline pt-4 text-[11px] leading-relaxed text-ghost-muted">
              <Link2 aria-hidden className="mt-0.5 size-3.5 shrink-0 text-emerald-300" strokeWidth={1.75} />
              Every agent works against a named specialist and a human gate — the pairing is the
              control, not the disclaimer.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
