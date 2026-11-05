'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { homePathFor } from '@/lib/session';
import { useSession } from '@/lib/session-context';

/**
 * Root entry point.
 *
 * `/` is a decision, not a destination: a signed-in user belongs in their own
 * workspace (client→/overview, staff→/ops), and everyone else belongs at the door.
 * The session lives in localStorage, so this cannot be a server redirect — it is
 * resolved on the client, with a brand splash for the half-frame it takes.
 */
export default function RootEntry() {
  const router = useRouter();
  const { session, ready } = useSession();

  useEffect(() => {
    if (!ready) {
      return;
    }

    router.replace(session ? homePathFor(session) : '/login');
  }, [ready, session, router]);

  return (
    <div className="grid min-h-dvh place-items-center bg-[#090D16]">
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-[10px] border border-gold/35 bg-gold/10 font-display text-lg font-semibold text-gold-light">
          G
        </span>
        <div className="leading-tight">
          <p className="text-sm font-semibold tracking-[0.01em] text-slate-100">GC³ Portal</p>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500">
            Opening your workspace…
          </p>
        </div>
      </div>
    </div>
  );
}
