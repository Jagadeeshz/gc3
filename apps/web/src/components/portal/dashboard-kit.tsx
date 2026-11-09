'use client';

import type { LucideIcon } from 'lucide-react';

/**
 * Dashboard kit: the pieces every signed-in surface shares.
 *
 * Two things here, and both exist to be reused rather than re-drawn per page:
 *
 *  1. GradientKpi — a metric card tinted with one prism hue. The tint is a translucent wash, not
 *     a solid fill, so the card still reads as a panel on the dark ground; a saturated block of
 *     colour on this product would look like a chart, not a number.
 *  2. Panel + BarSeries + LineSeries — a titled panel and two chart bodies. No chart library:
 *     these are divs and one polyline, which keeps the bundle honest and means every value comes
 *     from the caller's own data.
 *
 * Colours come from the BINDU raga families. Nothing here invents a number, and nothing here is
 * styled per page.
 */

export type KpiTint = 'teal' | 'violet' | 'gold' | 'sky' | 'rose' | 'prism';

const TINTS: Record<KpiTint, { wash: string; edge: string; ink: string }> = {
  teal: {
    wash: 'linear-gradient(145deg, rgba(0,221,170,0.20), rgba(0,221,170,0.03) 62%, transparent)',
    edge: 'rgba(0,221,170,0.32)',
    ink: '#00ddaa',
  },
  violet: {
    wash: 'linear-gradient(145deg, rgba(123,0,255,0.26), rgba(123,0,255,0.05) 62%, transparent)',
    edge: 'rgba(123,0,255,0.34)',
    ink: '#a15cff',
  },
  gold: {
    wash: 'linear-gradient(145deg, rgba(255,136,0,0.20), rgba(255,136,0,0.03) 62%, transparent)',
    edge: 'rgba(255,136,0,0.30)',
    ink: '#ff8800',
  },
  sky: {
    wash: 'linear-gradient(145deg, rgba(0,153,255,0.20), rgba(0,153,255,0.03) 62%, transparent)',
    edge: 'rgba(0,153,255,0.30)',
    ink: '#0099ff',
  },
  rose: {
    wash: 'linear-gradient(145deg, rgba(255,34,0,0.18), rgba(255,34,0,0.03) 62%, transparent)',
    edge: 'rgba(255,34,0,0.28)',
    ink: '#ff4422',
  },
  prism: {
    wash: 'linear-gradient(145deg, rgba(0,221,170,0.16), rgba(123,0,255,0.14) 55%, rgba(255,136,0,0.10))',
    edge: 'rgba(255,255,255,0.16)',
    ink: '#ededed',
  },
};

export function GradientKpi({
  label,
  value,
  sub,
  icon: Icon,
  tint = 'teal',
  trailing,
}: {
  readonly label: string;
  readonly value: string | number;
  readonly sub?: string;
  readonly icon?: LucideIcon;
  readonly tint?: KpiTint;
  readonly trailing?: string;
}) {
  const tone = TINTS[tint];

  return (
    <div
      className="relative overflow-hidden rounded-[14px] border p-4"
      style={{ background: tone.wash, borderColor: tone.edge }}
    >
      {/* top rim: the card reads as lit from above rather than as a colour block */}
      <span
        aria-hidden="true"
        className="absolute inset-x-0 top-0 h-px"
        style={{ background: `linear-gradient(to right, transparent, ${tone.ink}, transparent)`, opacity: 0.55 }}
      />

      <div className="flex items-start justify-between gap-3">
        {Icon ? (
          <span
            className="grid size-8 place-items-center rounded-lg border border-white/10 bg-black/25"
            style={{ color: tone.ink }}
          >
            <Icon aria-hidden className="size-4" strokeWidth={1.9} />
          </span>
        ) : (
          <span />
        )}
        {trailing ? (
          <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-white/55">{trailing}</span>
        ) : null}
      </div>

      <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.14em] text-white/55">{label}</p>
      <p className="mt-1 font-display text-[24px] font-semibold leading-none tabular-nums text-warm">
        {value}
      </p>
      {sub ? <p className="mt-1.5 text-[11px] leading-snug text-white/60">{sub}</p> : null}
    </div>
  );
}

export function ChartPanel({
  title,
  value,
  action,
  children,
  className,
}: {
  readonly title: string;
  readonly value?: string;
  readonly action?: React.ReactNode;
  readonly children: React.ReactNode;
  readonly className?: string;
}) {
  return (
    <section
      className={`rounded-[14px] border border-white/10 bg-[rgba(12,16,32,0.55)] p-4 ${className ?? ''}`}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-white/55">{title}</p>
        <div className="flex items-center gap-3">
          {value ? (
            <span className="font-display text-[15px] font-semibold tabular-nums text-warm">{value}</span>
          ) : null}
          {action}
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** Vertical bars. Values are relative to the series maximum — never absolute pixels. */
export function BarSeries({
  data,
  tint = 'teal',
  height = 128,
}: {
  readonly data: readonly { label: string; value: number }[];
  readonly tint?: KpiTint;
  readonly height?: number;
}) {
  const max = Math.max(1, ...data.map((item) => item.value));
  const ink = TINTS[tint].ink;

  return (
    <div>
      <div className="flex items-end gap-2" style={{ height }}>
        {data.map((item) => {
          const filled = item.value === 0 ? 0 : Math.max(6, (item.value / max) * 100);

          return (
            <div key={item.label} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
              <span className="font-mono text-[9px] tabular-nums text-white/45">{item.value}</span>
              <div
                className="w-full max-w-[52px] rounded-t-[4px] transition-[height] duration-500"
                style={{
                  height: `${filled}%`,
                  background:
                    item.value === 0
                      ? 'rgba(255,255,255,0.06)'
                      : `linear-gradient(to top, ${ink}22, ${ink}cc)`,
                  minHeight: item.value === 0 ? 3 : undefined,
                }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex gap-2">
        {data.map((item) => (
          <span
            key={item.label}
            className="min-w-0 flex-1 truncate text-center font-mono text-[8px] uppercase tracking-[0.1em] text-white/40"
          >
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/** A single line with its area. Non-scaling stroke, so the line stays 1.5px at any width. */
export function LineSeries({
  data,
  tint = 'teal',
  height = 128,
}: {
  readonly data: readonly { label: string; value: number }[];
  readonly tint?: KpiTint;
  readonly height?: number;
}) {
  const ink = TINTS[tint].ink;
  const max = Math.max(1, ...data.map((item) => item.value));
  const step = data.length > 1 ? 100 / (data.length - 1) : 100;

  const points = data.map((item, index) => {
    const x = data.length > 1 ? index * step : 50;
    const y = 100 - (item.value / max) * 100;
    return `${x},${Math.min(98, Math.max(2, y))}`;
  });

  return (
    <div>
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        style={{ height }}
        className="w-full overflow-visible"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={`line-fill-${tint}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={ink} stopOpacity="0.28" />
            <stop offset="100%" stopColor={ink} stopOpacity="0" />
          </linearGradient>
        </defs>

        <polygon points={`0,100 ${points.join(' ')} 100,100`} fill={`url(#line-fill-${tint})`} />
        <polyline
          points={points.join(' ')}
          fill="none"
          stroke={ink}
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        {data.map((item, index) => {
          const x = data.length > 1 ? index * step : 50;
          const y = Math.min(98, Math.max(2, 100 - (item.value / max) * 100));

          return (
            <circle
              key={item.label}
              cx={x}
              cy={y}
              r="1.6"
              fill={ink}
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
      </svg>

      <div className="mt-2 flex justify-between">
        {data.map((item) => (
          <span
            key={item.label}
            className="font-mono text-[8px] uppercase tracking-[0.1em] text-white/40"
          >
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}
