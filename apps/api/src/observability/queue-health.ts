import type {
  QueueAlert,
  QueueHealth,
  QueueSchedulerInfo,
  WorkerHeartbeatInfo,
  WorkerStatus,
} from '@gc3/types';
import { env } from '../config/env';
import { durableDispatchEnabled, getDurableQueue } from '../queue/client';
import type { QueueCounts } from '../queue/durable-queue';
import { readHeartbeat } from './heartbeat';

/**
 * Queue health.
 *
 * `buildQueueReport` is pure: counts, schedulers and a heartbeat go in, a report
 * comes out. Every alert branch is therefore testable without a Redis or a dead
 * worker, and the thresholds live in one place instead of being sprinkled through
 * the route.
 */
export interface QueueReportInput {
  readonly driver: 'redis' | 'memory';
  readonly queueName: string;
  readonly counts: QueueCounts;
  readonly paused: boolean;
  readonly schedulers: readonly QueueSchedulerInfo[];
  readonly heartbeat: {
    readonly pid: number;
    readonly hostname: string;
    readonly startedAt: string;
    readonly lastSeenAt: string;
  } | null;
  readonly now: number;
  /** Beats are expected this often; a gap of more than twice this is stale. */
  readonly heartbeatIntervalSeconds: number;
  /** A backlog beyond this many waiting jobs is worth waking someone for. */
  readonly backlogThreshold: number;
}

export function workerStatus(input: {
  heartbeat: QueueReportInput['heartbeat'];
  now: number;
  heartbeatIntervalSeconds: number;
  driver: 'redis' | 'memory';
  /** True when this process is running the loops itself (memory driver). */
  inline: boolean;
}): { status: WorkerStatus; ageSeconds: number | null } {
  if (input.inline) {
    return { status: 'INLINE', ageSeconds: null };
  }

  if (!input.heartbeat) {
    return { status: 'ABSENT', ageSeconds: null };
  }

  const ageSeconds = Math.max(
    0,
    Math.round((input.now - new Date(input.heartbeat.lastSeenAt).getTime()) / 1_000),
  );
  const staleAfter = input.heartbeatIntervalSeconds * 2;

  return { status: ageSeconds > staleAfter ? 'STALE' : 'UP', ageSeconds };
}

export function buildQueueReport(input: QueueReportInput): QueueHealth {
  const inline = input.driver === 'memory';
  const { status, ageSeconds } = workerStatus({
    heartbeat: input.heartbeat,
    now: input.now,
    heartbeatIntervalSeconds: input.heartbeatIntervalSeconds,
    driver: input.driver,
    inline,
  });

  const worker: WorkerHeartbeatInfo = {
    status,
    lastSeenAt: input.heartbeat?.lastSeenAt ?? null,
    ageSeconds,
    pid: input.heartbeat?.pid ?? null,
    hostname: input.heartbeat?.hostname ?? null,
    startedAt: input.heartbeat?.startedAt ?? null,
    intervalSeconds: input.heartbeatIntervalSeconds,
  };

  const alerts: QueueAlert[] = [];

  if (input.driver === 'memory') {
    alerts.push({
      code: 'DURABLE_DISPATCH_DISABLED',
      level: 'INFO',
      message:
        'Background work runs on in-process timers: jobs in flight are lost on restart. Set EVENT_QUEUE_DRIVER=redis for durable dispatch.',
    });
  }

  if (status === 'ABSENT') {
    alerts.push({
      code: 'WORKER_HEARTBEAT_MISSING',
      level: 'CRITICAL',
      message:
        'No worker heartbeat has ever been seen: nothing is draining the queue. Start a worker before enqueuing more work.',
    });
  }

  if (status === 'STALE') {
    alerts.push({
      code: 'WORKER_HEARTBEAT_STALE',
      level: 'CRITICAL',
      message: `The last worker heartbeat was ${ageSeconds}s ago (expected every ${input.heartbeatIntervalSeconds}s): the worker has stopped or is wedged.`,
    });
  }

  if (input.paused) {
    alerts.push({
      code: 'QUEUE_PAUSED',
      level: 'CRITICAL',
      message: 'The queue is paused: nothing will be dispatched until it is resumed.',
    });
  }

  if (input.counts.waiting > input.backlogThreshold) {
    alerts.push({
      code: 'QUEUE_BACKLOG',
      level: 'WARNING',
      message: `${input.counts.waiting} jobs are waiting (threshold ${input.backlogThreshold}): the worker is slower than the enqueue rate.`,
    });
  }

  if (input.counts.failed > 0) {
    alerts.push({
      code: 'JOBS_FAILING',
      level: 'CRITICAL',
      message: `${input.counts.failed} job(s) failed and are not being retried automatically — inspect them and re-drive from the audit trail.`,
    });
  }

  // A durable queue with no schedule means the sweeps silently stopped.
  if (input.driver === 'redis') {
    const expected = [
      env.NOTIFICATION_RETRY_INTERVAL_SECONDS > 0 ? 'retry-sweep' : null,
      env.SLA_SWEEP_INTERVAL_SECONDS > 0 ? 'sla-sweep' : null,
    ].filter((id): id is string => id !== null);

    const registered = new Set(input.schedulers.map((scheduler) => scheduler.id));
    const missing = expected.filter((id) => !registered.has(id));

    if (missing.length > 0) {
      alerts.push({
        code: 'SCHEDULER_MISSING',
        level: 'WARNING',
        message: `No repeatable schedule registered for: ${missing.join(', ')}. Those sweeps will not run until a worker restarts.`,
      });
    }
  }

  return {
    driver: input.driver,
    queueName: input.queueName,
    counts: input.counts,
    paused: input.paused,
    schedulers: input.schedulers,
    worker,
    alerts,
    checkedAt: new Date(input.now).toISOString(),
  };
}

/** Reads the live queue and builds the report. Tolerates Redis being absent. */
export async function queueHealth(): Promise<QueueHealth> {
  const now = Date.now();
  const heartbeat = await readHeartbeat();
  const base = {
    heartbeat: heartbeat
      ? {
          pid: heartbeat.pid,
          hostname: heartbeat.hostname,
          startedAt: heartbeat.startedAt,
          lastSeenAt: heartbeat.lastSeenAt,
        }
      : null,
    now,
    heartbeatIntervalSeconds: env.WORKER_HEARTBEAT_INTERVAL_SECONDS,
    backlogThreshold: env.QUEUE_BACKLOG_THRESHOLD,
  };

  if (!durableDispatchEnabled()) {
    return buildQueueReport({
      ...base,
      driver: 'memory',
      queueName: 'in-process',
      counts: { waiting: 0, active: 0, delayed: 0, failed: 0, completed: 0 },
      paused: false,
      schedulers: [],
    });
  }

  try {
    const queue = getDurableQueue();
    const [counts, schedulers, paused] = await Promise.all([
      queue.counts(),
      queue.schedulers(),
      queue.paused(),
    ]);

    return buildQueueReport({
      ...base,
      driver: 'redis',
      queueName: queue.name,
      counts,
      paused,
      schedulers,
    });
  } catch (error) {
    // Redis being unreachable is itself the finding: report it as an absent
    // worker rather than turning the health check into a 500.
    const message = error instanceof Error ? error.message : 'unknown error';
    console.warn(`[gc3-api][queue] health check could not read the queue: ${message}`);

    return buildQueueReport({
      ...base,
      heartbeat: null,
      driver: 'redis',
      queueName: 'gc3-work',
      counts: { waiting: 0, active: 0, delayed: 0, failed: 0, completed: 0 },
      paused: false,
      schedulers: [],
    });
  }
}
