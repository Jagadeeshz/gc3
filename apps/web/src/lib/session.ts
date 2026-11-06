'use client';

import type { AccessibleOrganization, AuthActor } from '@gc3/types';

/**
 * Browser session.
 *
 * The access token lives in localStorage, not a cookie: the API is a separate
 * origin and expects `Authorization: Bearer`, so there is nothing to gain from a
 * cookie round-trip here. It costs us httpOnly protection, which is why the
 * token is short-lived (15 min) and every request re-checks it against the API.
 */
export interface PortalSession {
  readonly accessToken: string;
  /** Epoch milliseconds. */
  readonly expiresAt: number;
  readonly actor: AuthActor;
  readonly organizations: readonly AccessibleOrganization[];
  /** The tenant sent as `x-organization-id`. Null when the user has none. */
  readonly activeOrganizationId: string | null;
}

const STORAGE_KEY = 'gc3.portal.session';

export function readSession(): PortalSession | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as PortalSession;

    if (!parsed.accessToken || parsed.expiresAt <= Date.now()) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

export function writeSession(session: PortalSession): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.removeItem(STORAGE_KEY);
}

/** Builds a session from a login response plus the caller's tenant list. */
export function buildSession(input: {
  accessToken: string;
  expiresIn: number;
  actor: AuthActor;
  organizations: readonly AccessibleOrganization[];
}): PortalSession {
  return {
    accessToken: input.accessToken,
    expiresAt: Date.now() + input.expiresIn * 1000,
    actor: input.actor,
    organizations: input.organizations,
    activeOrganizationId: input.organizations[0]?.id ?? null,
  };
}

/** The caller's roles in the active tenant, for UI affordances only. */
export function activeRoles(session: PortalSession): readonly string[] {
  const active = session.organizations.find((org) => org.id === session.activeOrganizationId);
  return active?.roles ?? [];
}

/**
 * Where a signed-in user belongs.
 *
 * Staff (anyone with a platform role) work in the operations console; a client
 * lands on the executive overview of their tenant workspace. One predicate, used by the post-login
 * redirect and by anything else that needs the same answer — so there is no
 * second place to forget to update.
 */
export function homePathFor(session: PortalSession): '/ops' | '/overview' {
  return session.actor.platformRole !== null ? '/ops' : '/overview';
}

/**
 * A one-shot flag that survives a client-side redirect.
 *
 * The sign-out redirect races with the layout guard, which sends unauthenticated
 * visitors to /login on its own — so a `?signedOut=1` query string is not reliable.
 * sessionStorage is: it survives both redirects, is scoped to the tab, and is cleared
 * as soon as the login page reads it.
 */
const SIGNED_OUT_KEY = 'gc3.portal.signedOut';

export function markSignedOut(): void {
  try {
    window.sessionStorage.setItem(SIGNED_OUT_KEY, '1');
  } catch {
    /* private mode: no banner, but the sign-out still happened */
  }
}

export function consumeSignedOutFlag(): boolean {
  try {
    const present = window.sessionStorage.getItem(SIGNED_OUT_KEY) === '1';
    window.sessionStorage.removeItem(SIGNED_OUT_KEY);
    return present;
  } catch {
    return false;
  }
}
