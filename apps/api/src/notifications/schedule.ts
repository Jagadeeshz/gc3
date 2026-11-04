import { env } from '../config/env';

/**
 * Retry schedule for a failed notification.
 *
 * Deliberately slow and bounded: an invite email is not a chat message. Five
 * attempts spread over roughly eight hours rides out a relay outage without
 * hammering a provider that is already unhappy, and stops before an invitation
 * link is a week stale.
 *
 * Lives in its own module so the retry sweep and the event dispatcher can both
 * use it without importing each other.
 */
const BACKOFF_SECONDS = [60, 300, 900, 3_600, 21_600] as const;

/** Delay before the retry that follows `attempt` (1-based). */
export function backoffSeconds(attempt: number): number {
  const index = Math.min(Math.max(attempt, 1), BACKOFF_SECONDS.length) - 1;
  return BACKOFF_SECONDS[index] ?? BACKOFF_SECONDS[BACKOFF_SECONDS.length - 1]!;
}

/**
 * When the next attempt is due, or null when the chain is over because `attempt`
 * has reached NOTIFICATION_MAX_ATTEMPTS.
 */
export function nextAttemptAfter(attempt: number, from: Date = new Date()): Date | null {
  if (attempt >= env.NOTIFICATION_MAX_ATTEMPTS) {
    return null;
  }

  return new Date(from.getTime() + backoffSeconds(attempt) * 1_000);
}

/** The full schedule, for documentation and tests. */
export function backoffSchedule(): readonly number[] {
  return BACKOFF_SECONDS;
}
