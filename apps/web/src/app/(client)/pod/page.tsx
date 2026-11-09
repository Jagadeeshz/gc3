'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowRight, Route, ShieldCheck, Users } from 'lucide-react';
import type { ServiceRequest } from '@gc3/types';
import { ApiClientError, listRequests } from '@/lib/api-client';
import { useSession } from '@/lib/session-context';
import { activeRoles } from '@/lib/session';
import { requestStatusLabel } from '@/components/portal/status';
import {
  ErrorNote,
  Loading,
  PageHeader,
  Panel,
  RestrictedPanel,
  StatCard,
} from '@/components/portal/kit';

/**
 * My Pod — owner only.
 *
 * What the client can legitimately know about their delivery pod, and no more.
 * Pod composition, individual workloads and internal task lists are staff data
 * (`ops:read`, `task:read`) and no client endpoint exposes them — so this page
 * reports what the client's own requests already carry: whether each one has been
 * routed to a pod, and which ones have not.
 *
 * That is a real signal, not a placeholder: an unrouted request is one operations
 * has not picked up yet, and a client owner is entitled to see it.
 */
export default function PodPage() {
  const { session } = useSession();
  const token = session?.accessToken ?? null;
  const organizationId = session?.activeOrganizationId ?? null;
  const isOwner = session ? activeRoles(session).includes('CLIENT_OWNER') : false;

  const [requests, setRequests] = useState<readonly ServiceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token || !organizationId || !isOwner) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const page = await listRequests(token, organizationId, { pageSize: 100 });
      setRequests(page.items);
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'Could not load routing status.');
    } finally {
      setLoading(false);
    }
  }, [token, organizationId, isOwner]);

  useEffect(() => {
    void load();
  }, [load]);

  const metrics = useMemo(() => {
    const open = requests.filter(
      (request) => !['CLOSED', 'CANCELLED', 'DRAFT'].includes(request.status),
    );
    const routed = open.filter((request) => request.podId !== null);

    return { open, routed, unrouted: open.length - routed.length };
  }, [requests]);

  if (!isOwner) {
    return (
      <RestrictedPanel
        title="Pod details are managed by the account owner"
        body="Delivery pod information is part of the owner view. Your requests and their threads are still available to you."
        href="/requests"
        label="Open my requests"
      />
    );
  }

  if (loading) return <Loading label="Loading routing status…" />;

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Delivery"
        title="My Pod"
        description="How your work is routed to a delivery pod, and which of your open requests are still waiting for one."
      />

      {error ? <ErrorNote message={error} /> : null}

      <section className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Open requests" value={metrics.open.length} icon={Route} />
        <StatCard
          label="Routed to a pod"
          value={metrics.routed.length}
          icon={Users}
          tone="positive"
        />
        <StatCard
          label="Awaiting routing"
          value={metrics.unrouted}
          hint={metrics.unrouted > 0 ? 'Operations picks these up at triage' : 'Everything is routed'}
          icon={ShieldCheck}
          tone={metrics.unrouted > 0 ? 'warning' : 'default'}
        />
      </section>

      <Panel title="What a pod is" subtitle="The team that actually does the work">
        <p className="text-[11px] leading-relaxed text-slate-400">
          A delivery pod is a standing team of specialists — strategy, creative, build and QA — that owns a
          portfolio of work. When a request is triaged, operations routes it to the pod best placed to
          deliver it, and that pod carries the SLA for it.
        </p>
        <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
          Pod composition, individual workloads and internal task breakdowns are staff data and are not
          exposed to clients. What you can see is whether each of your requests has been routed, below.
        </p>
      </Panel>

      <Panel title="Routing by request" subtitle="Open work only">
        {metrics.open.length === 0 ? (
          <p className="text-xs text-slate-400">No open requests — nothing to route.</p>
        ) : (
          <ul className="grid gap-2">
            {metrics.open.map((request) => (
              <li
                key={request.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-[12px] border border-white/10 px-3.5 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm text-slate-100">{request.title}</p>
                  <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-slate-400">
                    {request.reference} · {requestStatusLabel(request.status)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] ${
                      request.podId
                        ? 'border-emerald-400/35 bg-emerald-400/10 text-emerald-300'
                        : 'border-emerald-400/35 bg-emerald-400/10 text-emerald-200'
                    }`}
                  >
                    {request.podId ? 'Routed' : 'Awaiting routing'}
                  </span>
                  <Link
                    href={`/requests/${request.id}`}
                    className="inline-flex items-center gap-1 text-[11px] text-emerald-300 underline-offset-4 hover:underline"
                  >
                    Open
                    <ArrowRight aria-hidden className="size-3" strokeWidth={1.75} />
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
