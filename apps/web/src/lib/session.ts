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
