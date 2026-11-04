import type { ServiceRequestStatus } from '@gc3/types';

/**
 * A request is open until it is closed or cancelled. DELIVERED is still open:
 * the work is out, but the request has not been signed off and shut.
 */
export const OPEN_STATUSES: readonly ServiceRequestStatus[] = [
  'DRAFT',
  'SUBMITTED',
  'TRIAGE',
  'IN_PROGRESS',
  'BLOCKED',
  'IN_REVIEW',
  'DELIVERED',
];

export const TERMINAL_STATUSES: readonly ServiceRequestStatus[] = ['CLOSED', 'CANCELLED'];

export function isOpenStatus(status: ServiceRequestStatus): boolean {
  return !TERMINAL_STATUSES.includes(status);
}
