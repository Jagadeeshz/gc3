'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Download, FileCheck2, Package } from 'lucide-react';
import type { Deliverable, ServiceRequest } from '@gc3/types';
import {
  ApiClientError,
  downloadDeliverableFile,
  fetchDeliveryHistory,
  listDeliverables,
  listRequests,
} from '@/lib/api-client';
import { useSession } from '@/lib/session-context';
import { formatBytes, formatDate, deliverableStatusLabel } from '@/components/portal/status';
import { EmptyState, ErrorNote, Loading, PageHeader, Panel } from '@/components/portal/kit';

/**
 * Deliverables.
 *
 * Every asset produced for this workspace, whatever its state — the tracker a
 * client actually needs, as opposed to `/deliveries` which is the released-only
 * receipt. Status colouring follows the brief: green once it has been submitted or
 * approved, amber while it is under review.
 *
 * A deliverable belongs to a request, so the tracker is assembled per request
 * (bounded), and released assets can be downloaded straight from here.
 */
const TONE: Record<string, string> = {
  RELEASED: 'border-emerald-400/35 bg-emerald-400/10 text-emerald-300',
  APPROVED: 'border-emerald-400/35 bg-emerald-400/10 text-emerald-300',
  IN_REVIEW: 'border-emerald-400/35 bg-emerald-400/10 text-emerald-200',
  PENDING: 'border-emerald-400/35 bg-emerald-400/10 text-emerald-200',
  IN_PROGRESS: 'border-sky-400/35 bg-sky-400/10 text-sky-300',
  REJECTED: 'border-red-400/35 bg-red-400/10 text-red-300',
};

export default function DeliverablesPage() {
  const { session } = useSession();
  const token = session?.accessToken ?? null;
  const organizationId = session?.activeOrganizationId ?? null;

  const [rows, setRows] = useState<
    readonly { request: ServiceRequest; deliverables: readonly Deliverable[] }[]
  >([]);
  const [released, setReleased] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token || !organizationId) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [page, history] = await Promise.all([
        listRequests(token, organizationId, { pageSize: 100 }),
        fetchDeliveryHistory(token, organizationId, 100).catch(() => null),
      ]);

      const joined = await Promise.all(
        page.items.slice(0, 40).map(async (request) => ({
          request,
          deliverables: await listDeliverables(token, organizationId, request.id).catch(
            () => [] as Deliverable[],
          ),
        })),
      );

      setRows(joined.filter((row) => row.deliverables.length > 0));
      setReleased(history?.releasedCount ?? 0);
    } catch (caught) {
      setError(
        caught instanceof ApiClientError ? caught.message : 'Could not load your deliverables.',
      );
    } finally {
      setLoading(false);
    }
  }, [token, organizationId]);

  useEffect(() => {
    void load();
  }, [load]);

  const totals = useMemo(() => {
    const all = rows.flatMap((row) => row.deliverables);

    return {
      all: all.length,
      awaiting: all.filter((item) => ['IN_REVIEW', 'PENDING'].includes(item.status)).length,
      approved: all.filter((item) => ['APPROVED', 'RELEASED'].includes(item.status)).length,
    };
  }, [rows]);

  async function download(deliverable: Deliverable) {
    if (!token || !organizationId) {
      return;
    }

    setBusy(deliverable.id);
    setNotice(null);

    try {
      const blob = await downloadDeliverableFile(token, organizationId, deliverable.id);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = deliverable.title;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setNotice(`${deliverable.title} downloaded.`);
    } catch (caught) {
      setNotice(
        caught instanceof ApiClientError ? caught.message : 'Could not download that deliverable.',
      );
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <Loading label="Loading deliverables…" />;

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Delivery"
        title="Deliverables"
        description="Everything we have produced for this workspace, with its review state and the file it refers to."
      />

      {error ? <ErrorNote message={error} /> : null}
      {notice ? (
        <p className="rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs text-amber-200">
          {notice}
        </p>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-3">
        {[
          { label: 'Total deliverables', value: totals.all },
          { label: 'Awaiting review', value: totals.awaiting },
          { label: 'Approved or released', value: Math.max(totals.approved, released) },
        ].map((stat) => (
          <div key={stat.label} className="rounded-[12px] border border-[#1E293B] bg-[#0B1220] p-4">
            <p className="text-[11px] uppercase tracking-[0.1em] text-slate-400">{stat.label}</p>
            <p className="mt-2 font-display text-[26px] font-semibold tabular-nums leading-none text-slate-100">
              {stat.value}
            </p>
          </div>
        ))}
      </section>

      {rows.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No deliverables yet"
          body="Deliverables appear here as our pods produce them against your requests. Everything released is also kept in the delivery history."
          action={{ href: '/deliveries', label: 'Open delivery history' }}
        />
      ) : (
        <div className="grid gap-4">
          {rows.map(({ request, deliverables }) => (
            <Panel
              key={request.id}
              title={request.title}
              subtitle={`${request.reference} · ${deliverables.length} deliverable${deliverables.length === 1 ? '' : 's'}`}
              action={
                <Link
                  href={`/requests/${request.id}`}
                  className="text-[11px] text-emerald-300 underline-offset-4 hover:underline"
                >
                  Open request
                </Link>
              }
            >
              <ul className="grid gap-2">
                {deliverables.map((deliverable) => (
                  <li
                    key={deliverable.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-[#1E293B] px-3.5 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 text-sm text-slate-100">
                        <FileCheck2 aria-hidden className="size-3.5 text-gold-light" strokeWidth={1.75} />
                        {deliverable.title}
                        <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-slate-400">
                          v{deliverable.version}
                        </span>
                      </p>
                      <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-slate-400">
                        {deliverable.fileSize ? formatBytes(deliverable.fileSize) : 'no file'}
                        {deliverable.releasedAt
                          ? ` · released ${formatDate(deliverable.releasedAt)}`
                          : ` · updated ${formatDate(deliverable.updatedAt)}`}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] ${
                          TONE[deliverable.status] ?? 'border-white/15 bg-white/5 text-slate-400'
                        }`}
                      >
                        {deliverableStatusLabel(deliverable.status)}
                      </span>
                      {deliverable.fileKey ? (
                        <button
                          type="button"
                          onClick={() => void download(deliverable)}
                          disabled={busy === deliverable.id}
                          className="inline-flex items-center gap-1 rounded-lg border border-[#1E293B] px-2 py-1 text-[10px] text-slate-100 transition-colors hover:border-emerald-400/35 hover:text-emerald-200 disabled:opacity-50"
                        >
                          <Download aria-hidden className="size-3" strokeWidth={1.9} />
                          {busy === deliverable.id ? 'Fetching…' : 'Download'}
                        </button>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}
