import type { HTMLAttributes } from 'react';
import { cn } from './cn';

export type BadgeTone = 'gold' | 'neutral' | 'positive' | 'critical';

const TONE_CLASS: Record<BadgeTone, string> = {
  gold: 'border-gold/40 bg-gold/15 text-gold-light',
  neutral: 'border-white/15 bg-white/5 text-muted',
  positive: 'border-emerald-400/35 bg-emerald-400/10 text-emerald-300',
  critical: 'border-red-400/35 bg-red-400/10 text-red-300',
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  readonly tone?: BadgeTone;
}

export function Badge({ tone = 'neutral', className, children, ...rest }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1',
        'font-mono text-[10px] uppercase tracking-[0.12em] whitespace-nowrap',
        TONE_CLASS[tone],
        className,
      )}
      {...rest}
    >
      {children}
    </span>
  );
}
