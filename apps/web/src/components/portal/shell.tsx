'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { Building2, ClipboardList, Gauge, LayoutDashboard, LogOut, Package, Plus, Receipt, Tags } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { activeRoles } from '../../lib/session';
import { useSession } from '../../lib/session-context';

/**
 * Portal shell: persistent sidebar + topbar around every authenticated screen.
 *
 * Mirrors the structure of GC3_Portal_Interactive_UI_Prototype.html (dark
 * sidebar, white topbar, content column) rendered with the GC3 brand tokens
 * (void/graphite/gold) rather than the prototype's placeholder palette.
 */
const NAV = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/requests', label: 'Service Requests', icon: ClipboardList },
  { href: '/requests/new', label: 'New Request', icon: Plus },
  { href: '/deliveries', label: 'Deliveries', icon: Package },
  { href: '/categories', label: 'Categories', icon: Tags },
] as const;

/**
 * Roles that may see the workspace's bill.
 *
 * Mirrors `finance:read` on the server: a client owner sees their own invoice, a
 * team member and an approver do not. The nav is a courtesy — the API refuses the
 * endpoint regardless.
 */
const BILLING_ROLES: readonly string[] = [
  'CLIENT_OWNER',
  'ACCOUNT_MANAGER',
  'FINANCE_MANAGER',
  'PLATFORM_ADMIN',
  'OPERATIONS_MANAGER',
];

/** Roles that may open the platform finance console. */
const PLATFORM_FINANCE_ROLES: readonly string[] = [
  'PLATFORM_ADMIN',
  'OPERATIONS_MANAGER',
  'FINANCE_MANAGER',
];

export function PortalShell({ children }: { readonly children: ReactNode }) {
  const { session, ready, signOut, setActiveOrganization } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (ready && !session) {
      router.replace('/login');
    }
  }, [ready, session, router]);

  if (!ready) {
    return (
      <div className="grid min-h-dvh place-items-center text-sm text-muted">Loading portal…</div>
    );
  }

  if (!session) {
    return <div className="grid min-h-dvh place-items-center text-sm text-muted">Redirecting…</div>;
  }

  const organization =
    session.organizations.find((org) => org.id === session.activeOrganizationId) ?? null;
  const roles = activeRoles(session);
  const canReadBilling =
    roles.some((role) => BILLING_ROLES.includes(role)) ||
    (session.actor.platformRole !== null && BILLING_ROLES.includes(session.actor.platformRole));
  const canOpenFinanceConsole =
    session.actor.platformRole !== null && PLATFORM_FINANCE_ROLES.includes(session.actor.platformRole);

  const navItems: readonly { href: string; label: string; icon: LucideIcon }[] = canReadBilling
    ? [...NAV, { href: '/billing', label: 'Billing', icon: Receipt }]
    : NAV;
  const roleLabel = session.actor.platformRole
    ? session.actor.platformRole.replace(/_/g, ' ')
    : roles.length > 0
      ? roles.map((role) => role.replace(/_/g, ' ')).join(' · ')
      : 'No active membership';

  return (
    <div className="grid min-h-dvh lg:grid-cols-[248px_1fr]">
      <aside className="flex flex-col gap-6 border-r border-white/10 bg-void-secondary px-4 py-5">
        <Link href="/dashboard" className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-[10px] border border-gold/35 bg-gold/10 font-display text-lg font-semibold text-gold-light">
            G
          </span>
          <span className="leading-tight">
            <span className="block text-sm font-semibold text-warm">GC³ Portal</span>
            <span className="block font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
              Client workspace
            </span>
          </span>
        </Link>

        {session.organizations.length > 1 ? (
          <label className="grid gap-1.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
              Organization
            </span>
            <select
              value={session.activeOrganizationId ?? ''}
              onChange={(event) => {
                setActiveOrganization(event.target.value);
                router.refresh();
              }}
              className="w-full rounded-lg border border-white/12 bg-graphite px-3 py-2 text-sm text-warm focus:border-gold/60 focus:outline-none"
            >
              {session.organizations.map((org) => (
                <option key={org.id} value={org.id}>
                  {org.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-graphite px-3 py-2">
            <Building2 aria-hidden className="size-4 text-gold-light" strokeWidth={1.75} />
            <span className="truncate text-sm text-warm">{organization?.name ?? 'No tenant'}</span>
          </div>
        )}

        <nav className="grid gap-1">
          <span className="px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
            Workspace
          </span>
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors',
                  active
                    ? 'bg-white/8 text-warm'
                    : 'text-muted hover:bg-white/5 hover:text-warm',
                ].join(' ')}
              >
                <Icon aria-hidden className="size-4" strokeWidth={1.75} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/*
          The operations console spans every tenant, so it is not part of the
          workspace nav. Hiding it is a courtesy — the API still refuses
          `/ops/dashboard` without `ops:read`.
        */}
        {session.actor.platformRole === 'PLATFORM_ADMIN' ||
        session.actor.platformRole === 'OPERATIONS_MANAGER' ||
        canOpenFinanceConsole ? (
          <nav className="grid gap-1">
            <span className="px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
              Platform
            </span>
            {session.actor.platformRole === 'PLATFORM_ADMIN' ||
            session.actor.platformRole === 'OPERATIONS_MANAGER' ? (
              <Link
                href="/ops"
                className={[
                  'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors',
                  pathname === '/ops'
                    ? 'bg-white/8 text-warm'
                    : 'text-muted hover:bg-white/5 hover:text-warm',
                ].join(' ')}
              >
                <Gauge aria-hidden className="size-4" strokeWidth={1.75} />
                Operations
              </Link>
            ) : null}
            {canOpenFinanceConsole ? (
              <Link
                href="/ops/billing"
                className={[
                  'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors',
                  pathname === '/ops/billing'
                    ? 'bg-white/8 text-warm'
                    : 'text-muted hover:bg-white/5 hover:text-warm',
                ].join(' ')}
              >
                <Receipt aria-hidden className="size-4" strokeWidth={1.75} />
                Finance
              </Link>
            ) : null}
          </nav>
        ) : null}

        <div className="mt-auto border-t border-white/10 pt-4">
          <p className="truncate text-xs text-warm">{session.actor.fullName}</p>
          <p className="truncate font-mono text-[10px] uppercase tracking-[0.12em] text-muted">
            {roleLabel}
          </p>
          <button
            type="button"
            onClick={() => {
              signOut();
              router.replace('/login');
            }}
            className="mt-3 flex items-center gap-2 text-xs text-muted transition-colors hover:text-warm"
          >
            <LogOut aria-hidden className="size-3.5" strokeWidth={1.75} />
            Sign out
          </button>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b border-white/10 bg-void/85 px-6 backdrop-blur">
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
            {organization?.name ?? 'No tenant selected'}
          </span>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-muted sm:block">{session.actor.email}</span>
            <span className="grid size-8 place-items-center rounded-full border border-white/15 bg-white/5 text-xs font-semibold text-warm">
              {session.actor.fullName.slice(0, 1).toUpperCase()}
            </span>
          </div>
        </header>

        <main className="mx-auto max-w-[1080px] px-6 py-8">{children}</main>
      </div>
    </div>
  );
}
