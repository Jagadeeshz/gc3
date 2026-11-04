// Load .env before any module reads process.env (config/env.ts validates at import).
import 'dotenv/config';
import { createApp } from './app';
import { env, SERVICE_NAME, SERVICE_VERSION } from './config/env';

const app = createApp();
const server = app.listen(env.API_PORT, env.API_HOST, () => {
  console.log(
    `[${SERVICE_NAME}] v${SERVICE_VERSION} listening on http://${env.API_HOST}:${env.API_PORT}/api/v1 (${env.NODE_ENV})`,
  );
});

/** Graceful shutdown so in-flight requests finish before the process exits. */
function shutdown(signal: string): void {
  console.log(`[${SERVICE_NAME}] ${signal} received — draining connections`);
  server.close(() => {
    console.log(`[${SERVICE_NAME}] closed`);
    process.exit(0);
  });

  // Hard stop if a connection refuses to drain.
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
