import type { HealthReport } from '@gc3/types';

const API_BASE_URL = process.env.API_INTERNAL_BASE_URL ?? 'http://localhost:3001/api/v1';

export type HealthProbe =
  | { readonly reachable: true; readonly report: HealthReport }
  | { readonly reachable: false; readonly reason: string };

/**
 * Server-side liveness probe against the API. Deliberately tolerant: an
 * unreachable API must render as "offline", not crash the page.
 */
export async function getApiHealth(): Promise<HealthProbe> {
  try {
    const response = await fetch(`${API_BASE_URL}/health`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(1500),
    });

    if (!response.ok) {
      return { reachable: false, reason: `HTTP ${response.status}` };
    }

    const payload = (await response.json()) as { success?: boolean; data?: HealthReport };

    if (!payload.success || !payload.data) {
      return { reachable: false, reason: 'Unexpected response shape' };
    }

    return { reachable: true, report: payload.data };
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Unknown error';
    return { reachable: false, reason };
  }
}
