'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { fetchOrganizations, login, ApiClientError } from '@/lib/api-client';
import { buildSession } from '@/lib/session';
import { useSession } from '@/lib/session-context';

/**
 * Sign-in screen. On success it fetches the tenant list too: the portal needs an
 * organization id for `x-organization-id` on every subsequent request, and that
 * is exactly what /auth/organizations returns.
 */
export default function LoginPage() {
  const router = useRouter();
  const { session, ready, signIn } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (ready && session) {
      router.replace('/dashboard');
    }
  }, [ready, session, router]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const auth = await login(email.trim(), password);
      const organizations = await fetchOrganizations(auth.accessToken);

      signIn(
        buildSession({
          accessToken: auth.accessToken,
          expiresIn: auth.expiresIn,
          actor: auth.actor,
          organizations,
        }),
      );

      router.replace('/dashboard');
    } catch (caught) {
      setError(
        caught instanceof ApiClientError
          ? caught.message
          : 'Could not reach the API. Is it running on port 3001?',
      );
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
