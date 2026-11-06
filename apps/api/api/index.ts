import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApp } from '../src/app';

/**
 * Vercel entry point.
 *
 * The same Express app the long-running server boots, with no `listen()` and no
 * background workers — a serverless platform has nothing to keep a timer alive
 * between requests, so the sweeps run on demand (`POST /ops/sla/sweep`,
 * `POST /notifications/retry`) and the interval env vars are set to 0.
 *
 * The app is built once per instance and reused across invocations, which is what
 * makes warm starts fast; the Prisma pool is cached on globalThis for the same
 * reason (see src/db/client.ts).
 */
const app = createApp();

export default function handler(request: IncomingMessage, response: ServerResponse): void {
  app(request as never, response as never);
}
