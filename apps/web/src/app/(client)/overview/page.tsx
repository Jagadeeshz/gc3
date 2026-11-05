'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight,
  ClipboardList,
  FolderKanban,
  Info,
  MessageSquare,
  Package,
  Plus,
  Timer,
} from 'lucide-react';
import type { Deliverable, ServiceRequest, SubscriptionOverview } from '@gc3/types';
import { ApiClientError, fetchSubscription, listDeliverables, listRequests } from '@/lib/api-client';
import { useSession } from '@/lib/session-context';
import { activeRoles } from '@/lib/session';
import { formatDate } from '@/components/portal/status';
import {
  EmptyState,
  ErrorNote,
  Loading,
  Meter,
  PageHeader,
  Panel,
  StatCard,
  timeAgo,
} from '@/components/portal/kit';

/**
 * Executive overview.
 *
 * The four numbers a client checks before anything else, a live grid of the work
 * in flight, and three buttons that cover 90% of what they came here to do.
 *
 * One deliberate deviation from the brief: there is no "retainer hours" metric,
 * because this platform's plans are metered in requests, storage and API calls —
 * there is no hours bucket anywhere in the schema or the API, and inventing one
 * would put a comfortable fiction on the most-read screen in the product. The
 * third tile reports the retainer that actually exists (requests this period) and
 * says so in the unit.
 */
const OPEN_STATUSES = ['SUBMITTED', 'TRIAGE', 'IN_PROGRESS', 'IN_REVIEW', 'BLOCKED'];

/** The vocabulary the brief asks for, mapped onto the statuses the API returns. */
function trackerLabel(status: string): string {
  switch (status) {
    case 'SUBMITTED':
    case 'TRIAGE':
      return 'Submitted';
    case 'IN_REVIEW':
      return 'Under Review';
    case 'IN_PROGRESS':
      return 'In Progress';
    case 'BLOCKED':
      return 'Blocked';
    case 'DELIVERED':
    case 'CLOSED':
      return 'Delivered';
    default:
      return 'Draft';
  }
}

function trackerTone(status: string): string {
  switch (status) {
    case 'IN_PROGRESS':
      return 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300 shadow-[0_0_18px_-8px_rgba(16,185,129,0.8)]';
    case 'IN_REVIEW':
      return 'border-amber-400/30 bg-amber-400/10 text-amber-300 shadow-[0_0_18px_-8px_rgba(245,158,11,0.8)]';
    case 'BLOCKED':
      return 'border-red-400/30 bg-red-400/10 text-red-300';
    case 'DELIVERED':
    case 'CLOSED':
      return 'border-emerald-400/25 bg-emerald-400/[0.07] text-emerald-200';
    default:
      return 'border-[#1E293B] bg-white/[0.03] text-slate-300';
  }
}

export default function OverviewPage() {
  const { session } = useSession();
  const token = session?.accessToken ?? null;
  const organizationId = session?.activeOrganizationId ?? null;
  const isOwner = session ? activeRoles(session).includes('CLIENT_OWNER') : false;

  const [requests, setRequests] = useState<readonly ServiceRequest[]>([]);
  const [deliverablesByRequest, setDeliverablesByRequest] = useState<
    Readonly<Record<string, readonly Deliverable[]>>
  >({});
  const [plan, setPlan] = useState<SubscriptionOverview | null>(null);
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
      setRequests(page.items);

      const pairs = await Promise.all(
        page.items.slice(0, 20).map(async (request) => {
          const items = await listDeliverables(token, organizationId, request.id).catch(
            () => [] as Deliverable[],
          );
          return [request.id, items] as const;
        }),
      );

      setDeliverablesByRequest(Object.fromEntries(pairs));

      if (isOwner) {
        try {
          setPlan(await fetchSubscription(token, organizationId));
        } catch {
          setPlan(null);
        }
      }
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'Could not load your overview.');
    } finally {
      setLoading(false);
    }
  }, [token, organizationId, isOwner]);

  useEffect(() => {
    void load();
  }, [load]);

  const metrics = useMemo(() => {
    const allDeliverables = Object.values(deliverablesByRequest).flat();
    const open = requests.filter((request) => OPEN_STATUSES.includes(request.status));
    const active = requests.filter((request) => ['IN_PROGRESS', 'IN_REVIEW'].includes(request.status));
    const pending = allDeliverables.filter((item) => ['PENDING', 'IN_REVIEW'].includes(item.status));

    return {
      active,
      open,
      pending,
      totalDeliverables: allDeliverables.length,
    };
  }, [requests, deliverablesByRequest]);

  const tracker = useMemo(
    () =>
      [...requests]
        .filter((request) => OPEN_STATUSES.includes(request.status))
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 6),
    [requests],
  );

  const requestMeter = plan?.usage.find((meter) => meter.key === 'REQUESTS') ?? null;

  if (loading) return <Loading label="Loading your overview…" />;

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Workspace overview"
        title={`Welcome back${session?.actor.fullName ? `, ${session.actor.fullName.split(' ')[0]}` : ''}`}
        description="Everything in flight across your workspace, and the fastest route back into the work."
        actions={
          <Link
            href="/requests/new"
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-400/35 bg-emerald-400/10 px-3 py-2 text-xs font-semibold text-emerald-200 transition-colors hover:bg-emerald-400/15"
          >
            <Plus aria-hidden className="size-3.5" strokeWidth={2} />
            New Request
          </Link>
        }
      />

      {error ? <ErrorNote message={error} /> : null}

      {/* KPI row */}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Active projects"
          value={metrics.active.length}
          hint={`${metrics.open.length} open in total`}
          icon={FolderKanban}
        />
        <StatCard
          label="Open requests"
          value={metrics.open.length}
          hint={`${requests.length} raised all time`}
          icon={ClipboardList}
          tone={metrics.open.length > 0 ? 'warning' : 'default'}
        />
        <StatCard
          label={requestMeter ? `Retainer — ${requestMeter.unit}` : 'Retainer allowance'}
          value={
            requestMeter
              ? `${requestMeter.quantity} / ${requestMeter.included}`
              : isOwner
                ? '—'
                : 'Owner only'
          }
          hint={
            requestMeter
              ? `${requestMeter.remaining} remaining · resets ${formatDate(plan?.subscription.currentPeriodEnd ?? '')}`
              : 'Plans are metered in requests, not hours'
          }
          icon={Timer}
          tone={
            requestMeter?.state === 'EXCEEDED'
              ? 'critical'
              : requestMeter?.state === 'WARNING'
                ? 'warning'
                : 'default'
          }
        />
        <StatCard
          label="Pending deliverables"
          value={metrics.pending.length}
          hint={`${metrics.totalDeliverables} produced · ${metrics.pending.length} awaiting review`}
          icon={Package}
          tone={metrics.pending.length > 0 ? 'warning' : 'positive'}
        />
      </section>

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        {/* Live project tracker */}
        <section className="grid gap-3">
          <div className="flex items-center justify-between">
            <h2 className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">
              Live project tracker
            </h2>
            <Link
              href="/projects"
              className="text-[11px] text-emerald-300 underline-offset-4 hover:underline"
            >
              All projects
            </Link>
          </div>

          {tracker.length === 0 ? (
            <EmptyState
              icon={FolderKanban}
              title="No work in flight"
              body="Raise a request and it appears here the moment it is submitted, with its status as our pods move it along."
              action={{ href: '/requests/new', label: 'Raise a request' }}
            />
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {tracker.map((request) => {
                const items = deliverablesByRequest[request.id] ?? [];
                const released = items.filter((item) => item.status === 'RELEASED').length;

                return (
                  <li key={request.id}>
                    <Link
                      href={`/requests/${request.id}`}
                      className="group flex h-full flex-col justify-between gap-3 rounded-[12px] border border-[#1E293B] bg-[#0B1220] p-4 transition-colors hover:border-emerald-400/30"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-slate-100">{request.title}</p>
                        <span
                          className={`shrink-0 rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] ${trackerTone(request.status)}`}
                        >
                          {trackerLabel(request.status)}
                        </span>
                      </div>

                      <div className="flex items-end justify-between gap-3">
                        <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-slate-500">
                          {request.reference} · {timeAgo(request.updatedAt)}
                        </p>
                        <p className="font-mono text-[10px] tabular-nums text-slate-400">
                          {released}/{items.length} deliverables
                        </p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* Action hub */}
        <div className="grid gap-4">
          <section className="rounded-[14px] border border-[#1E293B] bg-[#0B1220] p-4">
            <h2 className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">
              Action hub
            </h2>
            <div className="mt-3 grid gap-2">
              {[
                { href: '/requests/new', label: '＋ New Request', icon: Plus, primary: true },
                { href: '/projects', label: 'Projects', icon: FolderKanban, primary: false },
                { href: '/messages', label: 'Messages', icon: MessageSquare, primary: false },
              ].map((action) => {
                const Icon = action.icon;

                return (
                  <Link
                    key={action.href}
                    href={action.href}
                    className={[
                      'group flex items-center justify-between rounded-[10px] border px-3.5 py-2.5 text-xs transition-colors',
                      action.primary
                        ? 'border-emerald-400/35 bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/15'
                        : 'border-[#1E293B] text-slate-300 hover:border-emerald-400/25 hover:text-slate-100',
                    ].join(' ')}
                  >
                    <span className="flex items-center gap-2">
                      <Icon aria-hidden className="size-3.5" strokeWidth={1.9} />
                      {action.label}
                    </span>
                    <ArrowUpRight
                      aria-hidden
                      className="size-3.5 opacity-50 transition-transform group-hover:translate-x-0.5 group-hover:opacity-100"
                      strokeWidth={1.75}
                    />
                  </Link>
                );
              })}
            </div>
          </section>

          {isOwner && plan && requestMeter ? (
            <Panel
              title="Retainer this period"
              subtitle={`${plan.tier.name} · ${plan.period.label}`}
              action={
                <Link
                  href="/subscription"
                  className="text-[11px] text-emerald-300 underline-offset-4 hover:underline"
                >
                  Details
                </Link>
              }
            >
              <Meter
                label="Service requests"
                used={requestMeter.quantity}
                included={requestMeter.included}
                unit={requestMeter.unit}
                percent={requestMeter.percentUsed}
                state={requestMeter.state}
              />
              <p className="mt-3 flex items-start gap-1.5 text-[10px] leading-relaxed text-slate-500">
                <Info aria-hidden className="mt-0.5 size-3 shrink-0" strokeWidth={1.75} />
                Usage is metered per request, not per hour — this plan model has no hours bucket.
              </p>
            </Panel>
          ) : null}
        </div>
      </div>
    </div>
  );
}
