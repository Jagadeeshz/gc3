// Load .env before any module reads process.env (config/env.ts validates at import).
import 'dotenv/config';
import { createApp } from './app';
import { env, SERVICE_NAME, SERVICE_VERSION } from './config/env';
import { startRetryWorker } from './notifications/retry';
import { closeDurableQueue, durableDispatchEnabled } from './queue/client';
import { startDurableWorkers, type DurableWorkers } from './queue/workers';
import { startSlaWorker } from './sla/monitor';

const app = createApp();
const server = app.listen(env.API_PORT, env.API_HOST, () => {
  console.log(
    `[${SERVICE_NAME}] v${SERVICE_VERSION} listening on http://${env.API_HOST}:${env.API_PORT}/api/v1 (${env.NODE_ENV})`,
  );
});

/**
 * Background work has two modes.
 *
 * `redis` puts event dispatch and both sweeps on a durable queue: a job is written
 * before the request returns, and a worker picks it up — including after a crash,
 * because the job no longer lives only in this process's memory.
 *
 * `memory` keeps the original in-process timers, which is right for a single dev
 * node and for the test suite, where determinism beats durability.
 */
let retryWorker: NodeJS.Timeout | null = null;
let slaWorker: NodeJS.Timeout | null = null;
let durableWorkers: DurableWorkers | null = null;

if (durableDispatchEnabled()) {
  durableWorkers = await startDurableWorkers();
  console.log(
    `[${SERVICE_NAME}] durable dispatch on ${env.REDIS_URL} (prefix "${env.QUEUE_PREFIX}") — retry sweep every ${env.NOTIFICATION_RETRY_INTERVAL_SECONDS}s, SLA sweep every ${env.SLA_SWEEP_INTERVAL_SECONDS}s`,
  );
} else {
  // Failed notification deliveries are retried on a schedule. Disabled in tests
  // (they drive the endpoint) and when the interval is 0.
  retryWorker = startRetryWorker();

  if (retryWorker) {
    console.log(
      `[${SERVICE_NAME}] notification retry worker every ${env.NOTIFICATION_RETRY_INTERVAL_SECONDS}s (max ${env.NOTIFICATION_MAX_ATTEMPTS} attempts)`,
    );
  }

  // SLA risk alerts ride the same idea: a cheap periodic pass, disabled in tests.
  slaWorker = startSlaWorker();

  if (slaWorker) {
    console.log(`[${SERVICE_NAME}] SLA risk sweep every ${env.SLA_SWEEP_INTERVAL_SECONDS}s`);
  }
}

/** Graceful shutdown so in-flight requests finish before the process exits. */
function shutdown(signal: string): void {
  console.log(`[${SERVICE_NAME}] ${signal} received — draining connections`);

  if (retryWorker) {
    clearInterval(retryWorker);
  }

  if (slaWorker) {
    clearInterval(slaWorker);
  }

  // Closing the worker lets BullMQ finish the job in hand before the process goes;
  // anything still queued stays queued for the next start.
  const teardown = durableWorkers
    ? durableWorkers.stop().then(() => closeDurableQueue())
    : Promise.resolve();

  void teardown
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[${SERVICE_NAME}] queue shutdown failed: ${message}`);
    })
    .finally(() => {
      server.close(() => {
        console.log(`[${SERVICE_NAME}] closed`);
        process.exit(0);
      });
    });

  // Hard stop if a connection refuses to drain.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
