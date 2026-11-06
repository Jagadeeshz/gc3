'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { homePathFor } from '@/lib/session';
import { useSession } from '@/lib/session-context';

/**
 * `/` is still a decision, not a destination: a signed-in visitor belongs in
 * their own workspace. The marketing page renders on the server for everyone
 * else, so anonymous traffic is served statically and this only fires for a
 * session that already exists in localStorage.
 */
export function SessionGate() {
  const router = useRouter();
  const { session, ready } = useSession();

  useEffect(() => {
    if (ready && session) {
      router.replace(homePathFor(session));
    }
  }, [ready, session, router]);

  return null;
}
