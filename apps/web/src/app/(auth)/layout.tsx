import type { ReactNode } from 'react';

/**
 * Auth layout — route group `(auth)`.
 *
 * Deliberately chrome-free: no sidebar, no tenant switcher, no navigation. A
 * sign-in screen is the one place in the product where the only sensible action is
 * the form in front of you, so everything else is removed rather than disabled.
 *
 * The group is parenthesised, so `/login` stays `/login`.
 */
export default function AuthLayout({ children }: { readonly children: ReactNode }) {
  return <div className="min-h-dvh bg-[#090D16]">{children}</div>;
}
