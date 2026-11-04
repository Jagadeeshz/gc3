#!/usr/bin/env node
/**
 * Prepares the integration-test database.
 *
 *  1. ensures the test database exists inside the local Podman Postgres
 *  2. applies migrations to it with `prisma migrate deploy`
 *
 * The development database is never touched.
 */
import 'dotenv/config';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const apiRoot = resolve(here, '..');
const CONTAINER = process.env.PG_CONTAINER ?? 'gc3-postgres';

const testUrl =
  process.env.TEST_DATABASE_URL ??
  'postgresql://gc3:gc3@localhost:5432/gc3_portal_test?schema=public';

const databaseName = new URL(testUrl).pathname.replace(/^\//, '');

if (!databaseName || !databaseName.endsWith('_test')) {
  console.error(
    `[test-db] Refusing to run: TEST_DATABASE_URL must point at a database ending in "_test" (got "${databaseName}").`,
  );
  process.exit(1);
}

function run(command, extraEnv = {}) {
  return execSync(command, {
    cwd: apiRoot,
    env: { ...process.env, ...extraEnv },
    stdio: 'pipe',
    encoding: 'utf8',
  });
}

let containerAvailable = true;
try {
  const exists = run(
    `podman exec ${CONTAINER} psql -U gc3 -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='${databaseName}'"`,
  ).trim();

  if (exists !== '1') {
    console.log(`[test-db] creating database "${databaseName}" in ${CONTAINER}`);
    run(
      `podman exec ${CONTAINER} psql -U gc3 -d postgres -c "CREATE DATABASE \\"${databaseName}\\""`,
    );
  } else {
    console.log(`[test-db] database "${databaseName}" already exists`);
  }
} catch (error) {
  containerAvailable = false;
  console.warn(
    `[test-db] could not reach Podman container "${CONTAINER}" — assuming "${databaseName}" already exists.\n` +
      `          ${error instanceof Error ? error.message.split('\n')[0] : String(error)}`,
  );
}

console.log('[test-db] applying migrations');
const out = run('pnpm exec prisma migrate deploy', { DATABASE_URL: testUrl });
console.log(out.trim());

if (!containerAvailable) {
  console.warn('[test-db] migration applied against an external database (Podman unavailable)');
}
