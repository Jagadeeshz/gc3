// Load .env before any module reads process.env (config/env.ts validates at import).
import 'dotenv/config';
import { createApp } from './app';
import { env, SERVICE_NAME, SERVICE_VERSION } from './config/env';
import { startRetryWorker } from './notifications/retry';
import { startSlaWorker } from './sla/monitor';

const app = createApp();
const server = app.listen(env.API_PORT, env.API_HOST, () => {
  console.log(
    `[${SERVICE_NAME}] v${SERVICE_VERSION} listening on http://${env.API_HOST}:${env.API_PORT}/api/v1 (${env.NODE_ENV})`,
  );
});

// Failed notification deliveries are retried on a schedule. Disabled in tests (they
// drive the endpoint) and when the interval is 0.
const retryWorker = startRetryWorker();

if (retryWorker) {
  console.log(
    `[${SERVICE_NAME}] notification retry worker every ${env.NOTIFICATION_RETRY_INTERVAL_SECONDS}s (max ${env.NOTIFICATION_MAX_ATTEMPTS} attempts)`,
  );
}

// SLA risk alerts ride the same idea: a cheap periodic pass, disabled in tests.
const slaWorker = startSlaWorker();

if (slaWorker) {
  console.log(
    `[${SERVICE_NAME}] SLA risk sweep every ${env.SLA_SWEEP_INTERVAL_SECONDS}s`,
  );
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

  server.close(() => {
    console.log(`[${SERVICE_NAME}] closed`);
    process.exit(0);
  });

  // Hard stop if a connection refuses to drain.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
