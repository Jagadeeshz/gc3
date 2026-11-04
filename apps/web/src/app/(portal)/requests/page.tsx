'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type { ServiceRequest, ServiceRequestStatus } from '@gc3/types';
import { Badge } from '@gc3/ui';
import { ApiClientError, listRequests } from '@/lib/api-client';
import { useSession } from '@/lib/session-context';
import {
  formatDate,
  priorityLabel,
  requestStatusLabel,
  requestStatusTone,
} from '@/components/portal/status';

type Filter = 'ALL' | ServiceRequestStatus;

const TABS: { key: Filter; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'SUBMITTED', label: 'Submitted' },
  { key: 'IN_PROGRESS', label: 'In progress' },
  { key: 'IN_REVIEW', label: 'Review' },
  { key: 'CLOSED', label: 'Closed' },
];

/** Service request list with the prototype's tab-filter + record list layout. */
export default function RequestsPage() {
  const { session } = useSession();
  const [filter, setFilter] = useState<Filter>('ALL');
  const [items, setItems] = useState<readonly ServiceRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const token = session?.accessToken ?? null;
  const organizationId = session?.activeOrganizationId ?? null;

  const load = useCallback(
    async (nextFilter: Filter) => {
      if (!token || !organizationId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const page = await listRequests(token, organizationId, {
          pageSize: 50,
          ...(nextFilter === 'ALL' ? {} : { status: nextFilter }),
        });

        setItems(page.items);
        setTotal(page.total);
      } catch (caught) {
        setError(caught instanceof ApiClientError ? caught.message : 'Could not load requests');
      } finally {
        setLoading(false);
      }
    },
    [token, organizationId],
  );

  useEffect(() => {
    void load(filter);
  }, [load, filter]);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl tracking-[-0.01em] text-warm">Service Requests</h1>
          <p className="mt-1 text-sm text-muted">
            {total} {total === 1 ? 'request' : 'requests'} in this workspace
          </p>
        </div>
        <Link
          href="/requests/new"
          className="inline-flex min-h-11 items-center gap-2 rounded-[10px] border border-gold-deep/40 bg-[linear-gradient(180deg,#E2C777_0%,#D9B65D_100%)] px-4 py-2.5 text-sm font-medium text-ink transition-[filter] hover:brightness-105"
        >
          ＋ Create new
        </Link>
      </div>

      <div className="mt-5 flex flex-wrap gap-1.5">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setFilter(tab.key)}
            className={[
              'min-h-9 rounded-lg border px-3 py-1.5 text-xs transition-colors',
              filter === tab.key
                ? 'border-gold/45 bg-gold/12 text-gold-light'
                : 'border-white/10 bg-white/[0.03] text-muted hover:text-warm',
            ].join(' ')}
          >
            {tab.label}
          </button>
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

      {loading ? (
        <p className="mt-6 text-sm text-muted">Loading requests…</p>
      ) : items.length === 0 ? (
        <div className="mt-6 rounded-[14px] border border-white/10 bg-graphite/85 p-6">
          <p className="text-sm text-warm">Nothing here yet.</p>
          <p className="mt-1 text-sm text-muted">
            {filter === 'ALL'
              ? 'Raise the first service request to start tracking work.'
              : 'No requests with this status in the current workspace.'}
          </p>
        </div>
      ) : (
        <ul className="mt-6 grid gap-3">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={`/requests/${item.id}`}
                className="block rounded-[12px] border border-white/10 bg-graphite/85 p-4 transition-colors hover:border-gold/35"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                    {item.reference}
                  </span>
                  <Badge tone={requestStatusTone(item.status)}>
                    {requestStatusLabel(item.status)}
                  </Badge>
                </div>
                <h2 className="mt-2 text-sm font-medium text-warm">{item.title}</h2>
                <p className="mt-1 line-clamp-2 text-xs text-muted">{item.description}</p>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted">
                  <span className="font-mono uppercase tracking-[0.1em]">
                    {priorityLabel(item.priority)} priority
                  </span>
                  <span>Created {formatDate(item.createdAt)}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
