'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowUpRight,
  CalendarClock,
  Check,
  CreditCard,
  Gauge,
  MessageSquare,
  Package,
  Sparkles,
  Timer,
  Users,
  X,
} from 'lucide-react';
import type {
  ClientRole,
  Deliverable,
  Invoice,
  ServiceRequest,
  SubscriptionOverview,
  UsageMeterSnapshot,
} from '@gc3/types';
import {
  ApiClientError,
  addComment,
  listDeliverables,
  listInvoices,
  listMemberships,
  listRequests,
  fetchSubscription,
  updateMembershipRoles,
  type MembershipListItem,
} from '@/lib/api-client';
import { activeRoles } from '@/lib/session';
import { useSession } from '@/lib/session-context';
import { useViewMode } from '@/lib/view-mode';
import {
  deliverableStatusLabel,
  deliverableStatusTone,
  formatDate,
  formatMoney,
  invoiceStatusLabel,
  invoiceStatusTone,
  priorityLabel,
  requestStatusLabel,
  requestStatusTone,
} from '@/components/portal/status';
import { timeAgo } from '@/components/portal/kit';

/**
 * Client overview — one route, two dashboards.
 *
 * The owner's job is buying, paying and governing: what plan are we on, are we about
 * to hit a limit, what is late, who has access. The member's job is doing: what came
 * in, what is mine, what is waiting on my review, and how do I say something about it.
 * Rendering both from one route keeps the URL honest — it is still "the workspace",
 * seen by someone with a different job.
 *
 * Both dashboards read the same endpoints the rest of the portal reads. Nothing on
 * this page is a mock: an empty state means the workspace is empty.
 */

const TONE: Record<string, string> = {
  positive: 'border-emerald-400/35 bg-emerald-400/10 text-emerald-300',
  warning: 'border-amber-400/40 bg-amber-400/10 text-amber-300',
  danger: 'border-red-400/35 bg-red-400/10 text-red-300',
  neutral: 'border-white/12 bg-white/[0.04] text-slate-400',
  gold: 'border-gold/35 bg-gold/10 text-gold-light',
};

function Pill({ label, tone = 'neutral' }: { readonly label: string; readonly tone?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-[2px] font-mono text-[9px] uppercase tracking-[0.1em] ${TONE[tone] ?? TONE.neutral}`}
    >
      {label}
    </span>
  );
}

function GlassCard({
  children,
  className = '',
  interactive = false,
}: {
  readonly children: React.ReactNode;
  readonly className?: string;
  readonly interactive?: boolean;
}) {
  return (
    <div
      className={`rounded-[8px] border border-[color:var(--bindu-surface-border)] bg-white/[0.025] backdrop-blur-sm ${
        interactive
          ? 'transition-[transform,border-color,background-color] duration-300 hover:-translate-y-0.5 hover:border-emerald-400/30 hover:bg-white/[0.045] motion-reduce:hover:translate-y-0'
          : ''
      } ${className}`}
    >
      {children}
    </div>
  );
}

function MeterRow({ meter }: { readonly meter: UsageMeterSnapshot }) {
  const tone = meter.state === 'EXCEEDED' ? 'danger' : meter.state === 'WARNING' ? 'warning' : 'positive';
  const width = Math.min(100, meter.percentUsed);

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-slate-500">{meter.key}</span>
        <span className="font-mono text-[10px] tabular-nums text-slate-300">
          {meter.quantity.toLocaleString()} / {meter.included.toLocaleString()}
          <span className="text-slate-600"> {meter.unit}</span>
        </span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className={`h-full rounded-full transition-[width] duration-700 ${
            meter.state === 'EXCEEDED'
              ? 'bg-red-400'
              : meter.state === 'WARNING'
                ? 'bg-amber-400'
                : 'bg-[linear-gradient(90deg,#10B981,#34D399)]'
          }`}
          style={{ width: `${width}%` }}
        />
      </div>
      <div className="mt-1 flex items-center justify-between">
        <Pill label={meter.state} tone={tone} />
        <span className="font-mono text-[9px] text-slate-600">{meter.percentUsed}%</span>
      </div>
    </div>
  );
}

// ==================================================================== data hook
interface Workspace {
  readonly requests: readonly ServiceRequest[];
  readonly membership: readonly MembershipListItem[];
  readonly subscription: SubscriptionOverview | null;
  readonly invoices: readonly Invoice[];
  readonly loading: boolean;
  readonly error: string | null;
  readonly reload: () => void;
}

function useWorkspace(token: string | null, organizationId: string | null, wantOwnerData: boolean): Workspace {
  const [requests, setRequests] = useState<readonly ServiceRequest[]>([]);
  const [membership, setMembership] = useState<readonly MembershipListItem[]>([]);
  const [subscription, setSubscription] = useState<SubscriptionOverview | null>(null);
  const [invoices, setInvoices] = useState<readonly Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  useEffect(() => {
    if (!token || !organizationId) {
      setLoading(false);
      return;
    }

    let alive = true;
    setLoading(true);
    setError(null);

    const fail = (caught: unknown) => {
      if (!alive) return;
      setError(caught instanceof ApiClientError ? caught.message : 'Could not load the workspace.');
    };

    listRequests(token, organizationId, { pageSize: 100 })
      .then((page) => {
        if (alive) setRequests(page.items);
      })
      .catch(fail);

    Promise.all([
      listMemberships(token, organizationId).catch(() => [] as readonly MembershipListItem[]),
      wantOwnerData ? fetchSubscription(token, organizationId).catch(() => null) : Promise.resolve(null),
      wantOwnerData
        ? listInvoices(token, organizationId, { pageSize: 3 }).then((page) => page.items).catch(() => [])
        : Promise.resolve([] as readonly Invoice[]),
    ])
      .then(([roster, sub, bills]) => {
        if (!alive) return;
        setMembership(roster);
        setSubscription(sub);
        setInvoices(bills);
      })
      .catch(fail)
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [token, organizationId, wantOwnerData, nonce]);

  return { requests, membership, subscription, invoices, loading, error, reload };
}

// ==================================================================== page
export default function ClientOverviewPage() {
  const { session } = useSession();
  const roles = session ? activeRoles(session) : [];
  const holdsOwner = roles.includes('CLIENT_OWNER');
  const [mode] = useViewMode(holdsOwner);
  const isOwnerView = holdsOwner && mode === 'owner';

  const workspace = useWorkspace(
    session?.accessToken ?? null,
    session?.activeOrganizationId ?? null,
    isOwnerView,
  );

  const firstName = (session?.actor?.fullName ?? session?.actor?.email ?? 'there').split(' ')[0];
  const now = new Date();
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening';

  if (workspace.loading) {
    return (
      <div className="grid gap-4">
        <div className="h-16 animate-pulse rounded-[8px] bg-white/[0.03]" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-[8px] bg-white/[0.03]" />
          ))}
        </div>
        <div className="h-64 animate-pulse rounded-[8px] bg-white/[0.03]" />
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-emerald-300/90">
            {isOwnerView ? 'Owner workspace' : 'Member workspace'}
          </p>
          <h1 className="mt-2 font-display text-[clamp(1.5rem,2.6vw,2rem)] leading-[1.05] tracking-[-0.02em] text-ghost">
            {greeting}, {firstName}
          </h1>
          <p className="mt-1.5 text-[12.5px] text-ghost-muted">
            {isOwnerView
              ? 'Plan, delivery and access for this workspace.'
              : 'What came in, what is yours, and what is waiting on your review.'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[color:var(--bindu-surface-border)] bg-white/[0.03] px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.1em] text-slate-400">
            <CalendarClock aria-hidden className="size-3" strokeWidth={2} />
            {now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
          </span>
          {!holdsOwner ? <Pill label="Team member" tone="neutral" /> : null}
        </div>
      </header>

      {workspace.error ? (
        <p className="rounded-[8px] border border-red-400/30 bg-red-400/[0.07] px-4 py-3 text-[12px] text-red-300">
          {workspace.error}
        </p>
      ) : null}

      {isOwnerView ? (
        <OwnerDashboard workspace={workspace} token={session?.accessToken ?? null} organizationId={session?.activeOrganizationId ?? null} />
      ) : (
        <MemberDashboard
          workspace={workspace}
          token={session?.accessToken ?? null}
          organizationId={session?.activeOrganizationId ?? null}
          userId={session?.actor?.userId ?? null}
        />
      )}
    </div>
  );
}

// ==================================================================== owner
function OwnerDashboard({
  workspace,
  token,
  organizationId,
}: {
  readonly workspace: Workspace;
  readonly token: string | null;
  readonly organizationId: string | null;
}) {
  const open = workspace.requests.filter((r) => !['CLOSED', 'CANCELLED', 'DRAFT'].includes(r.status));
  const atRisk = open.filter((r) => r.slaTargetAt && new Date(r.slaTargetAt).getTime() < Date.now());
  const latestInvoice = workspace.invoices[0] ?? null;
  const usage = workspace.subscription?.usage ?? [];
  const requestMeter = usage.find((m) => m.key === 'REQUESTS') ?? null;

  const columns: readonly { key: string; title: string; statuses: readonly string[] }[] = [
    { key: 'submitted', title: 'Submitted', statuses: ['SUBMITTED', 'TRIAGE'] },
    { key: 'progress', title: 'In progress', statuses: ['IN_PROGRESS'] },
    { key: 'review', title: 'In review', statuses: ['IN_REVIEW'] },
    { key: 'done', title: 'Delivered', statuses: ['DELIVERED', 'CLOSED'] },
  ];

  return (
    <>
      {/* executive stats */}
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <GlassCard interactive className="p-4">
          <div className="flex items-start justify-between">
            <span className="grid size-8 place-items-center rounded-lg bg-emerald-400/12 text-emerald-300">
              <Sparkles aria-hidden className="size-4" strokeWidth={1.9} />
            </span>
            <Pill label={workspace.subscription?.subscription.status ?? 'no plan'} tone="positive" />
          </div>
          <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.12em] text-slate-500">Active subscription</p>
          <p className="mt-1 font-display text-[22px] font-semibold leading-none text-ghost">
            {workspace.subscription?.tier.name ?? '—'}
          </p>
          <p className="mt-1.5 text-[11px] text-ghost-muted">
            {workspace.subscription
              ? `${formatMoney(workspace.subscription.tier.monthlyPriceCents, workspace.subscription.tier.currency)} / month`
              : 'No plan attached'}
          </p>
        </GlassCard>

        <GlassCard interactive className="p-4">
          <div className="flex items-start justify-between">
            <span className="grid size-8 place-items-center rounded-lg bg-emerald-400/12 text-emerald-300">
              <Gauge aria-hidden className="size-4" strokeWidth={1.9} />
            </span>
            <Pill label={requestMeter?.state ?? 'n/a'} tone={requestMeter?.state === 'EXCEEDED' ? 'danger' : requestMeter?.state === 'WARNING' ? 'warning' : 'positive'} />
          </div>
          <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.12em] text-slate-500">Requests this period</p>
          <p className="mt-1 font-display text-[22px] font-semibold leading-none tabular-nums text-ghost">
            {requestMeter ? `${requestMeter.quantity} / ${requestMeter.included}` : '—'}
          </p>
          <p className="mt-1.5 text-[11px] text-ghost-muted">
            {requestMeter ? `${requestMeter.remaining} left in ${workspace.subscription?.period.label}` : 'Usage not metered'}
          </p>
        </GlassCard>

        <GlassCard interactive className="p-4">
          <div className="flex items-start justify-between">
            <span className="grid size-8 place-items-center rounded-lg bg-amber-400/12 text-amber-300">
              <Timer aria-hidden className="size-4" strokeWidth={1.9} />
            </span>
            <Pill label={`${open.length} open`} tone="neutral" />
          </div>
          <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.12em] text-slate-500">Delivery commitments</p>
          <p className="mt-1 font-display text-[22px] font-semibold leading-none tabular-nums text-ghost">
            {atRisk.length} <span className="text-[13px] font-normal text-ghost-muted">past target</span>
          </p>
          <p className="mt-1.5 text-[11px] text-ghost-muted">
            {atRisk.length === 0 ? 'Everything open is inside its commitment' : 'Escalated to the pod lead automatically'}
          </p>
        </GlassCard>

        <GlassCard interactive className="p-4">
          <div className="flex items-start justify-between">
            <span className="grid size-8 place-items-center rounded-lg bg-emerald-400/12 text-emerald-300">
              <CreditCard aria-hidden className="size-4" strokeWidth={1.9} />
            </span>
            {latestInvoice ? <Pill label={invoiceStatusLabel(latestInvoice.status)} tone={invoiceStatusTone(latestInvoice.status)} /> : null}
          </div>
          <p className="mt-3 font-mono text-[9px] uppercase tracking-[0.12em] text-slate-500">Latest invoice</p>
          <p className="mt-1 font-display text-[22px] font-semibold leading-none tabular-nums text-ghost">
            {latestInvoice ? formatMoney(latestInvoice.totalCents, latestInvoice.currency) : '—'}
          </p>
          <p className="mt-1.5 text-[11px] text-ghost-muted">
            {latestInvoice ? `${latestInvoice.number} · ${formatDate(latestInvoice.periodStart)}` : 'Nothing billed yet'}
          </p>
        </GlassCard>
      </section>

      {usage.length > 0 ? (
        <GlassCard className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[13px] font-semibold text-ghost">Plan usage</h2>
            <Link href="/subscription" className="inline-flex items-center gap-1 text-[11px] text-emerald-300 hover:underline">
              Manage plan
              <ArrowUpRight aria-hidden className="size-3" strokeWidth={2} />
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {usage.map((meter) => (
              <MeterRow key={meter.key} meter={meter} />
            ))}
          </div>
        </GlassCard>
      ) : null}

      {/* kanban */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[13px] font-semibold text-ghost">Project status</h2>
          <Link href="/requests" className="text-[11px] text-emerald-300 hover:underline">
            All requests
          </Link>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {columns.map((column) => {
            const items = workspace.requests.filter((request) => column.statuses.includes(request.status));

            return (
              <div key={column.key} className="rounded-[8px] border border-white/[0.06] bg-[color:var(--bindu-void-1)] p-2.5">
                <div className="mb-2 flex items-center justify-between px-1">
                  <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-slate-500">{column.title}</span>
                  <span className="font-mono text-[10px] tabular-nums text-slate-400">{items.length}</span>
                </div>
                <div className="grid gap-2">
                  {items.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-[color:var(--bindu-surface-border)] px-3 py-6 text-center text-[11px] text-slate-600">
                      Nothing here
                    </p>
                  ) : (
                    items.map((request) => {
                      // A closed request cannot be "late": it is history, and the
                      // commitment was judged when it closed.
                      const finished = ['CLOSED', 'CANCELLED'].includes(request.status);
                      const late =
                        !finished && request.slaTargetAt !== null && new Date(request.slaTargetAt).getTime() < Date.now();

                      return (
                        <Link
                          key={request.id}
                          href={`/requests/${request.id}`}
                          className="group rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-emerald-400/35 motion-reduce:hover:translate-y-0"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-[9px] uppercase tracking-[0.1em] text-slate-600">{request.reference}</span>
                            <Pill
                              label={priorityLabel(request.priority)}
                              tone={request.priority === 'URGENT' ? 'danger' : request.priority === 'HIGH' ? 'warning' : 'neutral'}
                            />
                          </div>
                          <p className="mt-1.5 line-clamp-2 text-[12px] leading-snug text-slate-200 group-hover:text-ghost">{request.title}</p>
                          <div className="mt-2 flex items-center justify-between">
                            <Pill label={requestStatusLabel(request.status)} tone={requestStatusTone(request.status)} />
                            {request.slaTargetAt && !finished ? (
                              <span className={`font-mono text-[9px] ${late ? 'text-red-300' : 'text-slate-500'}`}>
                                {late ? 'late' : formatDate(request.slaTargetAt)}
                              </span>
                            ) : null}
                          </div>
                        </Link>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <TeamPermissions workspace={workspace} token={token} organizationId={organizationId} />
    </>
  );
}

// ==================================================================== team toggles
const ASSIGNABLE: readonly { role: ClientRole; label: string; help: string }[] = [
  { role: 'CLIENT_TEAM_MEMBER', label: 'Workspace access', help: 'Open requests, comment, read deliverables' },
  { role: 'CLIENT_APPROVER', label: 'Approve work', help: 'Sign off and release deliverables' },
];

function TeamPermissions({
  workspace,
  token,
  organizationId,
}: {
  readonly workspace: Workspace;
  readonly token: string | null;
  readonly organizationId: string | null;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggle = useCallback(
    async (member: MembershipListItem, role: ClientRole) => {
      if (!token || !organizationId) return;

      const current = [...member.roles];
      const next = current.includes(role) ? current.filter((r) => r !== role) : [...current, role];

      // The last owner cannot be demoted — the API refuses it with 409, and saying so
      // up front is kinder than a failed request.
      if (current.includes('CLIENT_OWNER') && !next.includes('CLIENT_OWNER')) {
        setError('An owner cannot remove their own owner role. Promote someone else first.');
        return;
      }

      setBusy(`${member.id}:${role}`);
      setError(null);

      try {
        await updateMembershipRoles(token, organizationId, member.userId, next);
        workspace.reload();
      } catch (caught) {
        setError(caught instanceof ApiClientError ? caught.message : 'Could not change that role.');
      } finally {
        setBusy(null);
      }
    },
    [token, organizationId, workspace],
  );

  return (
    <GlassCard className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
        <div className="flex items-center gap-2">
          <Users aria-hidden className="size-4 text-emerald-300" strokeWidth={1.9} />
          <h2 className="text-[13px] font-semibold text-ghost">Team & permissions</h2>
        </div>
        <Link href="/team" className="text-[11px] text-emerald-300 hover:underline">
          Manage roster
        </Link>
      </div>

      {error ? (
        <p className="border-b border-white/[0.06] bg-red-400/[0.07] px-4 py-2 text-[11.5px] text-red-300">{error}</p>
      ) : null}

      <ul className="divide-y divide-white/[0.05]">
        {workspace.membership.map((member) => (
          <li key={member.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[linear-gradient(140deg,#34D399,#0EA5A0)] font-mono text-[10px] font-bold text-[color:var(--bindu-void)]">
                {member.user.fullName.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="truncate text-[12.5px] text-slate-200">{member.user.fullName}</p>
                <p className="truncate font-mono text-[9.5px] text-slate-500">{member.user.email}</p>
              </div>
              <Pill
                label={member.roles.includes('CLIENT_OWNER') ? 'Owner' : member.roles.includes('CLIENT_APPROVER') ? 'Approver' : 'Member'}
                tone={member.roles.includes('CLIENT_OWNER') ? 'positive' : 'neutral'}
              />
            </div>

            <div className="flex items-center gap-3">
              {ASSIGNABLE.map((permission) => {
                const on = member.roles.includes(permission.role);
                const pending = busy === `${member.id}:${permission.role}`;
                const locked = member.status !== 'ACTIVE';

                return (
                  <button
                    key={permission.role}
                    type="button"
                    role="switch"
                    aria-checked={on}
                    aria-label={`${permission.label} for ${member.user.fullName}`}
                    title={locked ? 'Invitation pending' : permission.help}
                    disabled={pending || locked}
                    onClick={() => void toggle(member, permission.role)}
                    className={`group inline-flex items-center gap-2 rounded-full border px-2 py-1 transition-colors disabled:opacity-50 ${
                      on ? 'border-emerald-400/40 bg-emerald-400/10' : 'border-[color:var(--bindu-surface-border)] bg-white/[0.03] hover:border-white/20'
                    }`}
                  >
                    <span
                      className={`relative h-3.5 w-6 rounded-full transition-colors ${on ? 'bg-emerald-400' : 'bg-slate-700'}`}
                    >
                      <span
                        className={`absolute top-0.5 size-2.5 rounded-full bg-white transition-all ${on ? 'left-3' : 'left-0.5'}`}
                      />
                    </span>
                    <span className={`text-[10.5px] ${on ? 'text-emerald-200' : 'text-slate-400'}`}>{permission.label}</span>
                  </button>
                );
              })}
            </div>
          </li>
        ))}
        {workspace.membership.length === 0 ? (
          <li className="px-4 py-8 text-center text-[12px] text-slate-500">No memberships in this workspace.</li>
        ) : null}
      </ul>
    </GlassCard>
  );
}

// ==================================================================== member
function MemberDashboard({
  workspace,
  token,
  organizationId,
  userId,
}: {
  readonly workspace: Workspace;
  readonly token: string | null;
  readonly organizationId: string | null;
  readonly userId: string | null;
}) {
  const [deliverables, setDeliverables] = useState<readonly (Deliverable & { requestTitle: string })[]>([]);
  const [commenting, setCommenting] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const openRequests = useMemo(
    () => workspace.requests.filter((r) => !['CLOSED', 'CANCELLED', 'DRAFT'].includes(r.status)),
    [workspace.requests],
  );

  const mine = useMemo(
    () => workspace.requests.filter((request) => userId !== null && request.assigneeId === userId),
    [workspace.requests, userId],
  );

  const activity = useMemo(
    () =>
      [...workspace.requests]
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 6),
    [workspace.requests],
  );

  useEffect(() => {
    if (!token || !organizationId) return;

    let alive = true;
    const targets = [...workspace.requests]
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .slice(0, 8);

    Promise.all(
      targets.map((request) =>
        listDeliverables(token, organizationId, request.id)
          .then((rows) => rows.map((row) => ({ ...row, requestTitle: request.title })))
          .catch(() => [] as (Deliverable & { requestTitle: string })[]),
      ),
    ).then((groups) => {
      if (alive) setDeliverables(groups.flat().slice(0, 6));
    });

    return () => {
      alive = false;
    };
  }, [token, organizationId, workspace.requests]);

  const needsReview = useMemo(
    () => deliverables.filter((item) => item.status === 'IN_REVIEW'),
    [deliverables],
  );

  const recent = useMemo(
    () => deliverables.filter((item) => item.status !== 'IN_REVIEW').slice(0, 3),
    [deliverables],
  );

  const submitComment = useCallback(
    async (requestId: string) => {
      if (!token || !organizationId || draft.trim().length === 0) return;

      setSending(true);
      setNotice(null);

      try {
        await addComment(token, organizationId, requestId, draft.trim(), false);
        setDraft('');
        setCommenting(null);
        setNotice('Comment added to the thread.');
        workspace.reload();
      } catch (caught) {
        setNotice(caught instanceof ApiClientError ? caught.message : 'Could not post that comment.');
      } finally {
        setSending(false);
      }
    },
    [draft, token, organizationId, workspace],
  );

  return (
    <>
      {/* awaiting review — the member's actual job */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[13px] font-semibold text-ghost">
            {needsReview.length > 0 ? `Waiting on your review · ${needsReview.length}` : 'Recently delivered'}
          </h2>
          <Link href="/deliverables" className="text-[11px] text-emerald-300 hover:underline">
            All deliverables
          </Link>
        </div>

        {(needsReview.length > 0 ? needsReview : recent).length === 0 ? (
          <GlassCard className="p-8 text-center">
            <Package aria-hidden className="mx-auto size-5 text-slate-600" strokeWidth={1.6} />
            <p className="mt-2 text-[12.5px] text-slate-400">Nothing in review right now.</p>
            <p className="mt-1 text-[11px] text-slate-600">
              Deliverables appear here as soon as a pod submits them against an open request.
            </p>
          </GlassCard>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {(needsReview.length > 0 ? needsReview : recent).map((item) => (
              <GlassCard key={item.id} interactive className="group overflow-hidden">
                <div className="relative flex h-28 items-center justify-center overflow-hidden border-b border-white/[0.06] bg-[radial-gradient(120%_120%_at_50%_0%,rgba(16,185,129,0.16),rgba(8,13,21,0.9))]">
                  <Package
                    aria-hidden
                    className="size-8 text-emerald-300/40 transition-transform duration-500 group-hover:scale-125"
                    strokeWidth={1.4}
                  />
                  <span className="absolute left-2.5 top-2.5">
                    <Pill label={deliverableStatusLabel(item.status)} tone={deliverableStatusTone(item.status)} />
                  </span>
                  <span className="absolute bottom-2 right-2.5 font-mono text-[9px] text-slate-500">v{item.version}</span>
                </div>

                <div className="p-3">
                  <p className="truncate text-[12.5px] text-slate-200">{item.title}</p>
                  <p className="mt-0.5 truncate text-[10.5px] text-slate-500">{item.requestTitle}</p>

                  <div className="mt-2 flex items-center justify-between">
                    <span className="font-mono text-[9px] text-slate-600">{timeAgo(item.updatedAt)}</span>
                    {item.requestId ? (
                      <button
                        type="button"
                        onClick={() => {
                          setCommenting(commenting === item.id ? null : item.id);
                          setDraft('');
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-[color:var(--bindu-surface-border)] px-2 py-1 text-[10.5px] text-slate-300 transition-colors hover:border-emerald-400/35 hover:text-emerald-200"
                      >
                        <MessageSquare aria-hidden className="size-3" strokeWidth={2} />
                        Comment
                      </button>
                    ) : null}
                  </div>

                  {commenting === item.id && item.requestId ? (
                    <div className="mt-2">
                      <textarea
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        rows={3}
                        maxLength={2000}
                        placeholder="What needs changing?"
                        aria-label={`Comment on ${item.title}`}
                        className="w-full resize-none rounded-lg border border-[color:var(--bindu-surface-border)] bg-[color:var(--bindu-void-1)] px-2.5 py-2 text-[11.5px] text-slate-100 placeholder:text-slate-600 focus:border-emerald-400/50 focus:outline-none"
                      />
                      <div className="mt-1.5 flex items-center justify-between">
                        <button
                          type="button"
                          onClick={() => setCommenting(null)}
                          className="inline-flex items-center gap-1 text-[10.5px] text-slate-500 hover:text-slate-300"
                        >
                          <X aria-hidden className="size-3" strokeWidth={2} />
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={sending || draft.trim().length === 0}
                          onClick={() => void submitComment(item.requestId as string)}
                          className="rounded-lg border border-emerald-400/40 bg-emerald-400/15 px-2.5 py-1 text-[10.5px] font-medium text-emerald-100 disabled:opacity-50"
                        >
                          {sending ? 'Sending…' : 'Post'}
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </GlassCard>
            ))}
          </div>
        )}

        {notice ? (
          <p className="mt-2 flex items-center gap-1.5 text-[11.5px] text-emerald-300">
            <Check aria-hidden className="size-3.5" strokeWidth={2.4} />
            {notice}
          </p>
        ) : null}
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)]">
        {/* activity */}
        <GlassCard className="overflow-hidden">
          <div className="border-b border-white/[0.06] px-4 py-3">
            <h2 className="text-[13px] font-semibold text-ghost">Workspace activity</h2>
          </div>
          <ul className="divide-y divide-white/[0.05]">
            {activity.map((request) => (
              <li key={request.id}>
                <Link
                  href={`/requests/${request.id}`}
                  className="flex items-start gap-3 px-4 py-3 transition-colors hover:bg-white/[0.03]"
                >
                  <span
                    aria-hidden
                    className={`mt-1.5 size-1.5 shrink-0 rounded-full ${
                      request.status === 'IN_REVIEW' ? 'bg-amber-400' : request.status === 'IN_PROGRESS' ? 'bg-emerald-400' : 'bg-slate-500'
                    }`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] text-slate-200">{request.title}</span>
                    <span className="mt-0.5 block font-mono text-[9.5px] uppercase tracking-[0.1em] text-slate-600">
                      {request.reference} · {timeAgo(request.updatedAt)}
                    </span>
                  </span>
                  <Pill label={requestStatusLabel(request.status)} tone={requestStatusTone(request.status)} />
                </Link>
              </li>
            ))}
            {activity.length === 0 ? (
              <li className="px-4 py-8 text-center text-[12px] text-slate-500">No activity yet.</li>
            ) : null}
          </ul>
        </GlassCard>

        {/* assigned tickets */}
        <GlassCard className="overflow-hidden">
          <div className="border-b border-white/[0.06] px-4 py-3">
            <h2 className="text-[13px] font-semibold text-ghost">Assigned to you</h2>
          </div>
          <ul className="divide-y divide-white/[0.05]">
            {mine.map((request) => (
              <li key={request.id}>
                <Link href={`/requests/${request.id}`} className="block px-4 py-3 transition-colors hover:bg-white/[0.03]">
                  <p className="truncate text-[12.5px] text-slate-200">{request.title}</p>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <Pill label={requestStatusLabel(request.status)} tone={requestStatusTone(request.status)} />
                    <Pill label={priorityLabel(request.priority)} tone={request.priority === 'URGENT' ? 'danger' : 'neutral'} />
                  </div>
                </Link>
              </li>
            ))}
            {mine.length === 0 ? (
              <li className="px-4 py-8 text-center text-[12px] text-slate-500">
                Nothing assigned to you directly — work is tracked at pod level.
              </li>
            ) : null}
          </ul>
        </GlassCard>
      </div>
    </>
  );
}
