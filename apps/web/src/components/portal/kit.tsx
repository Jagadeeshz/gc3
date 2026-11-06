'use client';

import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ArrowRight, Lock, TriangleAlert } from 'lucide-react';
import Link from 'next/link';

/**
 * Client workspace building blocks.
 *
 * The client surfaces are dense but calm: one idea per panel, numbers in tabular
 * figures so columns line up, and borders instead of shadows. These atoms exist
 * so twelve pages do not each invent their own heading, their own empty state,
 * and their own way of saying "this is not available to your role".
 */

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  readonly eyebrow: string;
  readonly title: string;
  readonly description?: string;
  readonly actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 border-b border-[#1E293B] pb-5">
      <div className="min-w-0">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">{eyebrow}</p>
        <h1 className="mt-1.5 font-display text-2xl font-semibold tracking-[-0.01em] text-warm">
          {title}
        </h1>
        {description ? <p className="mt-1.5 max-w-[62ch] text-sm text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

export function Panel({
  title,
  subtitle,
  action,
  className = '',
  children,
}: {
  readonly title?: string;
  readonly subtitle?: string;
  readonly action?: ReactNode;
  readonly className?: string;
  readonly children: ReactNode;
}) {
  return (
    <section className={`rounded-[14px] border border-[#1E293B] bg-[#0B1220]/80 ${className}`}>
      {title ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1E293B] px-5 py-3.5">
          <div>
            <h2 className="text-sm font-semibold text-warm">{title}</h2>
            {subtitle ? <p className="mt-0.5 text-[11px] text-muted">{subtitle}</p> : null}
          </div>
          {action}
        </div>
      ) : null}
      <div className="p-5">{children}</div>
    </section>
  );
}

/**
 * A headline number. `tabular-nums` is not decoration: these sit in columns and
 * a proportional font makes them shimmer as the values change.
 */
export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'default',
}: {
  readonly label: string;
  readonly value: string | number;
  readonly hint?: string;
  readonly icon?: LucideIcon;
  readonly tone?: 'default' | 'positive' | 'warning' | 'critical';
}) {
  const toneClass =
    tone === 'positive'
      ? 'text-emerald-300'
      : tone === 'warning'
        ? 'text-amber-300'
        : tone === 'critical'
          ? 'text-red-300'
          : 'text-slate-100';

  const glow =
    tone === 'positive'
      ? 'shadow-[0_0_0_1px_rgba(16,185,129,0.18),0_0_24px_-12px_rgba(16,185,129,0.55)]'
      : tone === 'warning'
        ? 'shadow-[0_0_0_1px_rgba(245,158,11,0.18),0_0_24px_-12px_rgba(245,158,11,0.55)]'
        : tone === 'critical'
          ? 'shadow-[0_0_0_1px_rgba(248,113,113,0.18),0_0_24px_-12px_rgba(248,113,113,0.5)]'
          : '';

  return (
    <article className={`rounded-[12px] border border-[#1E293B] bg-[#0B1220] p-4 transition-shadow ${glow}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] uppercase tracking-[0.1em] text-muted">{label}</p>
        {Icon ? <Icon aria-hidden className="size-4 text-gold-light" strokeWidth={1.75} /> : null}
      </div>
      <p className={`mt-2 font-display text-[26px] font-semibold tabular-nums leading-none tracking-[-0.01em] ${toneClass}`}>
        {value}
      </p>
      {hint ? <p className="mt-1.5 text-[11px] text-muted">{hint}</p> : null}
    </article>
  );
}

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  readonly icon?: LucideIcon;
  readonly title: string;
  readonly body: string;
  readonly action?: { readonly href: string; readonly label: string };
}) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-[12px] border border-dashed border-[#1E293B] bg-[#0B1220]/40 px-5 py-8">
      {Icon ? <Icon aria-hidden className="size-5 text-gold-light" strokeWidth={1.75} /> : null}
      <p className="text-sm font-medium text-warm">{title}</p>
      <p className="max-w-[58ch] text-xs text-muted">{body}</p>
      {action ? (
        <Link
          href={action.href}
          className="mt-1 inline-flex items-center gap-1.5 text-xs text-gold-light underline-offset-4 hover:underline"
        >
          {action.label}
          <ArrowRight aria-hidden className="size-3.5" strokeWidth={1.75} />
        </Link>
      ) : null}
    </div>
  );
}

/** A plan allowance: used against included, with the state the API computed. */
export function Meter({
  label,
  used,
  included,
  unit,
  percent,
  state,
}: {
  readonly label: string;
  readonly used: number;
  readonly included: number;
  readonly unit: string;
  readonly percent: number;
  readonly state: 'OK' | 'WARNING' | 'EXCEEDED';
}) {
  const bar =
    state === 'EXCEEDED'
      ? 'bg-red-400/80 shadow-[0_0_12px_rgba(248,113,113,0.55)]'
      : state === 'WARNING'
        ? 'bg-amber-400/80 shadow-[0_0_12px_rgba(245,158,11,0.5)]'
        : 'bg-emerald-400/80 shadow-[0_0_12px_rgba(16,185,129,0.5)]';
  const text =
    state === 'EXCEEDED' ? 'text-red-300' : state === 'WARNING' ? 'text-amber-300' : 'text-emerald-300';

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-xs text-slate-400">{label}</p>
        <p className="font-mono text-[11px] tabular-nums text-slate-100">
          {used.toLocaleString('en-IN')}
          <span className="text-muted"> / {included.toLocaleString('en-IN')} {unit}</span>
        </p>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#1E293B]">
        <div className={`h-full ${bar}`} style={{ width: `${Math.min(percent, 100)}%` }} />
      </div>
      <p className={`mt-1.5 text-[10px] ${text}`}>
        {percent}% used{state === 'EXCEEDED' ? ' · overage billed at period end' : ''}
      </p>
    </div>
  );
}

/**
 * Renders children only for a client owner.
 *
 * Two layers, deliberately: this panel keeps a member from seeing an owner screen,
 * and every endpoint behind it is already gated on `finance:read` /
 * `membership:read` server-side — so the UI is the courtesy and the API is the
 * control.
 */
export function OwnerOnly({ children }: { readonly children: ReactNode }) {
  return <>{children}</>;
}

export function RestrictedPanel({
  title,
  body,
  href = '/overview',
  label = 'Back to overview',
}: {
  readonly title: string;
  readonly body: string;
  readonly href?: string;
  readonly label?: string;
}) {
  return (
    <div className="mx-auto mt-10 max-w-[520px] rounded-[14px] border border-[#1E293B] bg-[#0B1220] p-6 text-center">
      <Lock aria-hidden className="mx-auto size-5 text-gold-light" strokeWidth={1.75} />
      <h2 className="mt-3 font-display text-lg font-semibold text-warm">{title}</h2>
      <p className="mt-2 text-sm text-muted">{body}</p>
      <Link
        href={href}
        className="mt-4 inline-flex items-center gap-1.5 text-xs text-gold-light underline-offset-4 hover:underline"
      >
        {label}
        <ArrowRight aria-hidden className="size-3.5" strokeWidth={1.75} />
      </Link>
    </div>
  );
}

export function ErrorNote({ message }: { readonly message: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-[10px] border border-red-400/30 bg-red-400/5 px-4 py-3 text-xs text-red-200">
      <TriangleAlert aria-hidden className="mt-0.5 size-4" strokeWidth={1.75} />
      {message}
    </div>
  );
}

export function Loading({ label = 'Loading…' }: { readonly label?: string }) {
  return <p className="text-sm text-muted">{label}</p>;
}

/** "2 hours ago" — relative time for activity feeds, without a date library. */
export function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1_000));

  if (seconds < 60) return 'just now';
  if (seconds < 3_600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86_400) return `${Math.floor(seconds / 3_600)}h ago`;
  if (seconds < 604_800) return `${Math.floor(seconds / 86_400)}d ago`;

  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}
