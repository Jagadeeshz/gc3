'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { fetchOrganizations, login, ApiClientError } from '@/lib/api-client';
import { buildSession, consumeSignedOutFlag, homePathFor } from '@/lib/session';
import { useSession } from '@/lib/session-context';

/**
 * Sign-in screen. On success it fetches the tenant list too: the portal needs an
 * organization id for `x-organization-id` on every subsequent request, and that
 * is exactly what /auth/organizations returns.
 */
export default function LoginPage() {
  const router = useRouter();
  const { session, ready, signIn } = useSession();
  // Set by the shell on sign-out, so the user gets confirmation rather than a form
  // that looks like it simply failed to load. Read on mount rather than through
  // useSearchParams, which would force this page out of static prerendering.
  const [justSignedOut, setJustSignedOut] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    setJustSignedOut(consumeSignedOutFlag());
  }, []);

  useEffect(() => {
    if (ready && session) {
      // Already signed in: send them where their role belongs, not to a fixed page.
      router.replace(homePathFor(session));
    }
  }, [ready, session, router]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      // Emails are stored lower-cased; a stray capital or trailing space used to read
      // as "invalid password", which sends people hunting for the wrong problem.
      const auth = await login(email.trim().toLowerCase(), password);
      const organizations = await fetchOrganizations(auth.accessToken);

      const next = buildSession({
        accessToken: auth.accessToken,
        expiresIn: auth.expiresIn,
        actor: auth.actor,
        organizations,
      });

      signIn(next);

      // Staff → /ops, clients → /dashboard. The ops layout redirects a client
      // back if they ever get there by hand.
      router.replace(homePathFor(next));
    } catch (caught) {
      if (caught instanceof ApiClientError) {
        // Say what actually happened. "Invalid email or password" (401) is a credential
        // problem; 429 is a throttle; 0 is a connection failure. One message for all
        // three is how a rate limit gets misread as a wrong password.
        if (caught.status === 429) {
          setError('Too many attempts. Wait a few minutes, then try again.');
        } else if (caught.status === 401) {
          setError('Invalid email or password.');
        } else if (caught.status === 0) {
          setError(caught.message);
        } else {
          setError(caught.message);
        }
      } else {
        setError('Something went wrong signing in. Try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="glow-gold grid min-h-dvh place-items-center px-6 py-12">
      <div className="w-full max-w-[420px]">
        <div className="mb-8 flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-[11px] border border-gold/35 bg-gold/10 font-display text-xl font-semibold text-gold-light">
            G
          </span>
          <div className="leading-tight">
            <p className="text-sm font-semibold text-warm">GC³ Portal</p>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
              Global Cloud Capability &amp; Consulting
            </p>
          </div>
        </div>

        <div className="rounded-[14px] border border-white/10 bg-graphite/85 p-6 shadow-[0_1px_0_rgba(255,255,255,0.06)_inset]">
          <h1 className="font-display text-2xl tracking-[-0.01em] text-warm">Sign in</h1>
          <p className="mt-1 text-sm text-muted">
            Access your client workspace, service requests and deliverables.
          </p>

          <form className="mt-6 grid gap-4" onSubmit={onSubmit}>
            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-muted">Work email</span>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@company.com"
                className="rounded-lg border border-white/12 bg-graphite-elevated px-3 py-2.5 text-sm text-warm placeholder:text-muted/60 focus:border-gold/60 focus:outline-none focus:ring-2 focus:ring-gold/25"
              />
            </label>

            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-muted">Password</span>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••••••"
                className="rounded-lg border border-white/12 bg-graphite-elevated px-3 py-2.5 text-sm text-warm placeholder:text-muted/60 focus:border-gold/60 focus:outline-none focus:ring-2 focus:ring-gold/25"
              />
            </label>

            {justSignedOut && !error ? (
              <p
                role="status"
                className="rounded-lg border border-emerald-400/30 bg-emerald-400/[0.08] px-3 py-2 text-xs text-emerald-200"
              >
                You have been signed out.
              </p>
            ) : null}

            {error ? (
              <p
                role="alert"
                className="rounded-lg border border-red-400/35 bg-red-400/10 px-3 py-2 text-xs text-red-300"
              >
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={submitting}
              className="mt-1 inline-flex min-h-11 items-center justify-center rounded-[10px] border border-gold-deep/40 bg-[linear-gradient(180deg,#E2C777_0%,#D9B65D_100%)] px-4 py-3 text-sm font-medium text-ink transition-[filter] hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
          Staff accounts are provisioned with the auth:bootstrap script — there is no
          self-registration.
        </p>
      </div>
    </div>
  );
}
