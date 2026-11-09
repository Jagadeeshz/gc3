'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { BarSeries, ChartPanel, GradientKpi, LineSeries } from '@/components/portal/dashboard-kit';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowUpRight,
  BadgeCheck,
  CircleSlash,
  Clock,
  Download,
  Info,
} from 'lucide-react';
import type {
  AnalyticsReport,
  AuthActor,
  FinanceOverview,
  OpsCatalogueRow,
  OpsDeliverableRow,
  OpsNotificationRow,
  OpsRequestRow,
  OpsStaffRow,
  OpsTaskRow,
  OpsTenantRow,
  OpsWorkloadRow,
} from '@gc3/types';
import {
  ApiClientError,
  fetchAnalytics,
  fetchFinanceOverview,
  fetchMe,
  fetchOpsDashboard,
  fetchQueueHealth,
  opsCatalogue,
  opsDeliverables,
  opsMyDeliverables,
  opsMyRequests,
  opsNotifications,
  opsOrganizations,
  opsRequests,
  opsStaff,
  opsTasks,
  opsWorkload,
} from '@/lib/api-client';
import type { OpsTab } from '@/lib/ops-nav';
import { EmptyState, ErrorNote, Loading, Panel, StatCard } from '@/components/portal/kit';
import { formatDate } from '@/components/portal/status';

/**
 * The panels behind every staff tab.
 *
 * Each one fetches its own rows and says what it is reading. Where a panel cannot
 * be honest with real data it renders `NotInstrumented` rather than a plausible
 * number — a staff console that invents a figure is worse than one that admits a
 * gap, because people make decisions from these screens.
 */

const money = (minorUnits: number): string =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(minorUnits / 100);

const num = (value: number): string => new Intl.NumberFormat('en-IN').format(value);

function useAsync<T>(loader: () => Promise<T>, deps: readonly unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const run = useCallback(() => {
    let alive = true;
    setLoading(true);
    setError(null);

    loader()
      .then((value) => {
        if (alive) setData(value);
      })
      .catch((caught: unknown) => {
        if (alive) {
          setError(caught instanceof ApiClientError ? caught.message : 'Could not load this board.');
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  useEffect(run, [run]);

  return { data, error, loading, reload: run };
}

interface Column<T> {
  readonly header: string;
  readonly cell: (row: T) => ReactNode;
  readonly align?: 'right' | 'left';
  readonly width?: string;
}

function DataTable<T>({
  columns,
  rows,
  keyOf,
  empty,
}: {
  readonly columns: readonly Column<T>[];
  readonly rows: readonly T[];
  readonly keyOf: (row: T) => string;
  readonly empty: ReactNode;
}) {
  if (rows.length === 0) {
    return <>{empty}</>;
  }

  return (
    <div className="overflow-x-auto rounded-[10px] border border-[#1E293B]">
      <table className="w-full border-collapse text-left text-[12px]">
        <thead>
          <tr className="bg-white/[0.03]">
            {columns.map((column) => (
              <th
                key={column.header}
                style={column.width ? { width: column.width } : undefined}
                className={`whitespace-nowrap px-3 py-2 font-mono text-[9px] uppercase tracking-[0.14em] text-slate-500 ${
                  column.align === 'right' ? 'text-right' : 'text-left'
                }`}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={keyOf(row)} className="border-t border-[#1E293B]/70 hover:bg-white/[0.015]">
              {columns.map((column) => (
                <td
                  key={column.header}
                  className={`px-3 py-2 align-top text-slate-300 ${
                    column.align === 'right' ? 'text-right tabular-nums' : ''
                  }`}
                >
                  {column.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Chip({ text, tone }: { readonly text: string; readonly tone: 'ok' | 'warn' | 'bad' | 'muted' }) {
  const cls = {
    ok: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
    warn: 'border-amber-400/30 bg-amber-400/10 text-amber-300',
    bad: 'border-red-400/30 bg-red-400/10 text-red-300',
    muted: 'border-[#1E293B] bg-white/[0.03] text-slate-400',
  }[tone];

  return (
    <span className={`inline-block whitespace-nowrap rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] ${cls}`}>
      {text}
    </span>
  );
}

const slaTone = (state: string): 'ok' | 'warn' | 'bad' | 'muted' =>
  state === 'MISSED' ? 'bad' : state === 'AT_RISK' ? 'warn' : state === 'ON_TRACK' || state === 'MET' ? 'ok' : 'muted';

const requestTone = (status: string): 'ok' | 'warn' | 'bad' | 'muted' =>
  status === 'BLOCKED' || status === 'CANCELLED'
    ? 'bad'
    : status === 'IN_REVIEW' || status === 'TRIAGE'
      ? 'warn'
      : status === 'IN_PROGRESS'
        ? 'ok'
        : status === 'DELIVERED' || status === 'CLOSED'
          ? 'ok'
          : 'muted';

function NotInstrumented({ tab }: { readonly tab: OpsTab }) {
  return (
    <Panel title={tab.label} subtitle="Not instrumented yet">
      <div className="flex items-start gap-3">
        <CircleSlash aria-hidden className="mt-0.5 size-4 shrink-0 text-amber-300" strokeWidth={1.75} />
        <div className="grid gap-2">
          <p className="text-[12px] leading-relaxed text-slate-300">{tab.note}</p>
          <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-slate-500">
            <Info aria-hidden className="mt-0.5 size-3 shrink-0" strokeWidth={1.75} />
            This screen will stay empty until that model exists. It is listed here rather than filled with
            sample rows so the console can be trusted about what it does and does not know.
          </p>
        </div>
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Panels
// ---------------------------------------------------------------------------

export function OverviewPanel({ token }: { readonly token: string }) {
  const { data, error, loading } = useAsync(() => fetchOpsDashboard(token), [token]);

  if (loading) return <Loading label="Reading the platform…" />;
  if (error) return <ErrorNote message={error} />;
  if (!data) return null;

  return (
    <div className="grid gap-4">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <GradientKpi
          tint="teal"
          icon={Clock}
          label="Open requests"
          value={num(data.totals.openRequests)}
          sub={`${num(data.totals.unassignedRequests)} unassigned · ${num(data.totals.blockedRequests)} blocked`}
          trailing="platform"
        />
        <GradientKpi
          tint={data.totals.slaBreached > 0 ? 'rose' : data.totals.slaAtRisk > 0 ? 'gold' : 'sky'}
          icon={AlertTriangle}
          label="SLA at risk"
          value={num(data.totals.slaAtRisk)}
          sub={`${num(data.totals.slaBreached)} already breached`}
          trailing="commitments"
        />
        <GradientKpi
          tint="violet"
          icon={BadgeCheck}
          label="Client accounts"
          value={num(data.totals.organizations)}
          sub={`${num(data.totals.pods)} delivery pods`}
          trailing="tenants"
        />
        <GradientKpi
          tint="prism"
          icon={Download}
          label="Released deliverables"
          value={num(data.totals.releasedDeliverables)}
          sub={`${num(data.totals.overdueRequests)} requests overdue`}
          trailing="released"
        />
      </section>

      {/* Per-tenant shape of the platform: where the open work sits and where the commitments are
          at risk. Both are the same array the directory below renders, read twice. */}
      <section className="grid gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <ChartPanel title="Open requests per account" value={`${num(data.totals.openRequests)} total`}>
          <BarSeries
            tint="teal"
            data={data.organizations.slice(0, 8).map((org) => ({
              label: org.name.split(' ')[0] ?? org.name,
              value: org.openRequests,
            }))}
          />
        </ChartPanel>

        <ChartPanel title="SLA risk per account" value={`${num(data.totals.slaAtRisk)} at risk`}>
          <LineSeries
            tint="gold"
            data={data.organizations.slice(0, 8).map((org) => ({
              label: org.name.split(' ')[0] ?? org.name,
              value: org.slaAtRisk,
            }))}
          />
        </ChartPanel>
      </section>

      <Panel title="Client accounts" subtitle="Open work per tenant" action={<Link href="/ops?tab=client-accounts" className="text-[11px] text-emerald-300 hover:underline">Directory</Link>}>
        <DataTable
          rows={data.organizations}
          keyOf={(row) => row.organizationId}
          empty={<EmptyState title="No tenants yet" body="A tenant appears here once an organization exists." />}
          columns={[
            { header: 'Account', cell: (row) => <span className="text-slate-100">{row.name}</span> },
            { header: 'Open', align: 'right', cell: (row) => num(row.openRequests) },
            { header: 'Pods', align: 'right', cell: (row) => num(row.podCount) },
            { header: 'SLA risk', align: 'right', cell: (row) => num(row.slaAtRisk) },
          ]}
        />
      </Panel>

      <Panel title="Queue" subtitle="Oldest open work first">
        <DataTable
          rows={data.queue}
          keyOf={(row) => row.requestId}
          empty={<EmptyState title="Queue is clear" body="Nothing is waiting to be picked up." />}
          columns={[
            { header: 'Reference', cell: (row) => <span className="font-mono text-[11px] text-slate-400">{row.reference}</span> },
            { header: 'Request', cell: (row) => row.title },
            { header: 'Tenant', cell: (row) => row.organizationName },
            { header: 'Status', cell: (row) => <Chip text={row.status} tone={requestTone(row.status)} /> },
            { header: 'SLA', cell: (row) => <Chip text={row.slaState} tone={slaTone(row.slaState)} /> },
            { header: 'Due', align: 'right', cell: (row) => row.dueAt ? formatDate(row.dueAt) : '—' },
          ]}
        />
      </Panel>
    </div>
  );
}

export function TasksPanel({ token, mine }: { readonly token: string; readonly mine?: boolean }) {
  const { data, error, loading } = useAsync(() => opsTasks(token, mine ? { mine: true } : {}), [token, mine]);

  if (loading) return <Loading label="Loading the task board…" />;
  if (error) return <ErrorNote message={error} />;

  const rows = data ?? [];
  const overdue = rows.filter((row) => row.overdue).length;

  return (
    <div className="grid gap-4">
      <section className="grid gap-3 sm:grid-cols-3">
        <StatCard label={mine ? 'My open tasks' : 'Open tasks in scope'} value={rows.filter((row) => row.status !== 'DONE').length} icon={Clock} />
        <StatCard label="Overdue" value={overdue} icon={AlertTriangle} tone={overdue > 0 ? 'critical' : 'default'} />
        <StatCard label="Due date known" value={rows.filter((row) => row.dueAt).length} icon={BadgeCheck} hint={`${rows.length} tasks in total`} />
      </section>

      <Panel title={mine ? 'My tasks' : 'Task allocation'} subtitle="Ordered by due date, undated last">
        <DataTable
          rows={rows}
          keyOf={(row) => row.id}
          empty={<EmptyState title="No tasks" body={mine ? 'Nothing is assigned to you right now.' : 'Nothing is allocated in your scope.'} />}
          columns={[
            { header: 'Task', cell: (row) => <span className="text-slate-100">{row.title}</span> },
            { header: 'Request', cell: (row) => <span className="font-mono text-[11px] text-slate-400">{row.requestReference}</span> },
            { header: 'Tenant', cell: (row) => row.organizationName },
            { header: 'Pod', cell: (row) => row.podName ?? '—' },
            { header: 'Assignee', cell: (row) => row.assigneeName ?? 'Unassigned' },
            { header: 'Status', cell: (row) => <Chip text={row.status} tone={row.status === 'DONE' ? 'ok' : row.status === 'BLOCKED' ? 'bad' : 'muted'} /> },
            { header: 'Due', align: 'right', cell: (row) => <span className={row.overdue ? 'text-red-300' : ''}>{row.dueAt ? formatDate(row.dueAt) : '—'}</span> },
          ]}
        />
      </Panel>
    </div>
  );
}

export function MemberDeskPanel({ token }: { readonly token: string }) {
  const tasks = useAsync(() => opsTasks(token, { mine: true }), [token]);
  const requests = useAsync(() => opsMyRequests(token), [token]);

  if (tasks.loading || requests.loading) return <Loading label="Loading your workspace…" />;
  if (tasks.error) return <ErrorNote message={tasks.error} />;
  if (requests.error) return <ErrorNote message={requests.error} />;

  const openTasks = (tasks.data ?? []).filter((row) => row.status !== 'DONE');
  const openRequests = (requests.data ?? []).filter((row) => !['CLOSED', 'CANCELLED', 'DELIVERED'].includes(row.status));

  return (
    <div className="grid gap-4">
      <section className="grid gap-3 sm:grid-cols-3">
        <StatCard label="My open tasks" value={openTasks.length} icon={Clock} tone={openTasks.length > 0 ? 'warning' : 'default'} />
        <StatCard label="Overdue" value={openTasks.filter((row) => row.overdue).length} icon={AlertTriangle} tone={openTasks.some((row) => row.overdue) ? 'critical' : 'default'} />
        <StatCard label="Active projects" value={openRequests.length} icon={BadgeCheck} hint="Requests your tasks belong to" />
      </section>

      <Panel title="Next up" subtitle="Your open tasks, soonest due first">
        <DataTable
          rows={openTasks.slice(0, 8)}
          keyOf={(row) => row.id}
          empty={<EmptyState title="Nothing assigned" body="You have no open tasks. New work appears here when a pod manager allocates it." />}
          columns={[
            { header: 'Task', cell: (row) => <span className="text-slate-100">{row.title}</span> },
            { header: 'Request', cell: (row) => <span className="font-mono text-[11px] text-slate-400">{row.requestReference}</span> },
            { header: 'Tenant', cell: (row) => row.organizationName },
            { header: 'Due', align: 'right', cell: (row) => <span className={row.overdue ? 'text-red-300' : ''}>{row.dueAt ? formatDate(row.dueAt) : '—'}</span> },
          ]}
        />
      </Panel>

      <Panel title="My projects" subtitle="Requests your work belongs to">
        <DataTable
          rows={openRequests}
          keyOf={(row) => row.id}
          empty={<EmptyState title="No active projects" body="Nothing of yours is in flight." />}
          columns={[
            { header: 'Reference', cell: (row) => <span className="font-mono text-[11px] text-slate-400">{row.reference}</span> },
            { header: 'Request', cell: (row) => row.title },
            { header: 'Tenant', cell: (row) => row.organizationName },
            { header: 'Status', cell: (row) => <Chip text={row.status} tone={requestTone(row.status)} /> },
            { header: 'SLA', cell: (row) => <Chip text={row.slaState} tone={row.slaState === 'BREACHED' ? 'bad' : row.slaState === 'WARNING' ? 'warn' : row.slaState === 'OK' ? 'ok' : 'muted'} /> },
          ]}
        />
      </Panel>
    </div>
  );
}

export function RequestsPanel({ token, mine }: { readonly token: string; readonly mine?: boolean }) {
  const { data, error, loading } = useAsync(
    () => (mine ? opsMyRequests(token) : opsRequests(token, { limit: 100 })),
    [token, mine],
  );

  if (loading) return <Loading label="Loading requests…" />;
  if (error) return <ErrorNote message={error} />;

  const rows = data ?? [];
  const breached = rows.filter((row) => row.slaState === 'BREACHED').length;

  return (
    <div className="grid gap-4">
      <section className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Requests" value={rows.length} icon={Clock} hint="Most recently updated first" />
        <StatCard label="In progress" value={rows.filter((row) => row.status === 'IN_PROGRESS').length} icon={BadgeCheck} tone="positive" />
        <StatCard label="SLA breached" value={breached} icon={AlertTriangle} tone={breached > 0 ? 'critical' : 'default'} />
      </section>

      <Panel title="Service requests" subtitle="Cross-tenant delivery board">
        <DataTable
          rows={rows}
          keyOf={(row) => row.id}
          empty={<EmptyState title="No requests" body="Nothing has been raised in this scope." />}
          columns={[
            { header: 'Reference', cell: (row) => <span className="font-mono text-[11px] text-slate-400">{row.reference}</span> },
            { header: 'Request', cell: (row) => <span className="text-slate-100">{row.title}</span> },
            { header: 'Tenant', cell: (row) => row.organizationName },
            { header: 'Pod', cell: (row) => row.podName ?? <span className="text-amber-300">Unrouted</span> },
            { header: 'Status', cell: (row) => <Chip text={row.status} tone={requestTone(row.status)} /> },
            { header: 'Priority', cell: (row) => <Chip text={row.priority} tone={row.priority === 'URGENT' ? 'bad' : row.priority === 'HIGH' ? 'warn' : 'muted'} /> },
            { header: 'SLA', cell: (row) => <Chip text={row.slaState} tone={row.slaState === 'BREACHED' ? 'bad' : row.slaState === 'WARNING' ? 'warn' : row.slaState === 'OK' ? 'ok' : 'muted'} /> },
          ]}
        />
      </Panel>
    </div>
  );
}

export function DeliverablesPanel({ token, mine }: { readonly token: string; readonly mine?: boolean }) {
  const { data, error, loading } = useAsync(
    () => (mine ? opsMyDeliverables(token) : opsDeliverables(token, { limit: 100 })),
    [token, mine],
  );

  if (loading) return <Loading label="Loading deliverables…" />;
  if (error) return <ErrorNote message={error} />;

  const rows = data ?? [];
  const inReview = rows.filter((row) => row.status === 'IN_REVIEW').length;

  return (
    <div className="grid gap-4">
      <section className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Deliverables" value={rows.length} icon={Download} />
        <StatCard label="Awaiting review" value={inReview} icon={Clock} tone={inReview > 0 ? 'warning' : 'default'} />
        <StatCard label="Released" value={rows.filter((row) => row.status === 'RELEASED').length} icon={BadgeCheck} tone="positive" />
      </section>

      <Panel title="Deliverables" subtitle="Newest first">
        <DataTable
          rows={rows}
          keyOf={(row) => row.id}
          empty={<EmptyState title="Nothing produced yet" body="Deliverables appear here once a pod uploads work against a request." />}
          columns={[
            { header: 'Title', cell: (row) => <span className="text-slate-100">{row.title}</span> },
            { header: 'Version', align: 'right', cell: (row) => `v${row.version}` },
            { header: 'Request', cell: (row) => <span className="font-mono text-[11px] text-slate-400">{row.requestReference ?? '—'}</span> },
            { header: 'Tenant', cell: (row) => row.organizationName },
            { header: 'Status', cell: (row) => <Chip text={row.status} tone={row.status === 'RELEASED' || row.status === 'APPROVED' ? 'ok' : row.status === 'REJECTED' ? 'bad' : row.status === 'IN_REVIEW' ? 'warn' : 'muted'} /> },
            { header: 'Updated', align: 'right', cell: (row) => formatDate(row.updatedAt) },
          ]}
        />
      </Panel>
    </div>
  );
}

export function WorkloadPanel({ token, capacity }: { readonly token: string; readonly capacity: boolean }) {
  const { data, error, loading } = useAsync(() => opsWorkload(token), [token]);

  if (loading) return <Loading label="Loading workload…" />;
  if (error) return <ErrorNote message={error} />;

  const rows = data ?? [];
  const heaviest = rows[0]?.openTasks ?? 0;

  return (
    <div className="grid gap-4">
      <Panel
        title={capacity ? 'Capacity' : 'Team performance'}
        subtitle="Open, overdue and due-today tasks per person"
      >
        <p className="mb-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-slate-500">
          <Info aria-hidden className="mt-0.5 size-3 shrink-0" strokeWidth={1.75} />
          There is no timesheet model, so this is load — not utilisation. No percentage is shown against an
          invented capacity; the bar is relative to the busiest person, which is a fact.
        </p>

        <div className="grid gap-2">
          {rows.length === 0 ? (
            <EmptyState title="No load recorded" body="Nobody in scope has an open task." />
          ) : (
            rows.map((row) => (
              <div key={row.userId} className="rounded-[10px] border border-[#1E293B] px-3 py-2.5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <p className="text-[12px] text-slate-100">{row.fullName}</p>
                    <p className="font-mono text-[10px] text-slate-500">
                      {row.platformRole} · {row.pods.length > 0 ? row.pods.join(', ') : 'no pod'}
                    </p>
                  </div>
                  <p className="font-mono text-[11px] tabular-nums text-slate-300">
                    {num(row.openTasks)} open · {num(row.overdueTasks)} overdue · {num(row.dueToday)} due today
                  </p>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#1E293B]">
                  <div
                    className={`h-full ${row.overdueTasks > 0 ? 'bg-amber-400/80' : 'bg-emerald-400/80'}`}
                    style={{ width: `${Math.max(4, Math.round((row.openTasks / Math.max(1, heaviest)) * 100))}%` }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </Panel>
    </div>
  );
}

export function StaffPanel({ token }: { readonly token: string }) {
  const { data, error, loading } = useAsync(() => opsStaff(token), [token]);

  if (loading) return <Loading label="Loading the staff directory…" />;
  if (error) return <ErrorNote message={error} />;

  const rows = data ?? [];
  const byRole = rows.reduce<Record<string, number>>((acc, row) => {
    acc[row.platformRole] = (acc[row.platformRole] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="grid gap-4">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Staff accounts" value={rows.length} icon={BadgeCheck} />
        <StatCard label="Seated in a pod" value={rows.filter((row) => row.pods.length > 0).length} icon={Clock} />
        <StatCard label="Carrying overdue work" value={rows.filter((row) => row.overdueTasks > 0).length} icon={AlertTriangle} tone={rows.some((row) => row.overdueTasks > 0) ? 'warning' : 'default'} />
        <StatCard label="Distinct roles" value={Object.keys(byRole).length} icon={BadgeCheck} />
      </section>

      <Panel title="Users & roles" subtitle="Global staff roles and pod seating">
        <DataTable
          rows={rows}
          keyOf={(row) => row.id}
          empty={<EmptyState title="No staff accounts" body="Only users with a platform role appear here." />}
          columns={[
            { header: 'Name', cell: (row) => <span className="text-slate-100">{row.fullName}</span> },
            { header: 'Email', cell: (row) => <span className="font-mono text-[11px] text-slate-400">{row.email}</span> },
            { header: 'Role', cell: (row) => <Chip text={row.platformRole} tone="muted" /> },
            { header: 'Pods', cell: (row) => row.pods.length > 0 ? row.pods.map((pod) => pod.name).join(', ') : '—' },
            { header: 'Open', align: 'right', cell: (row) => num(row.openTasks) },
            { header: 'Overdue', align: 'right', cell: (row) => <span className={row.overdueTasks > 0 ? 'text-red-300' : ''}>{num(row.overdueTasks)}</span> },
          ]}
        />
      </Panel>
    </div>
  );
}

export function TenantsPanel({ token }: { readonly token: string }) {
  const { data, error, loading } = useAsync(() => opsOrganizations(token), [token]);

  if (loading) return <Loading label="Loading client accounts…" />;
  if (error) return <ErrorNote message={error} />;

  const rows = data ?? [];
  const mrr = rows.reduce((sum, row) => sum + (row.plan.monthlyPricePaise ?? 0), 0);

  return (
    <div className="grid gap-4">
      <section className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Client accounts" value={rows.length} icon={BadgeCheck} />
        <StatCard label="With open work" value={rows.filter((row) => row.counts.openRequests > 0).length} icon={Clock} tone="warning" />
        <StatCard label="Recurring revenue" value={money(mrr)} icon={Download} hint="From active plans, minor units" tone="positive" />
      </section>

      <Panel title="Client accounts" subtitle="Counts are live; plan is the current subscription">
        <DataTable
          rows={rows}
          keyOf={(row) => row.id}
          empty={<EmptyState title="No accounts" body="Create an organization to see it here." />}
          columns={[
            { header: 'Account', cell: (row) => <span className="text-slate-100">{row.name}</span> },
            { header: 'Region', cell: (row) => row.region },
            { header: 'Plan', cell: (row) => row.plan.tierName ?? <span className="text-slate-500">none</span> },
            { header: 'Status', cell: (row) => <Chip text={row.plan.status ?? 'UNPROVISIONED'} tone={row.plan.status === 'ACTIVE' ? 'ok' : row.plan.status ? 'warn' : 'muted'} /> },
            { header: 'Members', align: 'right', cell: (row) => num(row.counts.members) },
            { header: 'Open', align: 'right', cell: (row) => num(row.counts.openRequests) },
            { header: 'Pods', align: 'right', cell: (row) => num(row.counts.pods) },
            { header: 'Renews', align: 'right', cell: (row) => row.plan.renewsAt ? formatDate(row.plan.renewsAt) : '—' },
          ]}
        />
      </Panel>
    </div>
  );
}

export function PodsPanel({ token }: { readonly token: string }) {
  const { data, error, loading } = useAsync(() => opsStaff(token), [token]);

  if (loading) return <Loading label="Loading pods…" />;
  if (error) return <ErrorNote message={error} />;

  const grouped = new Map<string, { name: string; people: OpsStaffRow[] }>();

  for (const person of data ?? []) {
    for (const pod of person.pods) {
      const entry = grouped.get(pod.id) ?? { name: pod.name, people: [] };
      entry.people.push(person);
      grouped.set(pod.id, entry);
    }
  }

  const pods = [...grouped.entries()];

  return (
    <div className="grid gap-4">
      {pods.length === 0 ? (
        <EmptyState title="No pods with seated staff" body="A pod appears here once someone is seated in it." />
      ) : (
        pods.map(([id, pod]) => (
          <Panel
            key={id}
            title={pod.name}
            subtitle={`${pod.people.length} seated · ${pod.people.reduce((sum, person) => sum + person.openTasks, 0)} open tasks`}
          >
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {pod.people.map((person) => (
                <div key={person.id} className="rounded-[10px] border border-[#1E293B] px-3 py-2">
                  <p className="text-[12px] text-slate-100">{person.fullName}</p>
                  <p className="font-mono text-[10px] text-slate-500">{person.platformRole}</p>
                  <p className="mt-1 font-mono text-[10px] tabular-nums text-slate-400">
                    {num(person.openTasks)} open · {num(person.overdueTasks)} overdue
                  </p>
                </div>
              ))}
            </div>
          </Panel>
        ))
      )}
    </div>
  );
}

export function CataloguePanel({ token }: { readonly token: string }) {
  const { data, error, loading } = useAsync(() => opsCatalogue(token), [token]);

  if (loading) return <Loading label="Loading the catalogue…" />;
  if (error) return <ErrorNote message={error} />;

  const rows = data ?? [];

  return (
    <Panel title="Service catalogue" subtitle="Every tenant's services and delivery commitments">
      <DataTable
        rows={rows}
        keyOf={(row) => row.id}
        empty={<EmptyState title="Catalogue is empty" body="Services are defined per tenant; none exist yet." />}
        columns={[
          { header: 'Service', cell: (row) => <span className="text-slate-100">{row.name}</span> },
          { header: 'Slug', cell: (row) => <span className="font-mono text-[11px] text-slate-400">{row.slug}</span> },
          { header: 'Tenant', cell: (row) => row.organizationName },
          { header: 'SLA', align: 'right', cell: (row) => row.slaDeliveryHours === null ? '—' : `${row.slaDeliveryHours}h` },
          { header: 'State', cell: (row) => <Chip text={row.isActive ? 'active' : 'inactive'} tone={row.isActive ? 'ok' : 'muted'} /> },
        ]}
      />
    </Panel>
  );
}

export function NotificationsPanel({ token }: { readonly token: string }) {
  const { data, error, loading } = useAsync(() => opsNotifications(token), [token]);

  if (loading) return <Loading label="Loading delivery attempts…" />;
  if (error) return <ErrorNote message={error} />;

  const rows: readonly OpsNotificationRow[] = data ?? [];
  const failed = rows.filter((row) => row.status === 'FAILED').length;

  return (
    <div className="grid gap-4">
      <section className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Recent attempts" value={rows.length} icon={BadgeCheck} />
        <StatCard label="Failed" value={failed} icon={AlertTriangle} tone={failed > 0 ? 'critical' : 'positive'} hint="Retries run on a backoff schedule" />
        <StatCard label="Delivered" value={rows.filter((row) => row.status === 'SENT').length} icon={Download} tone="positive" />
      </section>

      <Panel title="Notification deliveries" subtitle="Every attempt, including the ones that failed">
        <DataTable
          rows={rows}
          keyOf={(row) => row.id}
          empty={<EmptyState title="Nothing sent yet" body="Invitations and event mail appear here with their delivery state." />}
          columns={[
            { header: 'Recipient', cell: (row) => <span className="font-mono text-[11px] text-slate-300">{row.recipient}</span> },
            { header: 'Kind', cell: (row) => <Chip text={row.kind} tone="muted" /> },
            { header: 'Tenant', cell: (row) => row.organizationName },
            { header: 'Status', cell: (row) => <Chip text={row.status} tone={row.status === 'SENT' ? 'ok' : row.status === 'FAILED' ? 'bad' : 'warn'} /> },
            { header: 'Attempt', align: 'right', cell: (row) => num(row.attempt) },
            { header: 'When', align: 'right', cell: (row) => formatDate(row.createdAt) },
            { header: 'Error', cell: (row) => row.error ? <span className="text-[11px] text-red-300">{row.error.slice(0, 60)}</span> : '—' },
          ]}
        />
      </Panel>
    </div>
  );
}

export function FinancePanel({ token }: { readonly token: string }) {
  const { data, error, loading } = useAsync(() => fetchFinanceOverview(token), [token]);

  if (loading) return <Loading label="Reading revenue…" />;
  if (error) return <ErrorNote message={error} />;
  if (!data) return null;

  return (
    <div className="grid gap-4">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Recurring revenue" value={money(data.mrrCents)} icon={Download} hint={`${num(data.organizations)} subscribed accounts`} tone="positive" />
        <StatCard label="Outstanding" value={money(data.invoices.outstandingCents)} icon={Clock} hint={`${num(data.invoices.issued)} issued · ${num(data.invoices.overdue)} overdue`} tone={data.invoices.overdue > 0 ? 'warning' : 'default'} />
        <StatCard label="Settled" value={money(data.invoices.paidCents)} icon={BadgeCheck} hint={`${num(data.invoices.paid)} paid invoices`} tone="positive" />
        <StatCard label="Drafts" value={data.invoices.draft} icon={CircleSlash} hint="Generated, not yet issued" />
      </section>

      <Panel title="Revenue by plan" subtitle="Where the recurring revenue comes from">
        <DataTable
          rows={data.byTier}
          keyOf={(row) => row.tierCode}
          empty={<EmptyState title="No subscribed tenants" body="A plan appears once a subscription is provisioned." />}
          columns={[
            { header: 'Plan', cell: (row) => <span className="text-slate-100">{row.tierName}</span> },
            { header: 'Accounts', align: 'right', cell: (row) => num(row.organizations) },
            { header: 'MRR', align: 'right', cell: (row) => money(row.mrrCents) },
          ]}
        />
      </Panel>

      <Panel title="Tenant ledger" subtitle="Plan, run rate and this period's usage" action={<Link href="/ops/billing" className="text-[11px] text-emerald-300 hover:underline">Billing console</Link>}>
        <DataTable
          rows={data.tenants}
          keyOf={(row) => row.id}
          empty={<EmptyState title="No tenants" body="Nothing to bill yet." />}
          columns={[
            { header: 'Tenant', cell: (row) => <span className="text-slate-100">{row.name}</span> },
            { header: 'Plan', cell: (row) => row.tierName ?? '—' },
            { header: 'Status', cell: (row) => <Chip text={row.status ?? 'NONE'} tone={row.status === 'ACTIVE' ? 'ok' : row.status ? 'warn' : 'muted'} /> },
            { header: 'Requests', align: 'right', cell: (row) => num(row.requestsThisPeriod) },
            { header: 'Storage MB', align: 'right', cell: (row) => num(row.storageMbThisPeriod) },
            { header: 'MRR', align: 'right', cell: (row) => money(row.mrrCents) },
          ]}
        />
      </Panel>
    </div>
  );
}

export function SubscriptionsPanel({ token }: { readonly token: string }) {
  const { data, error, loading } = useAsync(() => fetchFinanceOverview(token), [token]);

  if (loading) return <Loading label="Reading subscriptions…" />;
  if (error) return <ErrorNote message={error} />;
  if (!data) return null;

  const active = data.tenants.filter((row) => row.status === 'ACTIVE').length;

  return (
    <div className="grid gap-4">
      <section className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Active subscriptions" value={active} icon={BadgeCheck} tone="positive" />
        <StatCard label="Without a plan" value={data.tenants.filter((row) => row.status === null).length} icon={Clock} hint="Provisioned on first read" />
        <StatCard label="Plans in use" value={data.byTier.length} icon={Download} />
      </section>

      <Panel title="Plan mix" subtitle="Accounts and revenue per plan">
        <DataTable
          rows={data.byTier}
          keyOf={(row) => row.tierCode}
          empty={<EmptyState title="No plans" body="Seed the tier catalogue to offer plans." />}
          columns={[
            { header: 'Plan', cell: (row) => <span className="text-slate-100">{row.tierName}</span> },
            { header: 'Accounts', align: 'right', cell: (row) => num(row.organizations) },
            { header: 'MRR', align: 'right', cell: (row) => money(row.mrrCents) },
          ]}
        />
      </Panel>
    </div>
  );
}

export function RenewalsPanel({ token }: { readonly token: string }) {
  const { data, error, loading } = useAsync(() => opsOrganizations(token), [token]);

  if (loading) return <Loading label="Reading renewal dates…" />;
  if (error) return <ErrorNote message={error} />;

  const rows = [...(data ?? [])]
    .filter((row) => row.plan.renewsAt !== null)
    .sort((a, b) => new Date(a.plan.renewsAt ?? 0).getTime() - new Date(b.plan.renewsAt ?? 0).getTime());

  return (
    <Panel title="Renewals" subtitle="Sorted by the current subscription period end">
      <p className="mb-3 text-[11px] leading-relaxed text-slate-500">
        Read from each subscription's period end. There is no renewal workflow, so nothing on this screen
        records whether anyone has spoken to the client.
      </p>
      <DataTable
        rows={rows}
        keyOf={(row) => row.id}
        empty={<EmptyState title="No dated subscriptions" body="A tenant appears once its plan has a billing period." />}
        columns={[
          { header: 'Account', cell: (row) => <span className="text-slate-100">{row.name}</span> },
          { header: 'Plan', cell: (row) => row.plan.tierName ?? '—' },
          { header: 'Value', align: 'right', cell: (row) => money(row.plan.monthlyPricePaise ?? 0) },
          { header: 'Renews', align: 'right', cell: (row) => row.plan.renewsAt ? formatDate(row.plan.renewsAt) : '—' },
        ]}
      />
    </Panel>
  );
}

export function SlaPanel({ token }: { readonly token: string }) {
  const { data, error, loading } = useAsync(() => opsRequests(token, { limit: 100 }), [token]);

  if (loading) return <Loading label="Reading SLA state…" />;
  if (error) return <ErrorNote message={error} />;

  const rows = (data ?? []).filter((row) => row.slaState !== 'NONE');
  const breached = rows.filter((row) => row.slaState === 'BREACHED');
  const warning = rows.filter((row) => row.slaState === 'WARNING');

  return (
    <div className="grid gap-4">
      <section className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Within SLA" value={rows.filter((row) => row.slaState === 'OK').length} icon={BadgeCheck} tone="positive" />
        <StatCard label="At risk" value={warning.length} icon={Clock} tone={warning.length > 0 ? 'warning' : 'default'} />
        <StatCard label="Breached" value={breached.length} icon={AlertTriangle} tone={breached.length > 0 ? 'critical' : 'default'} />
      </section>

      <Panel title="SLA & delivery" subtitle="Target vs elapsed, worst first">
        <DataTable
          rows={[...breached, ...warning]}
          keyOf={(row) => row.id}
          empty={<EmptyState title="Nothing at risk" body="Every open request with a target is inside its window." />}
          columns={[
            { header: 'Reference', cell: (row) => <span className="font-mono text-[11px] text-slate-400">{row.reference}</span> },
            { header: 'Request', cell: (row) => <span className="text-slate-100">{row.title}</span> },
            { header: 'Tenant', cell: (row) => row.organizationName },
            { header: 'State', cell: (row) => <Chip text={row.slaState} tone={row.slaState === 'BREACHED' ? 'bad' : 'warn'} /> },
            { header: 'Target', align: 'right', cell: (row) => row.slaTargetAt ? formatDate(row.slaTargetAt) : '—' },
          ]}
        />
      </Panel>
    </div>
  );
}

export function RegionsPanel({ token }: { readonly token: string }) {
  const { data, error, loading } = useAsync(() => opsOrganizations(token), [token]);

  if (loading) return <Loading label="Grouping by region…" />;
  if (error) return <ErrorNote message={error} />;

  const rows = data ?? [];
  const byRegion = new Map<string, OpsTenantRow[]>();

  for (const row of rows) {
    byRegion.set(row.region, [...(byRegion.get(row.region) ?? []), row]);
  }

  return (
    <div className="grid gap-4">
      <Panel title="Regional performance" subtitle="Accounts grouped by the tenant's region field">
        <p className="mb-3 text-[11px] leading-relaxed text-slate-500">
          Regions are a label on the tenant, not an operating unit: nobody is assigned to a region and no
          regional target exists. Currency is not modelled — every amount in the platform is INR paise.
        </p>
        <DataTable
          rows={[...byRegion.entries()].map(([region, accounts]) => ({ region, accounts }))}
          keyOf={(row) => row.region}
          empty={<EmptyState title="No regions" body="Set a region on a tenant to see it grouped." />}
          columns={[
            { header: 'Region', cell: (row) => <span className="text-slate-100">{row.region}</span> },
            { header: 'Accounts', align: 'right', cell: (row) => num(row.accounts.length) },
            { header: 'Open work', align: 'right', cell: (row) => num(row.accounts.reduce((sum, account) => sum + account.counts.openRequests, 0)) },
            { header: 'Recurring', align: 'right', cell: (row) => money(row.accounts.reduce((sum, account) => sum + (account.plan.monthlyPricePaise ?? 0), 0)) },
          ]}
        />
      </Panel>
    </div>
  );
}

export function RetentionPanel({ token }: { readonly token: string }) {
  const { data, error, loading } = useAsync(() => opsOrganizations(token), [token]);

  if (loading) return <Loading label="Reading subscription state…" />;
  if (error) return <ErrorNote message={error} />;

  const rows = data ?? [];
  const groups = new Map<string, number>();

  for (const row of rows) {
    const key = row.plan.status ?? 'NO PLAN';
    groups.set(key, (groups.get(key) ?? 0) + 1);
  }

  return (
    <div className="grid gap-4">
      <Panel title="Retention" subtitle="Current subscription state by account">
        <p className="mb-3 text-[11px] leading-relaxed text-slate-500">
          This is a snapshot, not a trend: the schema records the current status and a cancellation date,
          but no history of state changes, so no cohort or churn-rate analysis is possible yet.
        </p>
        <DataTable
          rows={[...groups.entries()].map(([status, count]) => ({ status, count }))}
          keyOf={(row) => row.status}
          empty={<EmptyState title="No accounts" body="Nothing to retain yet." />}
          columns={[
            { header: 'State', cell: (row) => <Chip text={row.status} tone={row.status === 'ACTIVE' ? 'ok' : row.status === 'CANCELLED' ? 'bad' : row.status === 'NO PLAN' ? 'muted' : 'warn'} /> },
            { header: 'Accounts', align: 'right', cell: (row) => num(row.count) },
            { header: 'Share', align: 'right', cell: (row) => `${Math.round((row.count / Math.max(1, rows.length)) * 100)}%` },
          ]}
        />
      </Panel>
    </div>
  );
}

export function AnalyticsPanel({ token }: { readonly token: string }) {
  const { data, error, loading } = useAsync(() => fetchAnalytics(token, 90), [token]);

  if (loading) return <Loading label="Computing analytics…" />;
  if (error) return <ErrorNote message={error} />;
  if (!data) return null;

  const report: AnalyticsReport = data;

  return (
    <div className="grid gap-4">
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Turnaround (median)" value={report.turnaround.medianHours === null ? '—' : `${report.turnaround.medianHours.toFixed(1)}h`} icon={Clock} hint={`${num(report.turnaround.sampled)} closed requests sampled`} />
        <StatCard label="On time" value={report.turnaround.onTimeRate === null ? '—' : `${Math.round(report.turnaround.onTimeRate * 100)}%`} icon={BadgeCheck} hint={`${num(report.turnaround.late)} late`} tone={report.turnaround.late > 0 ? 'warning' : 'positive'} />
        <StatCard label="Requests (90d)" value={num(report.totals.requests)} icon={Download} hint={`${num(report.totals.openRequests)} still open`} />
        <StatCard label="Active tenants" value={num(report.totals.activeTenants)} icon={BadgeCheck} hint={`of ${num(report.totals.tenants)} total`} />
      </section>

      <Panel title="Pod efficiency" subtitle="Closed requests per pod with average turnaround">
        <DataTable
          rows={report.pods}
          keyOf={(row) => row.podId}
          empty={<EmptyState title="No pod activity" body="Pods appear once they close work in the window." />}
          columns={[
            { header: 'Pod', cell: (row) => <span className="text-slate-100">{row.podName}</span> },
            { header: 'Open', align: 'right', cell: (row) => num(row.openRequests) },
            { header: 'Closed', align: 'right', cell: (row) => num(row.closedRequests) },
            { header: 'Avg open age', align: 'right', cell: (row) => row.avgOpenAgeHours === null ? '—' : `${row.avgOpenAgeHours.toFixed(1)}h` },
            { header: 'On time', align: 'right', cell: (row) => row.onTimeRate === null ? '—' : `${Math.round(row.onTimeRate * 100)}%` },
          ]}
        />
      </Panel>

      <Panel title="Tenant growth" subtitle="New accounts per month, and the running total" action={<Link href="/ops/analytics" className="text-[11px] text-emerald-300 hover:underline">Full report</Link>}>
        <DataTable
          rows={report.tenantGrowth}
          keyOf={(row) => row.month}
          empty={<EmptyState title="No growth recorded" body="No tenant was created in this window." />}
          columns={[
            { header: 'Month', cell: (row) => <span className="text-slate-100">{row.label}</span> },
            { header: 'New', align: 'right', cell: (row) => num(row.newTenants) },
            { header: 'Cumulative', align: 'right', cell: (row) => num(row.cumulative) },
          ]}
        />
      </Panel>
    </div>
  );
}

export function ProfilePanel({ token }: { readonly token: string }) {
  const { data, error, loading } = useAsync(() => fetchMe(token), [token]);

  if (loading) return <Loading label="Reading your profile…" />;
  if (error) return <ErrorNote message={error} />;
  if (!data) return null;

  const me: AuthActor = data;

  return (
    <Panel title="My profile" subtitle="The identity this session is authenticated as">
      <dl className="grid gap-3 sm:grid-cols-2">
        {[
          { label: 'Name', value: me.fullName },
          { label: 'Email', value: me.email },
          { label: 'Account type', value: me.kind },
          { label: 'Platform role', value: me.platformRole ?? 'none (client)' },
        ].map((row) => (
          <div key={row.label} className="flex items-baseline justify-between border-b border-[#1E293B] pb-2">
            <dt className="font-mono text-[10px] uppercase tracking-[0.12em] text-slate-500">{row.label}</dt>
            <dd className="font-mono text-[11px] text-slate-200">{row.value}</dd>
          </div>
        ))}
      </dl>
    </Panel>
  );
}

export function SettingsPanel({ token, role }: { readonly token: string; readonly role: string }) {
  const queue = useAsync(() => fetchQueueHealth(token), [token]);

  return (
    <div className="grid gap-4">
      <Panel title="Session" subtitle="What this console is running as">
        <p className="text-[12px] text-slate-300">
          Platform role <span className="font-mono text-emerald-300">{role}</span>. Staff roles are global: you
          act across tenants through assignment, never through membership.
        </p>
      </Panel>

      <Panel title="Background dispatch" subtitle="Queue depth and worker heartbeat">
        {queue.loading ? (
          <p className="text-[11px] text-slate-500">Reading the queue…</p>
        ) : queue.error ? (
          <ErrorNote message={queue.error} />
        ) : queue.data ? (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(queue.data.counts).map(([key, value]) => (
              <div key={key} className="rounded-[10px] border border-[#1E293B] px-3 py-2">
                <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-slate-500">{key}</p>
                <p className="mt-1 font-mono text-sm tabular-nums text-slate-200">{num(Number(value))}</p>
              </div>
            ))}
          </div>
        ) : null}
      </Panel>
    </div>
  );
}

export function KnowledgePanel() {
  return (
    <Panel title="Knowledge Centre" subtitle="Where each answer actually lives">
      <div className="grid gap-2">
        {[
          { href: '/ops?tab=service-requests', label: 'A request is stuck', body: 'The delivery board shows status, pod and SLA state; the request detail has the thread.' },
          { href: '/ops?tab=capacity', label: 'Who has room to take work', body: 'Load per person. There is no capacity field, so read it as relative load.' },
          { href: '/ops?tab=sla-delivery', label: 'What is about to breach', body: 'Ordered worst-first by target against elapsed time.' },
          { href: '/ops/audit', label: 'Who changed what', body: 'The security log records role changes, tenant edits and invoice movements.' },
        ].map((entry) => (
          <Link
            key={entry.href}
            href={entry.href}
            className="group flex items-start justify-between gap-3 rounded-[10px] border border-[#1E293B] px-3 py-2.5 transition-colors hover:border-emerald-400/30"
          >
            <span>
              <span className="block text-[12px] text-slate-100">{entry.label}</span>
              <span className="mt-0.5 block text-[11px] text-slate-500">{entry.body}</span>
            </span>
            <ArrowUpRight aria-hidden className="mt-0.5 size-3.5 shrink-0 text-slate-500 group-hover:text-emerald-300" strokeWidth={1.75} />
          </Link>
        ))}
      </div>
    </Panel>
  );
}

export function UnbackedPanel({ tab }: { readonly tab: OpsTab }) {
  return <NotInstrumented tab={tab} />;
}
