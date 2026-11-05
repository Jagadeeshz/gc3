import { Queue, Worker, type Job } from 'bullmq';
import IORedis from 'ioredis';
import type { QueueSchedulerInfo } from '@gc3/types';

/**
 * Durable queue primitive.
 *
 * A thin wrapper over BullMQ so the rest of the codebase never imports it
 * directly: the notification dispatcher and the sweeps only need "add a job" and
 * "handle a job", and tests can point the same primitive at a throwaway prefix.
 *
 * The point of this module is that a job lives in Redis, not in an array on the
 * heap. A process that dies between "the request committed" and "the email went
 * out" leaves the job behind for whatever worker comes up next.
 */
export interface QueueCounts {
  readonly waiting: number;
  readonly active: number;
  readonly delayed: number;
  readonly failed: number;
  readonly completed: number;
}

export type DurableJobHandler = (job: {
  readonly name: string;
  readonly data: unknown;
  readonly attemptsMade: number;
}) => Promise<void>;

export interface DurableQueue {
  readonly name: string;
  add(name: string, data: unknown, options?: { jobId?: string; delayMs?: number }): Promise<string>;
  startWorker(handler: DurableJobHandler, options?: { concurrency?: number; stalledIntervalMs?: number; lockDurationMs?: number }): Worker;
  /** Registers (idempotently) a job that repeats on a schedule. */
  scheduleEvery(schedulerId: string, name: string, everyMs: number): Promise<void>;
  counts(): Promise<QueueCounts>;
  /** Repeatable jobs currently registered, for the health report. */
  schedulers(): Promise<QueueSchedulerInfo[]>;
  paused(): Promise<boolean>;
  /** Removes everything this prefix owns — used by tests, never by the app. */
  obliterate(): Promise<void>;
  close(): Promise<void>;
}

export interface DurableQueueOptions {
  readonly name: string;
  readonly url: string;
  /** Namespacing prefix so several environments can share one Redis. */
  readonly prefix?: string;
}

function connectionFor(url: string): IORedis {
  // BullMQ requires the blocking commands to be allowed to wait indefinitely.
  return new IORedis(url, { maxRetriesPerRequest: null });
}

export function createDurableQueue(options: DurableQueueOptions): DurableQueue {
  const prefix = options.prefix ?? 'gc3';
  const connection = connectionFor(options.url);
  const queue = new Queue(options.name, { connection, prefix });

  const workers: Worker[] = [];

  return {
    name: options.name,

    async add(name, data, addOptions = {}) {
      const job = await queue.add(name, data, {
        // Job ids make an add idempotent: a duplicate enqueue is a no-op rather
        // than a second email.
        ...(addOptions.jobId ? { jobId: addOptions.jobId } : {}),
        ...(addOptions.delayMs ? { delay: addOptions.delayMs } : {}),
        // Retries are the sweep's job, not BullMQ's: a failed delivery has to be
        // audited and rebuilt from the database, which a blind retry cannot do.
        attempts: 1,
        removeOnComplete: { age: 3_600, count: 500 },
        removeOnFail: { age: 24 * 3_600, count: 1_000 },
      });

      return job.id ?? '';
    },

    startWorker(handler, workerOptions = {}) {
      const worker = new Worker(
        options.name,
        async (job: Job) => {
          await handler({
            name: job.name,
            data: job.data,
            attemptsMade: job.attemptsMade,
          });
        },
        {
          connection: connectionFor(options.url),
          prefix,
          concurrency: workerOptions.concurrency ?? 4,
          // How often this worker looks for jobs whose owner stopped renewing its
          // lock, and how long a claim stays valid without a renewal. A crashed
          // process stops renewing, and its job returns to the queue once the lock
          // expires — these are top-level in BullMQ v6, not under `settings`.
          ...(workerOptions.stalledIntervalMs
            ? { stalledInterval: workerOptions.stalledIntervalMs }
            : {}),
          ...(workerOptions.lockDurationMs
            ? { lockDuration: workerOptions.lockDurationMs }
            : {}),
        },
      );

      worker.on('failed', (job, error) => {
        console.error(
          `[gc3-api][queue] job ${job?.name ?? 'unknown'} failed: ${error.message}`,
        );
      });

      workers.push(worker);
      return worker;
    },

    async scheduleEvery(schedulerId, name, everyMs) {
      // upsert rather than add: restarting the API must not stack a second
      // scheduler on top of the first one.
      await queue.upsertJobScheduler(
        schedulerId,
        { every: everyMs },
        { name, data: {} },
      );
    },

    async counts() {
      const counts = await queue.getJobCounts(
        'waiting',
        'active',
        'delayed',
        'failed',
        'completed',
      );

      return {
        waiting: counts.waiting ?? 0,
        active: counts.active ?? 0,
        delayed: counts.delayed ?? 0,
        failed: counts.failed ?? 0,
        completed: counts.completed ?? 0,
      };
    },

    async schedulers() {
      const registered = await queue.getJobSchedulers(0, 50, true);

      return registered.map((scheduler) => ({
        id: scheduler.id ?? scheduler.key,
        everyMs: scheduler.every ?? null,
        nextRunAt: scheduler.next ?? null,
      }));
    },

    async paused() {
      return queue.isPaused();
    },

    async obliterate() {
      for (const worker of workers.splice(0)) {
        await worker.close();
      }

      await queue.obliterate({ force: true });
    },

    async close() {
      for (const worker of workers.splice(0)) {
        await worker.close();
      }

      await queue.close();
      await connection.quit();
    },
  };
}
