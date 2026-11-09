'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type { DeliveryHistory } from '@gc3/types';
import { ApiClientError, fetchDeliveryHistory } from '@/lib/api-client';
import { useSession } from '@/lib/session-context';
import { formatDate } from '@/components/portal/status';

/**
 * Client-facing delivery history: what has actually been released in this
 * workspace. Pending and approved-but-unreleased work is absent by design — the
 * page is a receipt, not a status board.
 */
export default function DeliveriesPage() {
  const { session } = useSession();
  const [history, setHistory] = useState<DeliveryHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const token = session?.accessToken ?? null;
  const organizationId = session?.activeOrganizationId ?? null;

  const load = useCallback(async () => {
    if (!token || !organizationId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      setHistory(await fetchDeliveryHistory(token, organizationId));
    } catch (caught) {
      setError(
        caught instanceof ApiClientError ? caught.message : 'Could not load the delivery history',
      );
    } finally {
      setLoading(false);
    }
  }, [token, organizationId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div>
      <h1 className="font-display text-3xl tracking-[-0.01em] text-slate-100">Delivery history</h1>
      <p className="mt-1 text-sm text-slate-400">
        Everything released to this workspace, newest first. Only released assets appear here.
      </p>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        {[
          { label: 'Released assets', value: history?.releasedCount ?? 0 },
          { label: 'Requests covered', value: history?.requestCount ?? 0 },
          {
            label: 'Latest release',
            value: history?.latestReleasedAt ? formatDate(history.latestReleasedAt) : '—',
          },
        ].map((metric) => (
          <div key={metric.label} className="rounded-[6px] border border-[color:var(--bindu-surface-border)] bg-[color:var(--bindu-void-2)] p-4">
            <p className="text-xs text-slate-400">{metric.label}</p>
            <strong className="mt-2 block font-display text-2xl text-slate-100">{metric.value}</strong>
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

      {loading ? (
        <p className="mt-6 text-sm text-slate-400">Loading delivery history…</p>
      ) : !history || history.entries.length === 0 ? (
        <div className="mt-6 rounded-[8px] border border-[color:var(--bindu-surface-border)] bg-[color:var(--bindu-void-2)] p-6">
          <p className="text-sm text-slate-100">Nothing has been released yet.</p>
          <p className="mt-1 text-sm text-slate-400">
            Deliverables appear here once the GC3 team releases them after sign-off.
          </p>
        </div>
      ) : (
        <ul className="mt-6 grid gap-3">
          {history.entries.map((entry) => (
            <li
              key={entry.deliverableId}
              className="rounded-[6px] border border-[color:var(--bindu-surface-border)] bg-[color:var(--bindu-void-2)] p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-100">
                    {entry.title}
                    <span className="ml-2 rounded border border-white/15 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em] text-slate-400">
                      v{entry.version}
                    </span>
                  </p>
                  <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-slate-400">
                    {entry.requestReference ?? 'Unattached'} · released{' '}
                    {formatDate(entry.releasedAt)}
                  </p>
                  {entry.description ? (
                    <p className="mt-1.5 text-xs text-slate-400">{entry.description}</p>
                  ) : null}
                </div>

                <div className="flex flex-col items-end gap-1.5">
                  {entry.requestId ? (
                    <Link
                      href={`/requests/${entry.requestId}`}
                      className="text-[11px] text-gold-light hover:underline"
                    >
                      View request →
                    </Link>
                  ) : null}
                  {entry.fileUrl ? (
                    <a
                      href={entry.fileUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-[11px] text-gold-light hover:underline"
                    >
                      Open file ↗
                    </a>
                  ) : null}
                </div>
              </div>

              {entry.requestTitle ? (
                <p className="mt-2 truncate text-[11px] text-slate-400">
                  Against: {entry.requestTitle}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
