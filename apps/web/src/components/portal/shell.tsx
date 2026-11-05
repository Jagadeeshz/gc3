'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { BarChart3, Building2, ClipboardList, Gauge, LayoutDashboard, LogOut, Receipt } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { activeRoles } from '../../lib/session';
import { useSession } from '../../lib/session-context';
import { clientNavFor } from '../../lib/client-nav';

/**
 * Portal shell: persistent sidebar + topbar around every authenticated screen.
 *
 * Mirrors the structure of GC3_Portal_Interactive_UI_Prototype.html (dark
 * sidebar, white topbar, content column) rendered with the GC3 brand tokens
 * (void/graphite/gold) rather than the prototype's placeholder palette.
 *
 * Two variants, one component: the chrome is identical, the navigation is not.
 *
 *  - `client` — the tenant's own workspace (route group `(client)`). Its nav is
 *    exactly Dashboard, Requests and Billing and it contains **no reference to
 *    /ops**: a nav entry that leads to a redirect is worse than no entry, and a
 *    client should not be able to discover the internal console from the UI.
 *  - `ops` — the internal staff console (route group `(ops)`). High-density
 *    layout (wider content column), staff navigation, and a guard that sends a
 *    pure client session back to /dashboard.
 *
 * Route groups are parenthesised, so every URL stayed where it was:
 * `(client)/dashboard` still serves `/dashboard`, `(ops)/ops/analytics` still
 * serves `/ops/analytics`. What changed is which layout wraps which route.
 */
export type ShellVariant = 'client' | 'ops';

interface NavItem {
  readonly href: string;
  readonly label: string;
  readonly icon: LucideIcon;
  /** Omitted means "always show"; otherwise the entry is permission-gated. */
  readonly gate?: 'finance' | 'ops';
}

/** Client workspace navigation — the three pages a client actually uses. */
const CLIENT_NAV: readonly NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/requests', label: 'Requests', icon: ClipboardList },
  { href: '/billing', label: 'Billing', icon: Receipt, gate: 'finance' },
];

/** Internal staff console navigation. */
const OPS_NAV: readonly NavItem[] = [
  { href: '/ops', label: 'Operations', icon: Gauge, gate: 'ops' },
  { href: '/ops/analytics', label: 'Analytics', icon: BarChart3, gate: 'ops' },
  { href: '/ops/billing', label: 'Finance', icon: Receipt, gate: 'finance' },
];

/**
 * Roles that may see the workspace's bill.
 *
 * Mirrors `finance:read` on the server: a client owner sees their own invoice, a
 * team member and an approver do not. The nav is a courtesy — the API refuses the
 * endpoint regardless.
 */
const FINANCE_ROLES: readonly string[] = [
  'CLIENT_OWNER',
  'ACCOUNT_MANAGER',
  'FINANCE_MANAGER',
  'PLATFORM_ADMIN',
  'OPERATIONS_MANAGER',
];

/** Roles that may open the operations console (`ops:read`). */
const OPS_ROLES: readonly string[] = ['PLATFORM_ADMIN', 'OPERATIONS_MANAGER'];

export function PortalShell({
  children,
  variant = 'client',
}: {
  readonly children: ReactNode;
  readonly variant?: ShellVariant;
}) {
  const { session, ready, signOut, setActiveOrganization } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (ready && !session) {
      router.replace('/login');
    }
  }, [ready, session, router]);

  // A client's roles live on memberships, so `platformRole === null` is exactly
  // "not staff". That predicate is the whole staff/client split.
  const isStaff = session ? session.actor.platformRole !== null : false;
  const isOps = variant === 'ops';

  /**
   * Staff-only guard for the ops group.
   *
   * A client who types an /ops URL lands on their dashboard instead of a
   * forbidden page. The API remains the real boundary — it answers 403 to every
   * ops endpoint for a client token — so this is the UX half of the same rule.
   */
  useEffect(() => {
    if (isOps && ready && session && !isStaff) {
      router.replace('/overview');
    }
  }, [isOps, ready, session, isStaff, router]);

  if (!ready) {
    return (
      <div className="grid min-h-dvh place-items-center text-sm text-muted">Loading portal…</div>
    );
  }

  if (!session) {
    return <div className="grid min-h-dvh place-items-center text-sm text-muted">Redirecting…</div>;
  }

  if (isOps && !isStaff) {
    return (
      <div className="grid min-h-dvh place-items-center text-sm text-muted">
        This console is for platform operations. Redirecting…
      </div>
    );
  }

  const organization =
    session.organizations.find((org) => org.id === session.activeOrganizationId) ?? null;
  const roles = activeRoles(session);
  const roleLabel = session.actor.platformRole
    ? session.actor.platformRole.replace(/_/g, ' ')
    : roles.length > 0
      ? roles.map((role) => role.replace(/_/g, ' ')).join(' · ')
      : 'No active membership';

  const canSee = (item: NavItem): boolean => {
    if (!item.gate) {
      return true;
    }

    const pool = item.gate === 'ops' ? OPS_ROLES : FINANCE_ROLES;

    return (
      (session.actor.platformRole !== null && pool.includes(session.actor.platformRole)) ||
      roles.some((role) => pool.includes(role))
    );
  };

  const navItems = (isOps ? OPS_NAV : CLIENT_NAV).filter(canSee);

  return (
    <div className={`grid min-h-dvh lg:grid-cols-[248px_1fr] ${isOps ? 'bg-void' : 'bg-[#090D16]'} `}>
      <aside className={`flex flex-col gap-6 px-4 py-5 ${isOps ? 'border-r border-white/10 bg-void-secondary' : 'border-r border-[#1E293B] bg-[#0B1120]'}`}>
        {/*
          The brand leads home: clients to their dashboard, staff back to the
          console. Client users never see an /ops href here — for them this
          resolves to /dashboard — but a staff member who stepped into the tenant
          workspace (request detail lives under (client)) is not stranded there.
        */}
        <Link href={isStaff ? '/ops' : '/overview'} className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-[10px] border border-gold/35 bg-gold/10 font-display text-lg font-semibold text-gold-light">
            G
          </span>
          <span className="leading-tight">
            <span className="block text-sm font-semibold text-warm">GC³ Portal</span>
            <span className="block font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
              {isOps ? 'Operations console' : 'Client workspace'}
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

        {isOps ? (
          <nav className="grid gap-1">
            <span className="px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
              Platform
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
        ) : (
          /*
            Client navigation is grouped and role-derived: an owner gets the full
            thirteen entries, a member gets the nine that belong to their work.
            The billing section simply does not exist for a member — nothing is
            rendered disabled, because a disabled link still advertises a screen.
          */
          clientNavFor(roles.includes('CLIENT_OWNER')).map((section) => (
            <nav key={section.title} className="grid gap-0.5">
              <span className="px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">
                {section.title}
              </span>
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={[
                      'group relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] transition-colors',
                      active
                        ? 'border border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-200'
                        : 'border border-transparent text-slate-400 hover:bg-white/[0.04] hover:text-slate-100',
                    ].join(' ')}
                  >
                    <Icon
                      aria-hidden
                      className={`size-4 ${active ? 'text-emerald-300' : 'text-slate-500 group-hover:text-slate-300'}`}
                      strokeWidth={1.75}
                    />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          ))
        )}

        {/*
          Staff can step into the tenant workspace — request detail lives under
          (client), so the console needs a way back to it. The reverse is
          deliberately absent: the client nav never mentions /ops.
        */}
        {isOps ? (
          <nav className="grid gap-1">
            <span className="px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
              Tenant workspace
            </span>
            <Link
              href="/overview"
              className={[
                'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors',
                pathname === '/overview'
                  ? 'bg-white/8 text-warm'
                  : 'text-muted hover:bg-white/5 hover:text-warm',
              ].join(' ')}
            >
              <LayoutDashboard aria-hidden className="size-4" strokeWidth={1.75} />
              Open client view
            </Link>
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
        <header className={`sticky top-0 z-10 flex h-16 items-center justify-between border-b px-6 backdrop-blur ${isOps ? 'border-white/10 bg-void/85' : 'border-[#1E293B] bg-[#090D16]/85'}`}>
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
            {isOps ? 'Platform operations' : (organization?.name ?? 'No tenant selected')}
          </span>
          <div className="flex items-center gap-3">
            <span className="hidden text-xs text-muted sm:block">{session.actor.email}</span>
            <span className="grid size-8 place-items-center rounded-full border border-white/15 bg-white/5 text-xs font-semibold text-warm">
              {session.actor.fullName.slice(0, 1).toUpperCase()}
            </span>
          </div>
        </header>

        {/*
          The ops console is deliberately denser: it carries tables of every
          tenant at once, so it gets the width instead of the reading column.
        */}
        <main
          className={isOps ? 'mx-auto max-w-[1440px] px-6 py-6' : 'mx-auto max-w-[1080px] px-6 py-8'}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
