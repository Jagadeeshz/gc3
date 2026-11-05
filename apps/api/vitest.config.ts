import 'dotenv/config';
import { defineConfig } from 'vitest/config';

/**
 * Integration tests run against a real PostgreSQL database, not a mock.
 * TEST_DATABASE_URL keeps them off the development database; scripts/prepare-test-db.mjs
 * creates and migrates it before the suite runs.
 */
const testDatabaseUrl =
  process.env.TEST_DATABASE_URL ??
  'postgresql://gc3:gc3@localhost:5432/gc3_portal_test?schema=public';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // One shared database: run files serially so truncation cannot race.
    fileParallelism: false,
    sequence: { concurrent: false },
    testTimeout: 20_000,
    hookTimeout: 30_000,
    setupFiles: ['tests/setup.ts'],
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: testDatabaseUrl,
      // Fixed test secret: tokens are minted and verified inside the suite only.
      AUTH_SECRET: 'test-secret-0123456789-0123456789-abcdef',
      AUTH_TOKEN_TTL_SECONDS: '900',
      // Capture invitations in memory so dispatch can be asserted.
      NOTIFICATION_DRIVER: 'memory',
      WEB_APP_URL: 'http://localhost:3000',
      // Uploads must not land in the directory the dev server writes to, or a test
      // run would overwrite real deliverable files (and vice versa).
      UPLOAD_DIR: 'storage/test',
      // The durability suite talks to the real Redis the API uses, under a
      // throwaway prefix. Like Postgres, it must be running — a durability test
      // against a stub would prove nothing.
      REDIS_URL: process.env.REDIS_URL ?? 'redis://localhost:6379',
      // The suite exercises the durable path explicitly, test by test; everything
      // else stays on the deterministic in-process driver.
      EVENT_QUEUE_DRIVER: 'memory',
      QUEUE_PREFIX: 'gc3-test',
      // Rate limiting is off by default in the suite: fixtures log in hundreds of
      // times from one address. The security suite turns both limits down to a
      // handful on purpose, so the 429 path still runs through the real middleware.
      RATE_LIMIT_MAX: '0',
      AUTH_RATE_LIMIT_MAX: '0',
    },
  },
});
