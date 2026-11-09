'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, FolderKanban } from 'lucide-react';
import type { Deliverable, ServiceRequest } from '@gc3/types';
import { ApiClientError, listDeliverables, listRequests } from '@/lib/api-client';
import { useSession } from '@/lib/session-context';
import { activeRoles } from '@/lib/session';
import { formatDate, requestStatusLabel, requestStatusTone } from '@/components/portal/status';
import { EmptyState, ErrorNote, Loading, PageHeader, timeAgo } from '@/components/portal/kit';

/**
 * Projects.
 *
 * A "project" in this platform is a service request plus everything delivered
 * against it — there is no separate project entity to invent, and creating one
 * would mean a second place for the same work to live. So the tracker joins the
 * two: status, deliverable progress and the last time anything moved, per request.
 *
 * Deliverables are fetched per request (bounded to the first 40), which is one
 * round trip per project rather than a new aggregate endpoint.
 */
export default function ProjectsPage() {
  const { session } = useSession();
  const token = session?.accessToken ?? null;
  const organizationId = session?.activeOrganizationId ?? null;
  const isOwner = session ? activeRoles(session).includes('CLIENT_OWNER') : false;

  const [rows, setRows] = useState<
    readonly { request: ServiceRequest; deliverables: readonly Deliverable[] }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token || !organizationId) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const page = await listRequests(token, organizationId, { pageSize: 100 });

      const joined = await Promise.all(
        page.items.slice(0, 40).map(async (request) => ({
          request,
          deliverables: await listDeliverables(token, organizationId, request.id).catch(
            () => [] as Deliverable[],
          ),
        })),
      );

      setRows(
        joined.sort(
          (a, b) =>
            new Date(b.request.updatedAt).getTime() - new Date(a.request.updatedAt).getTime(),
        ),
      );
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'Could not load your projects.');
    } finally {
      setLoading(false);
    }
  }, [token, organizationId]);

  useEffect(() => {
    void load();
  }, [load]);

  const summary = useMemo(() => {
    const active = rows.filter((row) =>
      ['IN_PROGRESS', 'IN_REVIEW', 'BLOCKED', 'TRIAGE'].includes(row.request.status),
    ).length;
    const delivered = rows.reduce(
      (total, row) => total + row.deliverables.filter((item) => item.status === 'RELEASED').length,
      0,
    );

    return { active, delivered, total: rows.length };
  }, [rows]);

  if (loading) return <Loading label="Loading projects…" />;

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Delivery"
        title={isOwner ? 'Projects' : 'My Projects'}
        description="Every piece of work in this workspace, with the deliverables produced against it."
      />

      {error ? <ErrorNote message={error} /> : null}

      <section className="grid gap-3 sm:grid-cols-3">
        {[
          { label: 'Projects', value: summary.total },
          { label: 'Active now', value: summary.active },
          { label: 'Deliverables released', value: summary.delivered },
        ].map((stat) => (
          <div key={stat.label} className="rounded-[12px] border border-white/10 bg-[rgba(12,16,32,0.55)] p-4">
            <p className="text-[11px] uppercase tracking-[0.1em] text-slate-400">{stat.label}</p>
            <p className="mt-2 font-display text-[26px] font-semibold tabular-nums leading-none text-slate-100">
              {stat.value}
            </p>
          </div>
        ))}
      </section>

      {rows.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="No projects yet"
          body="A project appears as soon as you raise a service request. Start with the catalogue and we will route it to a pod."
          action={{ href: '/services', label: 'Browse services' }}
        />
      ) : (
        <div className="overflow-hidden rounded-[12px] border border-white/10">
          <table className="w-full text-left text-xs">
            <thead className="bg-white/[0.03] text-[10px] uppercase tracking-[0.12em] text-slate-400">
              <tr>
                <th className="px-4 py-2.5 font-medium">Project</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 text-right font-medium">Deliverables</th>
                <th className="px-4 py-2.5 font-medium">Due</th>
                <th className="px-4 py-2.5 font-medium">Updated</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {rows.map(({ request, deliverables }) => {
                const released = deliverables.filter((item) => item.status === 'RELEASED').length;

                return (
                  <tr key={request.id} className="border-t border-white/10 hover:bg-[rgba(12,16,32,0.55)]">
                    <td className="px-4 py-3">
                      <p className="text-sm text-slate-100">{request.title}</p>
                      <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-slate-400">
                        {request.reference}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={[
                          'rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em]',
                          requestStatusTone(request.status) === 'positive'
                            ? 'border-emerald-400/35 bg-emerald-400/10 text-emerald-300'
                            : requestStatusTone(request.status) === 'critical'
                              ? 'border-red-400/35 bg-red-400/10 text-red-300'
                              : requestStatusTone(request.status) === 'gold'
                                ? 'border-emerald-400/35 bg-emerald-400/10 text-emerald-200'
                                : 'border-white/15 bg-white/5 text-slate-400',
                        ].join(' ')}
                      >
                        {requestStatusLabel(request.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-400">
                      {released}/{deliverables.length}
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      {request.dueAt ? formatDate(request.dueAt) : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-400">{timeAgo(request.updatedAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/requests/${request.id}`}
                        className="inline-flex items-center gap-1 text-[11px] text-emerald-300 underline-offset-4 hover:underline"
                      >
                        Open
                        <ArrowUpRight aria-hidden className="size-3" strokeWidth={1.75} />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
