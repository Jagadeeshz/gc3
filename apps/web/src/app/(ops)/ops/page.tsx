'use client';

import { useEffect, useMemo, useState } from 'react';
import { CircleSlash, Info, ShieldCheck } from 'lucide-react';
import { useSession } from '@/lib/session-context';
import {
  OPS_BACKING_LABEL,
  OPS_PERSONA_LABEL,
  opsPersonaFor,
  opsTabsFor,
  resolveOpsTab,
  type OpsTab,
} from '@/lib/ops-nav';
import {
  AnalyticsPanel,
  CataloguePanel,
  DeliverablesPanel,
  FinancePanel,
  KnowledgePanel,
  MemberDeskPanel,
  NotificationsPanel,
  OverviewPanel,
  PodsPanel,
  ProfilePanel,
  RegionsPanel,
  RenewalsPanel,
  RequestsPanel,
  RetentionPanel,
  SettingsPanel,
  SlaPanel,
  StaffPanel,
  SubscriptionsPanel,
  TasksPanel,
  TenantsPanel,
  UnbackedPanel,
  WorkloadPanel,
} from '@/components/ops/panels';

/**
 * The staff console.
 *
 * One route, six workspaces. The persona comes from the session's platform role —
 * never from the URL — so a pod member cannot address the administrator's tabs by
 * typing `?tab=audit-logs`; the tab list is chosen before the query string is
 * read, and an unknown tab falls back to the persona's first.
 *
 * Tabs are a query parameter rather than sixty route files because they are
 * views of the same console, not different places: switching tab must not
 * re-mount the shell or lose the sidebar.
 */
export default function OpsPage() {
  const { session, ready } = useSession();

  const persona = session ? opsPersonaFor(session.actor.platformRole) : null;
  const tabs = useMemo(() => (persona ? opsTabsFor(persona) : []), [persona]);

  const [activeKey, setActiveKey] = useState<string | null>(null);

  // Read the tab once on mount. Deep links keep working; the URL is not the
  // authority — `resolveOpsTab` re-checks the key against this persona's tabs.
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const key = new URLSearchParams(window.location.search).get('tab');
    setActiveKey(key);
  }, []);

  useEffect(() => {
    if (!persona || typeof window === 'undefined') {
      return;
    }

    const initial = new URLSearchParams(window.location.search).get('tab');

    if (!initial && activeKey === null) {
      return;
    }

    if (initial !== activeKey && activeKey !== null) {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', activeKey);
      window.history.replaceState(null, '', url.toString());
    }
  }, [activeKey, persona]);

  if (!ready) {
    return <p className="text-sm text-slate-500">Opening the console…</p>;
  }

  if (!session) {
    return <p className="text-sm text-slate-500">Sign in to open the operations console.</p>;
  }

  if (!persona) {
    return (
      <div className="mx-auto mt-10 max-w-[520px] rounded-[14px] border border-white/10 bg-[rgba(12,16,32,0.55)] p-6 text-center">
        <CircleSlash aria-hidden className="mx-auto size-6 text-amber-300" strokeWidth={1.75} />
        <h1 className="mt-3 font-display text-lg text-slate-100">No staff workspace for this account</h1>
        <p className="mt-2 text-[12px] leading-relaxed text-slate-400">
          This session has no platform role, so it has no operations workspace. Client accounts work in
          their own portal.
        </p>
      </div>
    );
  }

  const active: OpsTab = resolveOpsTab(persona, activeKey);
  const token = session.accessToken;
  const role = session.actor.platformRole ?? 'unknown';

  return (
    <div className="grid gap-5">
      <header className="grid gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">
              {OPS_PERSONA_LABEL[persona]} workspace · {tabs.length} tabs
            </p>
            <h1 className="mt-1.5 font-display text-[26px] font-semibold leading-none tracking-[-0.01em] text-slate-100">
              {active.label}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.12em] ${
                active.backing === 'live'
                  ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300'
                  : active.backing === 'partial'
                    ? 'border-amber-400/30 bg-amber-400/10 text-amber-300'
                    : 'border-red-400/25 bg-red-400/[0.07] text-red-300'
              }`}
            >
              <span className="size-1.5 rounded-full bg-current" />
              {OPS_BACKING_LABEL[active.backing]}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-slate-400">
              <ShieldCheck aria-hidden className="size-3" strokeWidth={1.75} />
              {role}
            </span>
          </div>
        </div>

        {active.note ? (
          <p className="flex items-start gap-1.5 rounded-[12px] border border-amber-400/20 bg-amber-400/[0.06] px-3 py-2 text-[11px] leading-relaxed text-amber-200/90">
            <Info aria-hidden className="mt-0.5 size-3 shrink-0" strokeWidth={1.75} />
            {active.note}
          </p>
        ) : null}

        {/* Tab strip — this persona's tabs, in the order the workspace defines. */}
        <nav
          aria-label={`${OPS_PERSONA_LABEL[persona]} sections`}
          className="flex flex-wrap gap-1 border-b border-white/10 pb-2"
        >
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = tab.key === active.key;

            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveKey(tab.key)}
                aria-current={isActive ? 'page' : undefined}
                className={[
                  'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[12px] transition-colors',
                  isActive
                    ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200'
                    : 'border-transparent text-slate-400 hover:bg-white/[0.04] hover:text-slate-200',
                ].join(' ')}
              >
                <Icon
                  aria-hidden
                  className={`size-3.5 ${isActive ? 'text-emerald-300' : 'text-slate-500'}`}
                  strokeWidth={1.75}
                />
                {tab.label}
                {tab.backing === 'unbacked' ? (
                  <span
                    aria-label="not instrumented"
                    title="Not instrumented"
                    className="ml-0.5 size-1.5 rounded-full bg-amber-400/70"
                  />
                ) : null}
              </button>
            );
          })}
        </nav>
      </header>

      <main>{renderPanel(active, token, role)}</main>
    </div>
  );
}

function renderPanel(tab: OpsTab, token: string, role: string) {
  switch (tab.panel) {
    case 'overview':
      return <OverviewPanel token={token} />;
    case 'member-desk':
      return <MemberDeskPanel token={token} />;
    case 'tasks':
      // The pod member's board is their own work; everyone else's is the
      // allocation board the API scopes by pod or platform.
      return <TasksPanel token={token} mine={role === 'SPECIALIST'} />;
    case 'my-requests':
      return <RequestsPanel token={token} mine />;
    case 'my-deliverables':
      return <DeliverablesPanel token={token} mine />;
    case 'requests':
      return <RequestsPanel token={token} />;
    case 'deliverables':
      return <DeliverablesPanel token={token} />;
    case 'workload':
      return <WorkloadPanel token={token} capacity={tab.key === 'capacity' || tab.key === 'capacity-planning'} />;
    case 'staff':
      return <StaffPanel token={token} />;
    case 'tenants':
      return <TenantsPanel token={token} />;
    case 'pods':
      return <PodsPanel token={token} />;
    case 'catalogue':
      return <CataloguePanel token={token} />;
    case 'notifications':
      return <NotificationsPanel token={token} />;
    case 'finance':
      return <FinancePanel token={token} />;
    case 'subscriptions':
      return <SubscriptionsPanel token={token} />;
    case 'renewals':
      return <RenewalsPanel token={token} />;
    case 'sla':
      return <SlaPanel token={token} />;
    case 'regions':
      return <RegionsPanel token={token} />;
    case 'retention':
      return <RetentionPanel token={token} />;
    case 'analytics':
      return <AnalyticsPanel token={token} />;
    case 'profile':
      return <ProfilePanel token={token} />;
    case 'settings':
      return <SettingsPanel token={token} role={role} />;
    case 'knowledge':
      return <KnowledgePanel />;
    case 'unbacked':
    default:
      return <UnbackedPanel tab={tab} />;
  }
}
