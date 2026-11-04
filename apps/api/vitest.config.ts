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
    },
  },
});
