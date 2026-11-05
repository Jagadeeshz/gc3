import type { ReactNode } from 'react';
import { PortalShell } from '@/components/portal/shell';

/**
 * Internal staff operations layout — route group `(ops)`.
 *
 * Serves /ops, /ops/analytics and /ops/billing. `variant="ops"` does two things:
 * renders the high-density staff console chrome, and redirects any non-staff
 * session to /dashboard before the page renders.
 *
 * The redirect is a convenience, not the boundary: the API refuses every ops
 * endpoint (`ops:read` / `finance:read`) to a client token, so a hand-typed URL
 * with a client session yields a redirect here and a 403 there.
 */
export default function OpsLayout({ children }: { readonly children: ReactNode }) {
  return <PortalShell variant="ops">{children}</PortalShell>;
}
