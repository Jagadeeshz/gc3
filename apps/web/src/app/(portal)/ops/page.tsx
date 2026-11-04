'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { OpsDashboard, PodSummary } from '@gc3/types';
import {
  ApiClientError,
  assignRequest,
  createPod,
  fetchOpsDashboard,
} from '@/lib/api-client';
import { useSession } from '@/lib/session-context';
import { formatDate } from '@/components/portal/status';

/**
 * Staff operations console (Phase 3).
 *
 * The only screen that spans tenants. It is gated on the platform role here for
 * a clean "not for you" panel, but the real boundary is server-side: the API
 * refuses `/ops/dashboard` to anyone without `ops:read`, so hiding the nav entry
 * is a courtesy, not the control.
 */
const OPS_ROLES = ['PLATFORM_ADMIN', 'OPERATIONS_MANAGER'] as const;

const STATUS_TONE: Record<string, string> = {
  BLOCKED: 'border-red-400/35 bg-red-400/10 text-red-300',
  IN_REVIEW: 'border-sky-400/35 bg-sky-400/10 text-sky-300',
  DELIVERED: 'border-emerald-400/35 bg-emerald-400/10 text-emerald-300',
  IN_PROGRESS: 'border-gold/35 bg-gold/10 text-gold-light',
};

const PRIORITY_TONE: Record<string, string> = {
  URGENT: 'text-red-300',
  HIGH: 'text-gold-light',
  NORMAL: 'text-warm',
  LOW: 'text-muted',
};

export default function OpsConsolePage() {
  const { session } = useSession();
  const [dashboard, setDashboard] = useState<OpsDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busyRequestId, setBusyRequestId] = useState<string | null>(null);
  const [podDraft, setPodDraft] = useState({ name: '', description: '' });
  const [creatingPod, setCreatingPod] = useState(false);

  const token = session?.accessToken ?? null;
  const platformRole = session?.actor.platformRole ?? null;
  const allowed = platformRole !== null && OPS_ROLES.includes(platformRole as 'PLATFORM_ADMIN');

  const load = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      setDashboard(await fetchOpsDashboard(token, { queueLimit: 25 }));
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'Could not load operations data');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (allowed) {
      void load();
    } else {
      setLoading(false);
    }
  }, [allowed, load]);

  const podsByOrganization = useMemo(() => {
    const map = new Map<string, PodSummary[]>();
    for (const pod of dashboard?.pods ?? []) {
      const list = map.get(pod.organizationId) ?? [];
      list.push(pod);
      map.set(pod.organizationId, list);
    }
    return map;
  }, [dashboard]);

  async function route(requestId: string, organizationId: string, podId: string) {
    if (!token) {
      return;
    }

    setBusyRequestId(requestId);
    setError(null);
    setNotice(null);

    try {
      await assignRequest(token, organizationId, requestId, {
        podId: podId === '' ? null : podId,
      });
      setNotice(podId === '' ? 'Assignment cleared.' : 'Request routed to the pod.');
      await load();
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'Could not route the request');
    } finally {
      setBusyRequestId(null);
    }
  }

  async function submitPod(event: React.FormEvent) {
    event.preventDefault();

    if (!token || !session?.activeOrganizationId) {
      return;
    }

    setCreatingPod(true);
    setError(null);
    setNotice(null);

    try {
      await createPod(token, session.activeOrganizationId, {
        name: podDraft.name.trim(),
        ...(podDraft.description.trim() ? { description: podDraft.description.trim() } : {}),
      });
      setPodDraft({ name: '', description: '' });
      setNotice('Pod created.');
      await load();
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'Could not create the pod');
    } finally {
      setCreatingPod(false);
    }
  }

  if (!allowed) {
    return (
      <div className="max-w-2xl">
        <h1 className="font-display text-3xl tracking-[-0.01em] text-warm">Operations console</h1>
        <div className="mt-6 rounded-[14px] border border-white/10 bg-graphite/85 p-6">
          <p className="text-sm text-warm">This console is for platform operations.</p>
          <p className="mt-1 text-sm text-muted">
            It aggregates every tenant, so it is limited to platform administrators and operations
            managers. Your account
            {platformRole ? ` (${platformRole.replace(/_/g, ' ')})` : ''} does not hold that access.
          </p>
        </div>
      </div>
    );
  }

  const totals = dashboard?.totals;

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl tracking-[-0.01em] text-warm">Operations console</h1>
          <p className="mt-1 text-sm text-muted">
            Every tenant at once: load, blockages, and the work still waiting to be routed.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-lg border border-white/15 bg-graphite px-3 py-2 text-xs text-warm transition-colors hover:border-gold/40"
        >
          Refresh
        </button>
      </div>

      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-red-400/35 bg-red-400/10 px-3 py-2 text-xs text-red-300"
        >
          {error}
        </p>
      ) : null}

      {notice ? (
        <p className="mt-4 rounded-lg border border-gold/30 bg-gold/10 px-3 py-2 text-xs text-gold-light">
          {notice}
        </p>
      ) : null}

      {loading ? (
        <p className="mt-6 text-sm text-muted">Loading operations data…</p>
      ) : !dashboard ? (
        <p className="mt-6 text-sm text-muted">No operations data available.</p>
      ) : (
        <>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            {[
              { label: 'Tenants', value: totals?.organizations ?? 0 },
              { label: 'Open requests', value: totals?.openRequests ?? 0 },
              { label: 'Blocked', value: totals?.blockedRequests ?? 0 },
              { label: 'Overdue', value: totals?.overdueRequests ?? 0 },
              { label: 'Unrouted', value: totals?.unassignedRequests ?? 0 },
              { label: 'Pods', value: totals?.pods ?? 0 },
            ].map((metric) => (
              <div key={metric.label} className="rounded-[12px] border border-white/10 bg-graphite/85 p-4">
                <p className="text-xs text-muted">{metric.label}</p>
                <strong className="mt-2 block font-display text-2xl text-warm">{metric.value}</strong>
              </div>
            ))}
          </div>

          <section className="mt-8">
            <h2 className="text-sm font-semibold text-warm">Tenants</h2>
            <div className="mt-3 overflow-x-auto rounded-[12px] border border-white/10 bg-graphite/85">
              <table className="w-full min-w-[720px] text-left text-xs">
                <thead className="border-b border-white/10 text-muted">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Organization</th>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                    <th className="px-4 py-2.5 font-medium">Open</th>
                    <th className="px-4 py-2.5 font-medium">Blocked</th>
                    <th className="px-4 py-2.5 font-medium">Overdue</th>
                    <th className="px-4 py-2.5 font-medium">Unrouted</th>
                    <th className="px-4 py-2.5 font-medium">Pods</th>
                    <th className="px-4 py-2.5 font-medium">Members</th>
                    <th className="px-4 py-2.5 font-medium">Released</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.organizations.map((organization) => (
                    <tr key={organization.organizationId} className="border-b border-white/5 last:border-0">
                      <td className="px-4 py-2.5 text-warm">{organization.name}</td>
                      <td className="px-4 py-2.5 font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
                        {organization.status}
                      </td>
                      <td className="px-4 py-2.5 text-warm">{organization.openRequests}</td>
                      <td className="px-4 py-2.5 text-red-300">{organization.blockedRequests}</td>
                      <td className="px-4 py-2.5 text-gold-light">{organization.overdueRequests}</td>
                      <td className="px-4 py-2.5 text-muted">{organization.unassignedRequests}</td>
                      <td className="px-4 py-2.5 text-muted">{organization.podCount}</td>
                      <td className="px-4 py-2.5 text-muted">{organization.memberCount}</td>
                      <td className="px-4 py-2.5 text-emerald-300">
                        {organization.releasedDeliverables}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="mt-8">
            <h2 className="text-sm font-semibold text-warm">Routing queue</h2>
            <p className="mt-1 text-xs text-muted">
              Open work that has no pod, no owner, or is past due. Pick a pod to route it.
            </p>

            {dashboard.queue.length === 0 ? (
              <div className="mt-3 rounded-[12px] border border-white/10 bg-graphite/85 p-5">
                <p className="text-sm text-warm">Everything is routed.</p>
                <p className="mt-1 text-sm text-muted">
                  No open request is missing a pod, an owner, or overdue.
                </p>
              </div>
            ) : (
              <ul className="mt-3 grid gap-2">
                {dashboard.queue.map((item) => {
                  const podOptions = podsByOrganization.get(item.organizationId) ?? [];
                  const busy = busyRequestId === item.requestId;

                  return (
                    <li
                      key={item.requestId}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-white/10 bg-graphite/85 p-3.5"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
                            {item.reference}
                          </span>
                          <span
                            className={[
                              'rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.08em]',
                              STATUS_TONE[item.status] ?? 'border-white/15 text-muted',
                            ].join(' ')}
                          >
                            {item.status.replace(/_/g, ' ')}
                          </span>
                          <span
                            className={[
                              'font-mono text-[10px] uppercase tracking-[0.08em]',
                              PRIORITY_TONE[item.priority] ?? 'text-muted',
                            ].join(' ')}
                          >
                            {item.priority}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-sm text-warm">{item.title}</p>
                        <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
                          {item.organizationName}
                          {item.dueAt ? ` · due ${formatDate(item.dueAt)}` : ''}
                          {item.podName ? ` · ${item.podName}` : ' · no pod'}
                          {item.assigneeName ? ` · ${item.assigneeName}` : ' · no owner'}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <select
                          aria-label={`Route ${item.reference}`}
                          disabled={busy || podOptions.length === 0}
                          defaultValue={item.podId ?? ''}
                          onChange={(event) => void route(item.requestId, item.organizationId, event.target.value)}
                          className="rounded-lg border border-white/12 bg-void px-2.5 py-1.5 text-xs text-warm focus:border-gold/60 focus:outline-none disabled:opacity-50"
                        >
                          <option value="">Unassigned</option>
                          {podOptions.map((pod) => (
                            <option key={pod.id} value={pod.id}>
                              {pod.name}
                            </option>
                          ))}
                        </select>
                        {busy ? <span className="text-[11px] text-muted">Routing…</span> : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="mt-8 grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <div>
              <h2 className="text-sm font-semibold text-warm">Pods</h2>
              {dashboard.pods.length === 0 ? (
                <div className="mt-3 rounded-[12px] border border-white/10 bg-graphite/85 p-5">
                  <p className="text-sm text-warm">No pods yet.</p>
                  <p className="mt-1 text-sm text-muted">
                    A pod is the standing team that owns execution inside a tenant. Create one on the
                    right, then route work into it.
                  </p>
                </div>
              ) : (
                <ul className="mt-3 grid gap-2">
                  {dashboard.pods.map((pod) => (
                    <li
                      key={pod.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-white/10 bg-graphite/85 p-3.5"
                    >
                      <div>
                        <p className="text-sm text-warm">{pod.name}</p>
                        <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
                          {pod.organizationName} · {pod.memberCount} member
                          {pod.memberCount === 1 ? '' : 's'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-display text-lg text-warm">{pod.openRequests}</p>
                        <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
                          open
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <form
              onSubmit={submitPod}
              className="rounded-[12px] border border-white/10 bg-graphite/85 p-4"
            >
              <h2 className="text-sm font-semibold text-warm">New pod</h2>
              <p className="mt-1 text-[11px] text-muted">
                Created in your active workspace
                {session?.organizations.find((org) => org.id === session.activeOrganizationId)
                  ? `: ${session.organizations.find((org) => org.id === session.activeOrganizationId)?.name}`
                  : ''}
                .
              </p>

              <label className="mt-3 grid gap-1.5">
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                  Name
                </span>
                <input
                  required
                  minLength={2}
                  value={podDraft.name}
                  onChange={(event) => setPodDraft((draft) => ({ ...draft, name: event.target.value }))}
                  placeholder="Cloud Delivery"
                  className="w-full rounded-lg border border-white/12 bg-void px-3 py-2 text-sm text-warm focus:border-gold/60 focus:outline-none"
                />
              </label>

              <label className="mt-3 grid gap-1.5">
                <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
                  Description (optional)
                </span>
                <textarea
                  rows={2}
                  value={podDraft.description}
                  onChange={(event) =>
                    setPodDraft((draft) => ({ ...draft, description: event.target.value }))
                  }
                  className="w-full rounded-lg border border-white/12 bg-void px-3 py-2 text-sm text-warm focus:border-gold/60 focus:outline-none"
                />
              </label>

              <button
                type="submit"
                disabled={creatingPod || !session?.activeOrganizationId || podDraft.name.trim().length < 2}
                className="mt-3 w-full rounded-lg border border-gold/40 bg-gold/15 px-3 py-2 text-xs font-semibold text-gold-light transition-colors hover:bg-gold/25 disabled:opacity-50"
              >
                {creatingPod ? 'Creating…' : 'Create pod'}
              </button>
            </form>
          </section>
        </>
      )}
    </div>
  );
}
