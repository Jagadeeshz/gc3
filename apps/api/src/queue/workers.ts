import type { Worker } from 'bullmq';
import { env } from '../config/env';
import { processEventJob, type EventJob } from '../notifications/events';
import { runRetrySweep } from '../notifications/retry';
import { runSlaSweep } from '../sla/monitor';
import { getDurableQueue } from './client';

/**
 * Durable workers.
 *
 * Three job names share one queue:
 *   event        — one email, rebuilt from committed state when it runs
 *   retry-sweep  — re-attempt failed deliveries that are due
 *   sla-sweep    — recompute risk states and alert on escalation
 *
 * The two sweeps are scheduled jobs rather than timers, which is the difference
 * that matters: a `setInterval` restarts its countdown with the process, while a
 * repeatable job's next run is stored in Redis and simply resumes.
 *
 * Both sweeps are idempotent by construction (the retry sweep only touches rows
 * whose `next_attempt_at` is due; the SLA sweep dedupes on the last alerted
 * state), so a job that runs twice after a crash does not double-send.
 */
export interface DurableWorkers {
  readonly worker: Worker;
  stop(): Promise<void>;
}

export async function startDurableWorkers(): Promise<DurableWorkers> {
  const queue = getDurableQueue();

  const worker = queue.startWorker(async ({ name, data }) => {
    switch (name) {
      case 'event':
        await processEventJob(data as EventJob);
        return;
      case 'retry-sweep':
        await runRetrySweep();
        return;
      case 'sla-sweep':
        await runSlaSweep();
        return;
      default:
        // An unknown job is a deploy skew, not a crash: log it and let it pass so
        // an older worker does not poison the queue.
        console.warn(`[gc3-api][queue] ignoring unknown job: ${name}`);
    }
  });

  // Scheduling is upsert-based, so a restart refreshes the schedule instead of
  // stacking a second copy of it.
  if (env.NOTIFICATION_RETRY_INTERVAL_SECONDS > 0) {
    await queue.scheduleEvery(
      'retry-sweep',
      'retry-sweep',
      env.NOTIFICATION_RETRY_INTERVAL_SECONDS * 1_000,
    );
  }

  if (env.SLA_SWEEP_INTERVAL_SECONDS > 0) {
    await queue.scheduleEvery('sla-sweep', 'sla-sweep', env.SLA_SWEEP_INTERVAL_SECONDS * 1_000);
  }

  return {
    worker,
    async stop() {
      await worker.close();
    },
  };
}
