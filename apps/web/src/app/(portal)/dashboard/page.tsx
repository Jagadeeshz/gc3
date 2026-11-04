'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ServiceRequest, ServiceRequestPriority } from '@gc3/types';
import { Badge } from '@gc3/ui';
import { ApiClientError, listRequests } from '@/lib/api-client';
import { useSession } from '@/lib/session-context';
import { formatDate, priorityLabel, requestStatusLabel, requestStatusTone } from '@/components/portal/status';

/**
 * Overview screen — metrics, recent activity and quick actions, following the
 * prototype's structure (metric grid, two-column panel row, record list).
 */
export default function DashboardPage() {
  const { session } = useSession();
  const [requests, setRequests] = useState<readonly ServiceRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const organizationId = session?.activeOrganizationId ?? null;
  const token = session?.accessToken ?? null;

  const load = useCallback(async () => {
    if (!token || !organizationId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const page = await listRequests(token, organizationId, { pageSize: 100 });
      setRequests(page.items);
      setTotal(page.total);
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'Could not load requests');
    } finally {
      setLoading(false);
    }
  }, [token, organizationId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Counted over the first page (max 100). Fine for a workspace view; a real
  // aggregate endpoint is the follow-up when volumes justify it.
  const PRIORITY_RANK: Record<ServiceRequestPriority, number> = {
    LOW: 0,
    NORMAL: 1,
    HIGH: 2,
    URGENT: 3,
  };

  const metrics = useMemo(() => {
    const open = requests.filter(
      (item) => item.status !== 'CLOSED' && item.status !== 'CANCELLED',
    ).length;
    const review = requests.filter((item) => item.status === 'IN_REVIEW').length;
    const delivered = requests.filter((item) => item.status === 'DELIVERED').length;

    return [
      { label: 'Open requests', value: open },
      { label: 'Awaiting review', value: review },
      { label: 'Delivered', value: delivered },
      { label: 'Total', value: total },
    ];
  }, [requests, total]);

  // The most urgent request still open, not simply the first row.
  const highestOpenPriority = useMemo<ServiceRequestPriority | null>(() => {
    const open = requests.filter(
      (item) => item.status !== 'CLOSED' && item.status !== 'CANCELLED',
    );

    if (open.length === 0) {
      return null;
    }

    return open.reduce<ServiceRequestPriority>(
      (worst, item) => (PRIORITY_RANK[item.priority] > PRIORITY_RANK[worst] ? item.priority : worst),
      open[0]!.priority,
    );
  }, [requests]);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl tracking-[-0.01em] text-warm">Overview</h1>
          <p className="mt-1 text-sm text-muted">
            Live from the GC3 API — every figure below is read with your token and tenant scope.
          </p>
        </div>
        <Link
          href="/requests/new"
          className="inline-flex min-h-11 items-center gap-2 rounded-[10px] border border-gold-deep/40 bg-[linear-gradient(180deg,#E2C777_0%,#D9B65D_100%)] px-4 py-2.5 text-sm font-medium text-ink transition-[filter] hover:brightness-105"
        >
          ＋ New request
        </Link>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <div key={metric.label} className="rounded-[12px] border border-white/10 bg-graphite/85 p-4">
            <p className="text-xs text-muted">{metric.label}</p>
            <strong className="mt-2 block font-display text-3xl text-warm">{metric.value}</strong>
          </div>
        ))}
      </div>

      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-red-400/35 bg-red-400/10 px-3 py-2 text-xs text-red-300"
        >
          {error}
        </p>
      ) : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-[14px] border border-white/10 bg-graphite/85 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-warm">Recent requests</h2>
            <Link href="/requests" className="text-xs text-gold-light hover:underline">
              View all
            </Link>
          </div>

          {loading ? (
            <p className="mt-4 text-sm text-muted">Loading…</p>
          ) : requests.length === 0 ? (
            <p className="mt-4 text-sm text-muted">
              No requests yet. Create the first one to get started.
            </p>
          ) : (
            <ul className="mt-4 grid gap-2.5">
              {requests.slice(0, 5).map((item) => (
                <li key={item.id}>
                  <Link
                    href={`/requests/${item.id}`}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-white/10 bg-white/[0.02] px-3.5 py-3 transition-colors hover:border-gold/35"
                  >
                    <span className="min-w-0">
                      <span className="block font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                        {item.reference} · {formatDate(item.createdAt)}
                      </span>
                      <span className="mt-1 block truncate text-sm text-warm">{item.title}</span>
                    </span>
                    <Badge tone={requestStatusTone(item.status)}>
                      {requestStatusLabel(item.status)}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-[14px] border border-white/10 bg-graphite/85 p-5">
          <h2 className="text-sm font-semibold text-warm">Quick actions</h2>
          <div className="mt-4 grid gap-2">
            <Link
              href="/requests/new"
              className="rounded-[10px] border border-white/10 bg-white/[0.03] px-3.5 py-3 text-sm text-warm transition-colors hover:border-gold/35"
            >
              Raise a service request
            </Link>
            <Link
              href="/requests"
              className="rounded-[10px] border border-white/10 bg-white/[0.03] px-3.5 py-3 text-sm text-warm transition-colors hover:border-gold/35"
            >
              Browse all requests
            </Link>
          </div>

          <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
            Signed in as
          </p>
          <p className="mt-1 text-sm text-warm">{session?.actor.fullName}</p>
          <p className="text-xs text-muted">
            {session?.actor.platformRole
              ? session.actor.platformRole.replace(/_/g, ' ')
              : 'Client member'}
          </p>
        </section>
      </div>

      {highestOpenPriority ? (
        <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
          Most urgent open request: {priorityLabel(highestOpenPriority)}
        </p>
      ) : null}
    </div>
  );
}
