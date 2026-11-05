import type { ReactNode } from 'react';
import { PortalShell } from '@/components/portal/shell';

/**
 * Client workspace layout — route group `(client)`.
 *
 * Serves /dashboard, /requests, /requests/new, /requests/[requestId], /billing,
 * /deliveries and /categories. The group is parenthesised, so none of those URLs
 * changed; what changed is that these pages now sit under the client navigation
 * rather than a shared portal shell that also advertised the ops console.
 */
export default function ClientLayout({ children }: { readonly children: ReactNode }) {
  return <PortalShell variant="client">{children}</PortalShell>;
}
