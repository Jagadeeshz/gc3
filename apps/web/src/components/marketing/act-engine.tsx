import { Cpu, Eye, GitBranch, Radar } from 'lucide-react';

/**
 * Act IV — the engine beneath.
 *
 * A node map, drawn as SVG because a diagram made of divs is a diagram that
 * breaks at the first zoom level. The connections use `draw-line`, which is
 * scroll-linked CSS: the map draws itself as it enters view and is fully present
 * for anyone who never scrolls that far, or who has motion turned off.
 *
 * NAMING NOTE: APRIL's role (Chief AI Officer) is stated by the brief. PRISM,
 * ARTUS and APARA are named in the platform narrative, so they are labelled by
 * the layer they occupy and the kind of work that layer does — not with invented
 * product specifications, which this page has no right to publish.
 */

const MODULES = [
  { name: 'PRISM', role: 'Context', icon: Eye },
  { name: 'ARTUS', role: 'Orchestration', icon: GitBranch },
  { name: 'APARA', role: 'Evidence', icon: Radar },
] as const;

export function ActEngine() {
  return (
    <section
      id="act-engine"
      className="relative overflow-hidden border-b border-hairline bg-obsidian-soft py-20 sm:py-28"
    >
      <div className="shell grid gap-12 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] lg:gap-16">
        <div className="stage rise">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-emerald-300/90">
            Act IV — The engine beneath
          </p>
          <h2 className="mt-4 font-display text-[clamp(1.9rem,3.4vw,2.9rem)] leading-[1.06] tracking-[-0.02em] text-ghost">
            A pod is the visible layer. The engine is why it holds.
          </h2>
          <p className="mt-5 max-w-[46ch] text-[14px] leading-[1.8] text-ghost-muted">
            Behind every pod runs the platform GC³ builds for itself: an accountable AI officer, a
            context layer, an orchestration layer and an evidence layer. The pod you buy is the part
            you can see.
          </p>

          <ul className="mt-7 grid gap-px overflow-hidden rounded-[12px] border border-hairline bg-hairline">
            {MODULES.map((module) => {
              const Icon = module.icon;

              return (
                <li
                  key={module.name}
                  className="flex items-center justify-between gap-3 bg-obsidian px-3.5 py-2.5"
                >
                  <span className="inline-flex items-center gap-2">
                    <Icon aria-hidden className="size-3.5 text-emerald-300" strokeWidth={1.75} />
                    <span className="font-mono text-[11px] tracking-[0.08em] text-ghost">
                      {module.name}
                    </span>
                  </span>
                  <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-ghost-muted">
                    {module.role}
                  </span>
                </li>
              );
            })}
          </ul>

          <p className="mt-5 text-[10px] leading-relaxed text-ghost-muted/80">
            APRIL is the Chief AI Officer defined in the platform brief. PRISM, ARTUS and APARA are
            labelled here by the layer they occupy — this page publishes no specification it cannot
            support.
          </p>
        </div>

        <div className="fade-scale">
          <div className="overflow-hidden rounded-[16px] border border-hairline bg-obsidian p-4 sm:p-6">
            <svg
              viewBox="0 0 720 440"
              role="img"
              aria-label="Engine map: APRIL as Chief AI Officer above the PRISM, ARTUS and APARA layers, which feed the capability pods."
              className="h-auto w-full"
            >
              <defs>
                <linearGradient id="engine-line" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#34d399" stopOpacity="0.55" />
                  <stop offset="100%" stopColor="#1e293b" stopOpacity="0.9" />
                </linearGradient>
              </defs>

              {/* Connections: drawn on scroll. */}
              <g fill="none" stroke="url(#engine-line)" strokeWidth="1.5">
                <path className="draw-line" style={{ ['--dash' as string]: 220 }} d="M360 108 L360 168" />
                <path className="draw-line" style={{ ['--dash' as string]: 260 }} d="M360 208 L180 268" />
                <path className="draw-line" style={{ ['--dash' as string]: 200 }} d="M360 208 L360 268" />
                <path className="draw-line" style={{ ['--dash' as string]: 260 }} d="M360 208 L540 268" />
                <path className="draw-line" style={{ ['--dash' as string]: 240 }} d="M180 322 L360 372" />
                <path className="draw-line" style={{ ['--dash' as string]: 200 }} d="M360 322 L360 372" />
                <path className="draw-line" style={{ ['--dash' as string]: 240 }} d="M540 322 L360 372" />
              </g>

              {/* Travelling signals: the engine is alive, not a diagram. */}
              <g fill="none" stroke="#34d399" strokeWidth="1.5" strokeLinecap="round" opacity="0.75">
                <path className="signal" d="M360 108 L360 168" />
                <path className="signal" d="M360 208 L180 268" />
                <path className="signal" d="M360 208 L540 268" />
                <path className="signal" d="M180 322 L360 372" />
                <path className="signal" d="M540 322 L360 372" />
              </g>

              {/* APRIL — the accountable layer. */}
              <g>
                <rect x="250" y="52" width="220" height="56" rx="12" fill="#0e1523" stroke="#34d399" strokeOpacity="0.45" />
                <text x="360" y="76" textAnchor="middle" fill="#e8eef7" fontSize="15" fontFamily="ui-monospace, monospace" letterSpacing="1.5">
                  APRIL
                </text>
                <text x="360" y="94" textAnchor="middle" fill="#34d399" fontSize="9.5" fontFamily="ui-monospace, monospace" letterSpacing="1.6">
                  CHIEF AI OFFICER
                </text>
              </g>

              {/* Engine modules. */}
              {[
                { x: 96, name: 'PRISM', role: 'CONTEXT' },
                { x: 276, name: 'ARTUS', role: 'ORCHESTRATION' },
                { x: 456, name: 'APARA', role: 'EVIDENCE' },
              ].map((node, index) => (
                <g key={node.name}>
                  <rect
                    x={node.x}
                    y="268"
                    width="168"
                    height="54"
                    rx="10"
                    fill="#0b111c"
                    stroke="#1e293b"
                    className="heartbeat"
                    style={{ animationDelay: `${index * 0.6}s` }}
                  />
                  <text
                    x={node.x + 84}
                    y="292"
                    textAnchor="middle"
                    fill="#e8eef7"
                    fontSize="13"
                    fontFamily="ui-monospace, monospace"
                    letterSpacing="1.4"
                  >
                    {node.name}
                  </text>
                  <text
                    x={node.x + 84}
                    y="309"
                    textAnchor="middle"
                    fill="#64748b"
                    fontSize="9"
                    fontFamily="ui-monospace, monospace"
                    letterSpacing="1.4"
                  >
                    {node.role}
                  </text>
                </g>
              ))}

              {/* The pod layer the engine serves. */}
              <g>
                <rect x="96" y="372" width="528" height="48" rx="10" fill="#0e1523" stroke="#1e293b" />
                <text x="360" y="394" textAnchor="middle" fill="#e8eef7" fontSize="12.5" fontFamily="ui-monospace, monospace" letterSpacing="1.6">
                  CAPABILITY PODS
                </text>
                <text x="360" y="409" textAnchor="middle" fill="#64748b" fontSize="9" fontFamily="ui-monospace, monospace" letterSpacing="1.4">
                  ONE MANAGER · SPECIALISTS · PAIRED AGENTS
                </text>
              </g>
            </svg>

            <p className="mt-3 flex items-center justify-center gap-2 border-t border-hairline pt-3 font-mono text-[9px] uppercase tracking-[0.16em] text-ghost-muted">
              <Cpu aria-hidden className="size-3 text-emerald-300" strokeWidth={1.75} />
              The same engine runs every pod you subscribe to
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
