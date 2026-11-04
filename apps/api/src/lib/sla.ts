import type { ServiceRequestPriority, ServiceRequestStatus, SlaState } from '@gc3/types';

/**
 * Delivery commitments.
 *
 * The brief leaves exact numbers to a commercial decision ("SLA | Service-specific
 * response and delivery commitments"), so these are the platform defaults: a
 * service category can override the hours, and the priority picks the default when
 * it does not. They are deliberately in one place so a negotiated figure is a
 * single edit, not a hunt through the codebase.
 */
export const SLA_HOURS_BY_PRIORITY: Readonly<Record<ServiceRequestPriority, number>> = {
  URGENT: 8,
  HIGH: 24,
  NORMAL: 72,
  LOW: 168,
};

/**
 * How much of the window counts as "at risk": the final quarter. An eight-hour
 * urgent request warns in its last two hours; a week-long low-priority one warns in
 * its last day and a half.
 */
export const SLA_WARNING_RATIO = 0.25;

/** Statuses where no commitment is being judged. */
const NO_OBLIGATION: readonly ServiceRequestStatus[] = ['DRAFT', 'CANCELLED'];

export function slaHoursFor(
  priority: ServiceRequestPriority,
  categoryHours?: number | null,
): number {
  return categoryHours ?? SLA_HOURS_BY_PRIORITY[priority];
}

/** The commitment timestamp: when the clock started, plus the agreed hours. */
export function slaTargetFrom(startAt: Date, hours: number): Date {
  return new Date(startAt.getTime() + hours * 3_600_000);
}

export interface SlaInput {
  readonly status: ServiceRequestStatus;
  readonly targetAt: Date | null;
  readonly closedAt: Date | null;
  readonly startAt: Date;
}

/**
 * Where a request stands right now.
 *
 * Deliberately pure: no database access, no clock of its own. Every caller passes
 * `now`, which is what makes the state testable and lets the sweep run against a
 * fixed instant.
 */
export function computeSlaState(input: SlaInput, now: Date): SlaState {
  if (!input.targetAt) {
    return 'NONE';
  }

  if (NO_OBLIGATION.includes(input.status)) {
    return 'NONE';
  }

  if (input.status === 'CLOSED') {
    const closedAt = input.closedAt ?? now;
    return closedAt.getTime() <= input.targetAt.getTime() ? 'MET' : 'MISSED';
  }

  const remainingMs = input.targetAt.getTime() - now.getTime();

  if (remainingMs < 0) {
    return 'BREACHED';
  }

  const windowMs = Math.max(input.targetAt.getTime() - input.startAt.getTime(), 1);
  const warningMs = windowMs * SLA_WARNING_RATIO;

  return remainingMs <= warningMs ? 'AT_RISK' : 'ON_TRACK';
}

/** True when the state is one the sweep should alert on. */
export function isRiskyState(state: SlaState): boolean {
  return state === 'AT_RISK' || state === 'BREACHED';
}

/** Human wording for the badge and the email subject. */
export function slaStateLabel(state: SlaState): string {
  switch (state) {
    case 'AT_RISK':
      return 'SLA at risk';
    case 'BREACHED':
      return 'SLA breached';
    case 'MET':
      return 'SLA met';
    case 'MISSED':
      return 'SLA missed';
    case 'ON_TRACK':
      return 'On track';
    default:
      return 'No SLA';
  }
}
