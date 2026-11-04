'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  clearSession,
  readSession,
  writeSession,
  type PortalSession,
} from './session';

interface SessionContextValue {
  readonly session: PortalSession | null;
  /** False until localStorage has been read — prevents a login flash on refresh. */
  readonly ready: boolean;
  readonly signIn: (session: PortalSession) => void;
  readonly signOut: () => void;
  readonly setActiveOrganization: (organizationId: string) => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { readonly children: ReactNode }) {
  const [session, setSession] = useState<PortalSession | null>(null);
  const [ready, setReady] = useState(false);

  // localStorage is only available after mount, so hydration happens here
  // rather than in an initialiser (which would mismatch the server render).
  useEffect(() => {
    setSession(readSession());
    setReady(true);
  }, []);

  const signIn = useCallback((next: PortalSession) => {
    writeSession(next);
    setSession(next);
  }, []);

  const signOut = useCallback(() => {
    clearSession();
    setSession(null);
  }, []);

  const setActiveOrganization = useCallback((organizationId: string) => {
    setSession((current) => {
      if (!current) {
        return current;
      }

      const next = { ...current, activeOrganizationId: organizationId };
      writeSession(next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ session, ready, signIn, signOut, setActiveOrganization }),
    [session, ready, signIn, signOut, setActiveOrganization],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const context = useContext(SessionContext);

  if (!context) {
    throw new Error('useSession must be used inside <SessionProvider>');
  }

  return context;
}
