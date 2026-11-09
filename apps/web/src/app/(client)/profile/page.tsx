'use client';

import { useCallback, useEffect, useState } from 'react';
import { Mail, ShieldCheck, UserCircle } from 'lucide-react';
import { ApiClientError, fetchMe } from '@/lib/api-client';
import type { AuthActor } from '@gc3/types';
import { useSession } from '@/lib/session-context';
import { activeRoles } from '@/lib/session';
import { ErrorNote, Loading, PageHeader, Panel } from '@/components/portal/kit';

/**
 * My Profile.
 *
 * The member's own record: identity from `GET /auth/me`, and the roles this
 * session holds in the active workspace. Read-only because there is no
 * self-service profile endpoint — a name change goes through the account team,
 * which is also what keeps the audit trail meaningful.
 */
const ROLE_LABEL: Record<string, string> = {
  CLIENT_OWNER: 'Owner',
  CLIENT_TEAM_MEMBER: 'Team member',
  CLIENT_APPROVER: 'Approver',
};

export default function ProfilePage() {
  const { session } = useSession();
  const token = session?.accessToken ?? null;

  const [me, setMe] = useState<AuthActor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      setMe(await fetchMe(token));
    } catch (caught) {
      setError(caught instanceof ApiClientError ? caught.message : 'Could not load your profile.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <Loading label="Loading your profile…" />;

  const organization =
    session?.organizations.find((org) => org.id === session.activeOrganizationId) ?? null;
  const roles = session ? activeRoles(session) : [];

  return (
    <div className="grid gap-6">
      <PageHeader
        eyebrow="Account"
        title="My Profile"
        description="Your identity in this workspace and the roles you hold here."
      />

      {error ? <ErrorNote message={error} /> : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Identity" subtitle="From the authenticated session">
          <div className="flex items-center gap-3">
            <span className="grid size-11 place-items-center rounded-full border border-white/15 bg-white/5 font-display text-lg font-semibold text-slate-100">
              {(me?.fullName ?? session?.actor.fullName ?? '?').slice(0, 1).toUpperCase()}
            </span>
            <div>
              <p className="text-sm font-semibold text-slate-100">
                {me?.fullName ?? session?.actor.fullName}
              </p>
              <p className="flex items-center gap-1.5 font-mono text-[11px] text-slate-400">
                <Mail aria-hidden className="size-3" strokeWidth={1.75} />
                {me?.email ?? session?.actor.email}
              </p>
            </div>
          </div>

          <dl className="mt-5 grid gap-3">
            <div className="flex items-baseline justify-between border-b border-white/10 pb-2">
              <dt className="text-[11px] uppercase tracking-[0.1em] text-slate-400">Account type</dt>
              <dd className="font-mono text-[11px] text-slate-100">{me?.kind ?? 'CLIENT'}</dd>
            </div>
            <div className="flex items-baseline justify-between border-b border-white/10 pb-2">
              <dt className="text-[11px] uppercase tracking-[0.1em] text-slate-400">Workspace</dt>
              <dd className="font-mono text-[11px] text-slate-100">{organization?.name ?? '—'}</dd>
            </div>
            <div className="flex items-baseline justify-between border-b border-white/10 pb-2">
              <dt className="text-[11px] uppercase tracking-[0.1em] text-slate-400">Roles here</dt>
              <dd className="font-mono text-[11px] text-slate-100">
                {roles.length > 0 ? roles.map((role) => ROLE_LABEL[role] ?? role).join(' · ') : '—'}
              </dd>
            </div>
          </dl>
        </Panel>

        <Panel title="Access" subtitle="What your roles allow">
          <p className="flex items-start gap-2 text-[11px] leading-relaxed text-slate-400">
            <ShieldCheck aria-hidden className="mt-0.5 size-3.5 shrink-0 text-gold-light" strokeWidth={1.75} />
            Members and approvers work with the catalogue, requests, deliverables and messages. Billing,
            the subscription and the team roster belong to the workspace owner.
          </p>

          <div className="mt-4 grid gap-2">
            {[
              'Raise and track service requests',
              'Read and review deliverables',
              'Message the delivery pod on any request',
              'Download released assets',
            ].map((capability) => (
              <p key={capability} className="flex items-center gap-2 text-[11px] text-slate-100">
                <span className="size-1.5 rounded-full bg-emerald-400/70" />
                {capability}
              </p>
            ))}
          </div>

          <p className="mt-4 flex items-start gap-2 text-[11px] leading-relaxed text-slate-400">
            <UserCircle aria-hidden className="mt-0.5 size-3.5 shrink-0 text-slate-400" strokeWidth={1.75} />
            Profile edits, invitations and role changes are handled by the account team so every change is
            attributable in the audit trail.
          </p>
        </Panel>
      </div>
    </div>
  );
}
