'use client';

import { useCallback, useEffect, useState } from 'react';
import { Mail, ShieldCheck, UserPlus } from 'lucide-react';
import { ApiClientError, listMemberships, type MembershipListItem } from '@/lib/api-client';
import { useSession } from '@/lib/session-context';
import { activeRoles } from '@/lib/session';
import { formatDate } from '@/components/portal/status';
import {
  ErrorNote,
  Loading,
  PageHeader,
  Panel,
  RestrictedPanel,
} from '@/components/portal/kit';

/**
 * Team Members — owner only.
 *
 * The roster as the API knows it: who has access to this workspace, in what role,
 * and whether they have accepted their invitation yet. Read-only here, on purpose:
 * invitations and role changes are `membership:manage` actions with an audit trail,
 * and a client surface that silently changes access is the wrong place for them.
 */
const ROLE_LABEL: Record<string, string> = {
  CLIENT_OWNER: 'Owner',
  CLIENT_TEAM_MEMBER: 'Team member',
  CLIENT_APPROVER: 'Approver',
};

const STATUS_TONE: Record<string, string> = {
  ACTIVE: 'border-emerald-400/35 bg-emerald-400/10 text-emerald-300',
  INVITED: 'border-emerald-400/35 bg-emerald-400/10 text-emerald-200',
  REVOKED: 'border-red-400/35 bg-red-400/10 text-red-300',
};

export default function TeamPage() {
  const { session } = useSession();
  const token = session?.accessToken ?? null;
  const organizationId = session?.activeOrganizationId ?? null;
  const isOwner = session ? activeRoles(session).includes('CLIENT_OWNER') : false;

  const [rows, setRows] = useState<readonly MembershipListItem[]>([]);
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
      setRows(await listMemberships(token, organizationId));
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'Could not load the team.');
    } finally {
      setLoading(false);
    }
  }, [token, organizationId, isOwner]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!isOwner) {
    return (
      <RestrictedPanel
        title="Team management is for account owners"
        body="Only a client owner can see who has access to this workspace. Ask an owner if you need a colleague added."
      />
    );
  }

  if (loading) return <Loading label="Loading the team…" />;

  const active = rows.filter((row) => row.status === 'ACTIVE').length;
  const invited = rows.filter((row) => row.status === 'INVITED').length;

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Engagement"
        title="Team Members"
        description="Everyone with access to this workspace, and what they are allowed to do."
      />

      {error ? <ErrorNote message={error} /> : null}

      <section className="grid gap-3 sm:grid-cols-3">
        {[
          { label: 'Total seats used', value: rows.length },
          { label: 'Active', value: active },
          { label: 'Invitations pending', value: invited },
        ].map((stat) => (
          <div key={stat.label} className="rounded-[12px] border border-[#1E293B] bg-[#0B1220] p-4">
            <p className="text-[11px] uppercase tracking-[0.1em] text-slate-400">{stat.label}</p>
            <p className="mt-2 font-display text-[26px] font-semibold tabular-nums leading-none text-slate-100">
              {stat.value}
            </p>
          </div>
        ))}
      </section>

      <div className="overflow-hidden rounded-[12px] border border-[#1E293B]">
        <table className="w-full text-left text-xs">
          <thead className="bg-white/[0.03] text-[10px] uppercase tracking-[0.12em] text-slate-400">
            <tr>
              <th className="px-4 py-2.5 font-medium">Member</th>
              <th className="px-4 py-2.5 font-medium">Roles</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5 font-medium">Joined</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-[#1E293B]">
                <td className="px-4 py-3">
                  <p className="text-sm text-slate-100">{row.user.fullName}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 font-mono text-[10px] text-slate-400">
                    <Mail aria-hidden className="size-3" strokeWidth={1.75} />
                    {row.user.email}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <span className="flex flex-wrap gap-1">
                    {row.roles.map((role) => (
                      <span
                        key={role}
                        className="rounded-full border border-[#1E293B] bg-white/5 px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-slate-400"
                      >
                        {ROLE_LABEL[role] ?? role}
                      </span>
                    ))}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] ${
                      STATUS_TONE[row.status] ?? 'border-white/15 bg-white/5 text-slate-400'
                    }`}
                  >
                    {row.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-400">{formatDate(row.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Panel title="Adding and removing people" subtitle="Handled with an audit trail">
        <p className="flex items-start gap-2 text-[11px] leading-relaxed text-slate-400">
          <ShieldCheck aria-hidden className="mt-0.5 size-3.5 shrink-0 text-gold-light" strokeWidth={1.75} />
          Invitations, role changes and revocations are audited actions. Ask your account manager to make
          the change and it will appear in the workspace audit trail with who did it and when.
        </p>
        <p className="mt-2 flex items-start gap-2 text-[11px] leading-relaxed text-slate-400">
          <UserPlus aria-hidden className="mt-0.5 size-3.5 shrink-0 text-gold-light" strokeWidth={1.75} />
          Pending invitations can be re-sent or revoked by the account team without creating a second
          membership.
        </p>
      </Panel>
    </div>
  );
}
