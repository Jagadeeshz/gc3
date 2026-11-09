'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { BarChart3, CircleAlert, Clock, Gauge, TrendingUp, Users } from 'lucide-react';
import type { AnalyticsReport } from '@gc3/types';
import { ApiClientError, fetchAnalytics } from '@/lib/api-client';
import { useSession } from '@/lib/session-context';

/**
 * Executive analytics (Phase 5).
 *
 * Four questions, in the order an owner asks them: how fast do we deliver, how
 * much is coming through, how well are the pods performing, and are we growing.
 *
 * The charts are plain divs with proportional heights. A charting library would
 * add a dependency and a client-side bundle for four bar charts; the numbers are
 * already exact in the API, so the renderer only has to not lie about them.
 */
const WINDOWS = [7, 30, 90, 180, 365] as const;

function hours(value: number | null): string {
  if (value === null) {
    return '—';
  }

  if (value < 48) {
    return `${value.toFixed(1)}h`;
  }

  return `${(value / 24).toFixed(1)}d`;
}

function percent(value: number | null): string {
  return value === null ? '—' : `${value.toFixed(1)}%`;
}

export default function AnalyticsPage() {
  const { session } = useSession();
  const token = session?.accessToken;

  const [report, setReport] = useState<AnalyticsReport | null>(null);
  const [windowDays, setWindowDays] = useState<number>(90);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (days: number) => {
      if (!token) {
        return;
      }

      setLoading(true);
      setError(null);

      try {
        setReport(await fetchAnalytics(token, days));
      } catch (caught) {
        setError(
          caught instanceof ApiClientError
            ? caught.status === 403
              ? 'Analytics is a platform report: it needs operations access (ops:read).'
              : caught.message
            : 'Could not load analytics.',
        );
      } finally {
        setLoading(false);
      }
    },
    [token],
  );

  useEffect(() => {
    void load(windowDays);
  }, [load, windowDays]);

  if (error) {
    return (
      <div className="flex items-start gap-3 rounded-[14px] border border-red-400/30 bg-red-400/5 px-4 py-3 text-sm text-red-200">
        <CircleAlert aria-hidden className="mt-0.5 size-4" strokeWidth={1.75} />
        <div>
          {error}
          <Link href="/ops" className="ml-2 text-gold-light underline-offset-4 hover:underline">
            Back to operations
          </Link>
        </div>
      </div>
    );
  }

  if (loading && !report) {
    return <p className="text-sm text-muted">Loading analytics…</p>;
  }

  if (!report) {
    return <p className="text-sm text-muted">No analytics available.</p>;
  }

  const peakThroughput = Math.max(
    1,
    ...report.throughput.map((bucket) => Math.max(bucket.created, bucket.closed)),
  );
  const peakGrowth = Math.max(1, ...report.tenantGrowth.map((row) => row.newTenants));

  return (
    <div className="grid gap-7">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
            Platform · Analytics
          </p>
          <h1 className="mt-1 font-display text-2xl font-semibold text-warm">
            Executive analytics
          </h1>
          <p className="mt-1 text-sm text-muted">
            Delivery speed, throughput, pod performance and growth — window of the last{' '}
            {report.windowDays} days, generated {new Date(report.generatedAt).toLocaleString()}.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {WINDOWS.map((days) => (
            <button
              key={days}
              type="button"
              onClick={() => setWindowDays(days)}
              className={[
                'rounded-lg border px-2.5 py-1 text-[11px] transition-colors',
                days === windowDays
                  ? 'border-gold/50 bg-gold/15 text-gold-light'
                  : 'border-white/15 text-muted hover:text-warm',
              ].join(' ')}
            >
              {days}d
            </button>
          ))}
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            label: 'Avg turnaround',
            value: hours(report.turnaround.avgHours),
            hint: `${report.turnaround.sampled} closed in window`,
            icon: Clock,
          },
          {
            label: 'Median turnaround',
            value: hours(report.turnaround.medianHours),
            hint: `p90 ${hours(report.turnaround.p90Hours)}`,
            icon: BarChart3,
          },
          {
            label: 'On-time delivery',
            value: percent(report.turnaround.onTimeRate),
            hint: `${report.turnaround.onTime} met · ${report.turnaround.late} missed`,
            icon: Gauge,
          },
          {
            label: 'Tenants',
            value: String(report.totals.tenants),
            hint: `${report.totals.activeTenants} active · ${report.totals.pods} pods`,
            icon: Users,
          },
        ].map((card) => {
          const Icon = card.icon;

          return (
            <article key={card.label} className="rounded-[14px] border border-white/10 bg-white/[0.02] p-4">
              <div className="flex items-center justify-between">
                <p className="text-[11px] text-muted">{card.label}</p>
                <Icon aria-hidden className="size-4 text-gold-light" strokeWidth={1.75} />
              </div>
              <p className="mt-2 font-display text-xl font-semibold text-warm">{card.value}</p>
              <p className="mt-1 text-[11px] text-muted">{card.hint}</p>
            </article>
          );
        })}
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-sm font-semibold text-warm">
            Request throughput — last 8 weeks
          </h2>
          <div className="flex items-center gap-4 text-[10px] uppercase tracking-[0.12em] text-muted">
            <span className="flex items-center gap-1.5">
              <span className="inline-block size-2 rounded-sm bg-gold/80" /> created
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block size-2 rounded-sm bg-emerald-400/70" /> closed
            </span>
          </div>
        </div>

        <div className="mt-5 flex items-end gap-3">
          {report.throughput.map((bucket) => (
            <div key={bucket.bucket} className="flex flex-1 flex-col items-center gap-1">
              <div className="flex h-32 w-full items-end justify-center gap-1">
                <div
                  title={`${bucket.created} created`}
                  className="w-1/2 rounded-t-sm bg-gold/80"
                  style={{ height: `${Math.max((bucket.created / peakThroughput) * 100, 2)}%` }}
                />
                <div
                  title={`${bucket.closed} closed`}
                  className="w-1/2 rounded-t-sm bg-emerald-400/70"
                  style={{ height: `${Math.max((bucket.closed / peakThroughput) * 100, 2)}%` }}
                />
              </div>
              <span className="font-mono text-[9px] text-muted">{bucket.label}</span>
              <span className="font-mono text-[9px] text-warm">
                {bucket.created}/{bucket.closed}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <h2 className="font-display text-sm font-semibold text-warm">Pod efficiency</h2>
          <p className="mt-1 text-[11px] text-muted">
            Punctuality is measured against the SLA commitment, not the requested due date.
          </p>

          {report.pods.length === 0 ? (
            <p className="mt-4 text-xs text-muted">No pods have been created yet.</p>
          ) : (
            <table className="mt-4 w-full text-left text-xs">
              <thead className="text-[10px] uppercase tracking-[0.12em] text-muted">
                <tr>
                  <th className="py-2 font-medium">Pod</th>
                  <th className="py-2 text-right font-medium">Open</th>
                  <th className="py-2 text-right font-medium">Closed</th>
                  <th className="py-2 text-right font-medium">Avg age</th>
                  <th className="py-2 text-right font-medium">On time</th>
                </tr>
              </thead>
              <tbody>
                {report.pods.map((pod) => (
                  <tr key={pod.podId} className="border-t border-white/10">
                    <td className="py-2 text-warm">{pod.podName}</td>
                    <td className="py-2 text-right font-mono text-muted">{pod.openRequests}</td>
                    <td className="py-2 text-right font-mono text-muted">{pod.closedRequests}</td>
                    <td className="py-2 text-right font-mono text-muted">
                      {hours(pod.avgOpenAgeHours)}
                    </td>
                    <td
                      className={`py-2 text-right font-mono ${
                        pod.onTimeRate === null
                          ? 'text-muted'
                          : pod.onTimeRate >= 80
                            ? 'text-emerald-300'
                            : pod.onTimeRate >= 50
                              ? 'text-gold-light'
                              : 'text-red-300'
                      }`}
                    >
                      {percent(pod.onTimeRate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <div className="flex items-center gap-2">
            <TrendingUp aria-hidden className="size-4 text-gold-light" strokeWidth={1.75} />
            <h2 className="font-display text-sm font-semibold text-warm">Tenant growth</h2>
          </div>

          <div className="mt-4 grid gap-2">
            {report.tenantGrowth.map((row) => (
              <div key={row.month} className="grid grid-cols-[46px_1fr_40px] items-center gap-2">
                <span className="font-mono text-[10px] text-muted">{row.label}</span>
                <div className="h-2 overflow-hidden rounded-full bg-white/8">
                  <div
                    className="h-full rounded-full bg-gold/70"
                    style={{ width: `${(row.newTenants / peakGrowth) * 100}%` }}
                  />
                </div>
                <span className="text-right font-mono text-[10px] text-warm">
                  +{row.newTenants}
                </span>
              </div>
            ))}
          </div>

          <p className="mt-4 text-[11px] text-muted">
            {report.totals.tenants} tenants today, {report.totals.activeTenants} of them active.
          </p>
        </div>
      </section>

      <p className="text-[11px] text-muted">
        Turnaround is creation to closure for requests closed inside the window. A tenant counts as
        active once it has raised at least one request.
      </p>
    </div>
  );
}
