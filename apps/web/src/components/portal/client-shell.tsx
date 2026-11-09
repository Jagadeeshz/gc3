'use client';

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Building2,
  ChevronDown,
  LogOut,
  Menu,
  MessageSquarePlus,
  Plus,
  Star,
  X,
} from 'lucide-react';
import type { ServiceRequest } from '@gc3/types';
import { listRequests } from '@/lib/api-client';
import { activeRoles, markSignedOut, writeSession, type PortalSession } from '@/lib/session';
import { useSession } from '@/lib/session-context';
import { clientNavFor } from '@/lib/client-nav';
import { requestStatusLabel } from '@/components/portal/status';
import { useViewMode } from '@/lib/view-mode';

/**
 * The client workspace shell — one sidebar, two roles.
 *
 * Layout follows the pattern the reference products settled on for good reasons:
 * a persistent left rail (workspace identity at the top, work in the middle, the
 * person at the bottom), a role switch that changes what the rail offers, and a
 * single primary action that changes with the role rather than a menu of both.
 *
 * The role switch is a *view* switch (see lib/view-mode.ts): it changes the
 * navigation and the dashboard, never the token. A member who forces the owner view
 * in devtools sees a member workspace, because the API is the boundary and the
 * client is not.
 */

const VIEW_LABEL = { owner: 'Owner view', member: 'Member view' } as const;

export function ClientShell({ children }: { readonly children: ReactNode }) {
  const { session, ready, signOut } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  const roles = session ? activeRoles(session) : [];
  const holdsOwner = roles.includes('CLIENT_OWNER');
  const [mode, changeMode] = useViewMode(holdsOwner);
  const isOwnerView = holdsOwner && mode === 'owner';

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [pinned, setPinned] = useState<readonly ServiceRequest[]>([]);

  const token = session?.accessToken ?? null;
  const organizationId = session?.activeOrganizationId ?? null;

  // Pinned spaces: the work still open, most recently touched first. Real rows, so
  // the rail never advertises a project that does not exist in this workspace.
  useEffect(() => {
    if (!token || !organizationId) return;

    let alive = true;
    listRequests(token, organizationId, { pageSize: 20 })
      .then((page) => {
        if (!alive) return;
        const open = page.items
          .filter((item) => !['CLOSED', 'CANCELLED', 'DRAFT'].includes(item.status))
          .slice(0, 3);
        setPinned(open);
      })
      .catch(() => {
        /* the rail still works without the pinned block */
      });

    return () => {
      alive = false;
    };
  }, [token, organizationId]);

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  /**
   * Unauthenticated visitor — send them to the login screen.
   *
   * Without this, signing out and refreshing `/overview` still painted the workspace
   * chrome (empty, because every request 401s). A signed-out user must not be able to
   * look at a tenant's shell at all, even a hollow one.
   */
  useEffect(() => {
    if (ready && !session) {
      router.replace('/login');
    }
  }, [ready, session, router]);

  const sections = useMemo(() => clientNavFor(isOwnerView), [isOwnerView]);

  /**
   * Sign out.
   *
   * This must go through the session context, not `clearSession()` alone: clearing
   * localStorage leaves the provider holding the old session in memory, so /login
   * still sees a signed-in user and redirects straight back into the workspace. That
   * is exactly the bug this replaced — clicking logout appeared to do nothing.
   */
  const handleSignOut = useCallback(() => {
    markSignedOut();
    signOut();
    setDrawerOpen(false);
    router.replace('/login');
  }, [router, signOut]);

  const switchWorkspace = useCallback(
    (nextOrganizationId: string) => {
      if (!session) return;
      const next = session.organizations.find((org) => org.id === nextOrganizationId);
      if (!next) return;

      const updated: PortalSession = { ...session, activeOrganizationId: next.id };
      writeSession(updated);
      setSwitcherOpen(false);
      router.refresh();
      window.location.reload();
    },
    [router, session],
  );

  const workspaceName =
    session?.organizations.find((org) => org.id === session.activeOrganizationId)?.name ?? 'Workspace';

  const initials = (session?.actor?.fullName ?? session?.actor?.email ?? 'GC')
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const primaryAction = isOwnerView
    ? { href: '/requests/new', label: 'New creative brief', icon: Plus }
    : { href: '/deliverables', label: 'Submit feedback', icon: MessageSquarePlus };

  const ActionIcon = primaryAction.icon;

  // Nothing is rendered before the session is known: a skeleton, not the app, so a
  // signed-out visitor never sees a flash of the workspace.
  if (!ready) {
    return (
      <div className="grid min-h-dvh place-items-center bg-obsidian">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-slate-600">Loading workspace…</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="grid min-h-dvh place-items-center bg-obsidian">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-slate-600">
          Redirecting to sign in…
        </p>
      </div>
    );
  }

  const rail = (
    <div className="flex h-full flex-col gap-5 px-3 py-4">
      {/* workspace switcher */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setSwitcherOpen((open) => !open)}
          aria-expanded={switcherOpen}
          className="flex w-full items-center gap-2.5 rounded-[8px] border border-[color:var(--bindu-surface-border)] bg-[color:var(--bindu-void-2)] px-3 py-2.5 text-left transition-colors hover:border-emerald-400/30"
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-emerald-400/12 text-emerald-300">
            <Building2 aria-hidden className="size-4" strokeWidth={1.9} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12.5px] font-medium text-slate-100">{workspaceName}</span>
            <span className="block font-mono text-[9px] uppercase tracking-[0.12em] text-slate-500">
              {isOwnerView ? 'Owner workspace' : 'Member workspace'}
            </span>
          </span>
          <ChevronDown
            aria-hidden
            className={`size-3.5 shrink-0 text-slate-500 transition-transform ${switcherOpen ? 'rotate-180' : ''}`}
            strokeWidth={2}
          />
        </button>

        {switcherOpen ? (
          <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 overflow-hidden rounded-[8px] border border-[color:var(--bindu-surface-border)] bg-[color:var(--bindu-void-2)] shadow-[0_24px_60px_-30px_rgba(0,0,0,0.9)]">
            {(session?.organizations ?? []).map((org) => (
              <button
                key={org.id}
                type="button"
                onClick={() => switchWorkspace(org.id)}
                className={`flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-[12px] transition-colors hover:bg-white/[0.04] ${
                  org.id === session?.activeOrganizationId ? 'text-emerald-300' : 'text-slate-300'
                }`}
              >
                <span className="truncate">{org.name}</span>
                {org.id === session?.activeOrganizationId ? (
                  <span className="font-mono text-[8px] uppercase tracking-[0.12em]">current</span>
                ) : null}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {/* role view switch — only for a caller who really holds both */}
      {holdsOwner ? (
        <div>
          <p className="mb-1.5 px-1 font-mono text-[9px] uppercase tracking-[0.14em] text-slate-600">
            Preview as
          </p>
          <div role="tablist" aria-label="Preview role" className="grid grid-cols-2 gap-1 rounded-[8px] border border-[color:var(--bindu-surface-border)] bg-[color:var(--bindu-void-1)] p-1">
            {(['owner', 'member'] as const).map((option) => {
              const selected = mode === option;

              return (
                <button
                  key={option}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  onClick={() => changeMode(option)}
                  className={`rounded-lg px-2 py-1.5 text-[11px] font-medium transition-all ${
                    selected
                      ? 'bg-emerald-400/15 text-emerald-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]'
                      : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  {option === 'owner' ? 'Owner' : 'Member'}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* role-aware primary action */}
      <Link
        href={primaryAction.href}
        className="inline-flex items-center justify-center gap-2 rounded-[8px] border border-[#8B6410]/60 bg-[linear-gradient(120deg,#F2D582_0%,#C9911A_52%,#8B6410_100%)] px-3 py-2.5 text-[12.5px] font-semibold text-[#080B12] transition-colors hover:brightness-[1.08]"
      >
        <ActionIcon aria-hidden className="size-4" strokeWidth={2.1} />
        {primaryAction.label}
      </Link>

      {/* navigation */}
      <nav aria-label="Client workspace" className="-mx-1 flex-1 overflow-y-auto px-1">
        {sections.map((section) => (
          <div key={section.title} className="mb-4">
            <p className="mb-1.5 px-2 font-mono text-[9px] uppercase tracking-[0.14em] text-slate-600">
              {section.title}
            </p>
            <ul className="grid gap-0.5">
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      className={`group relative flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[12.5px] transition-colors ${
                        active
                          ? 'b-active-row'
                          : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
                      }`}
                    >
                      {active ? (
                        <span
                          aria-hidden
                          className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full bg-emerald-400"
                        />
                      ) : null}
                      <Icon
                        aria-hidden
                        className={`size-4 shrink-0 ${active ? 'text-emerald-300' : 'text-slate-500 group-hover:text-slate-300'}`}
                        strokeWidth={1.8}
                      />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        {pinned.length > 0 ? (
          <div className="mb-4">
            <p className="mb-1.5 flex items-center gap-1.5 px-2 font-mono text-[9px] uppercase tracking-[0.14em] text-slate-600">
              <Star aria-hidden className="size-2.5" strokeWidth={2.2} />
              Pinned spaces
            </p>
            <ul className="grid gap-0.5">
              {pinned.map((request) => (
                <li key={request.id}>
                  <Link
                    href={`/requests/${request.id}`}
                    title={request.title}
                    className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-[11.5px] text-slate-400 transition-colors hover:bg-white/[0.04] hover:text-slate-200"
                  >
                    <span
                      aria-hidden
                      className={`size-1.5 shrink-0 rounded-full ${
                        request.status === 'IN_PROGRESS'
                          ? 'bg-emerald-400'
                          : request.status === 'IN_REVIEW'
                            ? 'bg-amber-400'
                            : 'bg-slate-500'
                      }`}
                    />
                    <span className="truncate">{request.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </nav>

      {/* person */}
      <div className="rounded-[8px] border border-[color:var(--bindu-surface-border)] bg-[color:var(--bindu-void-2)] p-2.5">
        <div className="flex items-center gap-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[linear-gradient(140deg,#34D399,#0EA5A0)] font-mono text-[10px] font-bold text-[#080B12]">
            {initials}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12px] text-slate-200">
              {session?.actor?.fullName ?? session?.actor?.email ?? 'Signed in'}
            </span>
            <span className="block font-mono text-[8.5px] uppercase tracking-[0.12em] text-emerald-300/80">
              {VIEW_LABEL[isOwnerView ? 'owner' : 'member']}
            </span>
          </span>
          <button
            type="button"
            onClick={handleSignOut}
            aria-label="Sign out"
            className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-white/[0.06] hover:text-slate-200"
          >
            <LogOut aria-hidden className="size-3.5" strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh bg-obsidian">
      {/* mobile bar */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-hairline bg-obsidian/95 px-4 py-2.5 backdrop-blur lg:hidden">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open navigation"
          className="grid size-8 place-items-center rounded-lg border border-hairline text-slate-300"
        >
          <Menu aria-hidden className="size-4" strokeWidth={2} />
        </button>
        <span className="truncate text-[12.5px] text-slate-200">{workspaceName}</span>
        <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-emerald-300/80">
          {isOwnerView ? 'Owner' : 'Member'}
        </span>
      </div>

      <div className="lg:grid lg:grid-cols-[264px_minmax(0,1fr)]">
        <aside className="sticky top-0 hidden h-dvh border-r border-hairline bg-[color:var(--bindu-void-1)] lg:block">
          {rail}
        </aside>

        {drawerOpen ? (
          <div className="fixed inset-0 z-50 lg:hidden">
            <button
              type="button"
              aria-label="Close navigation"
              onClick={() => setDrawerOpen(false)}
              className="absolute inset-0 bg-obsidian/80 backdrop-blur-sm"
            />
            <div className="palette-in absolute left-0 top-0 h-full w-[280px] border-r border-hairline bg-[color:var(--bindu-void-1)]">
              <div className="flex justify-end px-3 pt-3">
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  aria-label="Close navigation"
                  className="grid size-8 place-items-center rounded-lg text-slate-400"
                >
                  <X aria-hidden className="size-4" strokeWidth={2} />
                </button>
              </div>
              {rail}
            </div>
          </div>
        ) : null}

        <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
