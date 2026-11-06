import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApp } from './app';

/**
 * Serverless entry point (Vercel).
 *
 * The same Express app the long-running server boots, minus `listen()` and minus the
 * interval workers — a serverless platform has nothing to keep a timer alive between
 * requests, so sweep work is triggered on demand and those intervals are set to 0 in
 * the deployment environment.
 *
 * This file is bundled by esbuild into a single `api/index.js` (`pnpm build:vercel`).
 * `@vercel/node` alone cannot follow the project's extensionless TypeScript imports:
 * it compiles each file separately and Node's ESM resolver rejects `./app` with
 * ERR_MODULE_NOT_FOUND. Bundling resolves them at build time, exactly like the Docker
 * build does.
 */
const app = createApp();

export default function handler(request: IncomingMessage, response: ServerResponse): void {
  app(request as never, response as never);
}
