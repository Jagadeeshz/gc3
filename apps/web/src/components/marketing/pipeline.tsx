'use client';

import { useRef, useState } from 'react';

interface Stage {
  readonly id: string;
  readonly label: string;
  readonly detail: string;
  readonly artefacts: readonly string[];
}

const STAGES: readonly Stage[] = [
  {
    id: 'direction',
    label: 'Direction / Context',
    detail:
      'Where leadership intent becomes a brief: the outcome, the constraints, and the decisions that cannot be delegated downward.',
    artefacts: ['Outcome statement', 'Constraint map', 'Decision owners'],
  },
  {
    id: 'foundation',
    label: 'Foundation / Knowledge',
    detail:
      'Domain context, architecture decisions and runbooks captured where the work happens — so the reasoning survives the people who had it.',
    artefacts: ['Architecture record', 'Runbooks', 'Context index'],
  },
  {
    id: 'synthesis',
    label: 'Analysis / Synthesis',
    detail:
      'Options weighed against real constraints, with the trade-offs written down. The recommendation arrives with its reasoning attached.',
    artefacts: ['Option set', 'Trade-off note', 'Recommendation'],
  },
  {
    id: 'review',
    label: 'Review Gate / Decision',
    detail:
      'An explicit decision point. Whoever owns the risk sees the trade-offs plainly, in one place, before anything is built.',
    artefacts: ['Decision log', 'Risk note', 'Sign-off'],
  },
  {
    id: 'execution',
    label: 'Execution / Action',
    detail:
      'Coordinated delivery with telemetry, review gates and evidence that the thing works in the environment it was built for.',
    artefacts: ['Delivery trace', 'Telemetry', 'Evidence packet'],
  },
];

/**
 * Five-stage execution pipeline. The connector fills to the selected stage, and
 * every stage is a real tab so the reveal works without motion, hover or pointer
 * precision.
 */
export function Pipeline() {
  const [active, setActive] = useState(0);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const stage = STAGES[active] ?? (STAGES[0] as Stage);

  function focusStage(next: number) {
    const index = (next + STAGES.length) % STAGES.length;
    setActive(index);
    tabRefs.current[index]?.focus();
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      focusStage(index + 1);
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      focusStage(index - 1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      focusStage(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      focusStage(STAGES.length - 1);
    }
  }

  return (
    <div className="grid gap-8">
      <div className="relative">
        <div aria-hidden="true" className="absolute inset-x-0 top-[13px] hidden h-px bg-hairline md:block" />
        <div
          aria-hidden="true"
          className="absolute left-0 top-[13px] hidden h-px bg-gradient-to-r from-gold/80 to-gold/30 transition-[width] duration-500 md:block"
          style={{ width: `${(active / (STAGES.length - 1)) * 100}%` }}
        />

        <div
          role="tablist"
          aria-label="Execution pipeline"
          aria-orientation="horizontal"
          className="relative grid gap-3 md:grid-cols-5 md:gap-4"
        >
          {STAGES.map((item, index) => {
            const selected = index === active;
            const passed = index <= active;
            return (
              <button
                key={item.id}
                ref={(node) => {
                  tabRefs.current[index] = node;
                }}
                type="button"
                role="tab"
                id={`stage-tab-${item.id}`}
                aria-selected={selected}
                aria-controls="stage-panel"
                tabIndex={selected ? 0 : -1}
                onClick={() => setActive(index)}
                onKeyDown={(event) => onKeyDown(event, index)}
                className="group flex items-start gap-3 text-left md:block"
              >
                <span
                  className={[
                    'mt-0 grid size-[26px] shrink-0 place-items-center rounded-full border font-mono text-[10px] transition-colors duration-200',
                    selected
                      ? 'border-gold/70 bg-gold/15 text-gold-light'
                      : passed
                        ? 'border-gold/30 bg-obsidian text-gold/70'
                        : 'border-hairline bg-obsidian text-ghost-muted group-hover:border-ghost-muted/60',
                  ].join(' ')}
                >
                  {index + 1}
                </span>
                <span
                  className={[
                    'block pt-0 text-[13px] leading-snug transition-colors duration-200 md:pt-3',
                    selected ? 'text-ghost' : 'text-ghost-muted group-hover:text-ghost',
                  ].join(' ')}
                >
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div
        id="stage-panel"
        role="tabpanel"
        aria-labelledby={`stage-tab-${stage.id}`}
        className="grid gap-px overflow-hidden rounded-[14px] border border-hairline bg-hairline sm:grid-cols-[minmax(0,1fr)_260px]"
      >
        <div className="bg-obsidian-soft p-6 sm:p-7">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-gold/80">
            Stage 0{active + 1} — {stage.label}
          </p>
          <p className="mt-3 max-w-[52ch] text-[14px] leading-[1.65] text-ghost-muted">{stage.detail}</p>
        </div>
        <div className="bg-obsidian-raised p-6 sm:p-7">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-ghost-muted">Capture</p>
          <ul className="mt-3 grid gap-2">
            {stage.artefacts.map((item) => (
              <li key={item} className="flex items-center gap-2 font-mono text-[11px] tracking-[0.02em] text-ghost-muted">
                <span aria-hidden="true" className="size-1 rounded-full bg-gold/60" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
