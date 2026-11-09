'use client';

import Link from 'next/link';
import { Building2, CreditCard, ShieldCheck, Users } from 'lucide-react';
import { useSession } from '@/lib/session-context';
import { activeRoles } from '@/lib/session';
import {
  PageHeader,
  Panel,
  RestrictedPanel,
} from '@/components/portal/kit';

/**
 * Settings — owner only.
 *
 * The tenant record as this session sees it, plus the routes to everything an
 * owner administers. Deliberately read-only: renaming a tenant is
 * `organization:update`, which a client role does not hold — the API would answer
 * 403 — and inventing an inline editor that always fails would be theatre.
 */
const ROLE_LABEL: Record<string, string> = {
  CLIENT_OWNER: 'Owner',
  CLIENT_TEAM_MEMBER: 'Team member',
  CLIENT_APPROVER: 'Approver',
};

export default function SettingsPage() {
  const { session } = useSession();

  if (!session) {
    return <p className="text-sm text-slate-400">Loading…</p>;
  }

  const isOwner = activeRoles(session).includes('CLIENT_OWNER');
  const organization =
    session.organizations.find((org) => org.id === session.activeOrganizationId) ?? null;

  if (!isOwner) {
    return (
      <RestrictedPanel
        title="Workspace settings are for account owners"
        body="Only a client owner can review the workspace record. Your profile is always available to you."
        href="/profile"
        label="Open my profile"
      />
    );
  }

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Account"
        title="Settings"
        description="The workspace record, who administers it, and the controls that belong to an owner."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Workspace" subtitle="Read from the authenticated session">
          <dl className="grid gap-3">
            {[
              { label: 'Organization', value: organization?.name ?? '—' },
              { label: 'Slug', value: organization?.slug ?? '—' },
              { label: 'Status', value: organization?.status ?? '—' },
              { label: 'Tenant id', value: organization?.id ?? '—' },
            ].map((row) => (
              <div
                key={row.label}
                className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[color:var(--bindu-surface-border)] pb-2"
              >
                <dt className="text-[11px] uppercase tracking-[0.1em] text-slate-400">{row.label}</dt>
                <dd className="font-mono text-[11px] text-slate-100">{row.value}</dd>
              </div>
            ))}
          </dl>

          <p className="mt-4 flex items-start gap-2 text-[11px] leading-relaxed text-slate-400">
            <ShieldCheck aria-hidden className="mt-0.5 size-3.5 shrink-0 text-gold-light" strokeWidth={1.75} />
            Renaming a workspace, and suspending or offboarding one, are staff actions with an audit trail.
            Ask your account manager — the change lands in the workspace audit log with who made it.
          </p>
        </Panel>

        <Panel title="Your role" subtitle="What this session is allowed to do">
          <p className="text-sm text-slate-100">{session.actor.fullName}</p>
          <p className="font-mono text-[11px] text-slate-400">{session.actor.email}</p>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {activeRoles(session).map((role) => (
              <span
                key={role}
                className="rounded-full border border-gold/35 bg-gold/10 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-gold-light"
              >
                {ROLE_LABEL[role] ?? role}
              </span>
            ))}
          </div>

          <p className="mt-4 text-[11px] leading-relaxed text-slate-400">
            An owner can see billing, the subscription and the team roster. Members and approvers work with
            requests, deliverables and messages, and never see commercial data.
          </p>
          <Link
            href="/profile"
            className="mt-3 inline-block text-[11px] text-emerald-300 underline-offset-4 hover:underline"
          >
            Open my profile
          </Link>
        </Panel>
      </div>

      <Panel title="Owner controls" subtitle="Where each administrative job lives">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { href: '/subscription', label: 'Subscription & allowances', icon: CreditCard },
            { href: '/billing', label: 'Billing & invoices', icon: CreditCard },
            { href: '/team', label: 'Team members', icon: Users },
            { href: '/pod', label: 'Delivery pod & routing', icon: Building2 },
          ].map((item) => {
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-2 rounded-[6px] border border-[color:var(--bindu-surface-border)] px-3 py-3 text-xs text-slate-100 transition-colors hover:border-gold/40"
              >
                <Icon aria-hidden className="size-3.5 text-gold-light" strokeWidth={1.75} />
                {item.label}
              </Link>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}
