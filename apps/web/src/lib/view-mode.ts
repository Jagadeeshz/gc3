'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Client-side view mode: which dashboard the portal *shows*.
 *
 * This is a presentation switch, not a permission. It never changes the token, and
 * every request still carries the caller's real roles — a member who forces
 * `owner` here gets a member dashboard with member data, and the API refuses
 * anything the role does not hold. What it buys is the ability for an owner to see
 * the workspace exactly as their team sees it, which is the fastest way to catch a
 * screen that only makes sense to the person who pays the invoice.
 *
 * Only a caller who actually holds CLIENT_OWNER is offered the toggle at all.
 */

export type ViewMode = 'owner' | 'member';

const KEY = 'gc3.portal.viewAs';
const EVENT = 'gc3:view-changed';

export function readViewMode(): ViewMode {
  if (typeof window === 'undefined') return 'owner';

  try {
    return window.localStorage.getItem(KEY) === 'member' ? 'member' : 'owner';
  } catch {
    return 'owner';
  }
}

export function setViewMode(mode: ViewMode): void {
  try {
    window.localStorage.setItem(KEY, mode);
  } catch {
    /* private mode: the switch still works for this render */
  }

  window.dispatchEvent(new Event(EVENT));
}

/** Current view mode plus a setter, kept in sync across the shell and the pages. */
export function useViewMode(canSwitch: boolean): readonly [ViewMode, (mode: ViewMode) => void] {
  const [mode, setMode] = useState<ViewMode>('owner');

  useEffect(() => {
    const sync = () => setMode(readViewMode());

    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync);

    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const change = useCallback((next: ViewMode) => {
    setViewMode(next);
    setMode(next);
  }, []);

  // A member cannot preview the owner view, whatever localStorage says.
  return [canSwitch ? mode : 'member', change] as const;
}
