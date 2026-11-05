import { afterAll, beforeEach } from 'vitest';
import { prisma } from '../src/db/client';
import { resetOutbox } from '../src/notifications';

/**
 * Every test starts from an empty, fully migrated schema. TRUNCATE ... CASCADE
 * clears the tenant-owned tables in one statement, so a leaked row from a
 * previous test can never make a tenancy assertion pass for the wrong reason.
 *
 * The notification outbox is reset alongside it, so a dispatch assertion only
 * ever sees messages produced by the test that is running.
 *
 * Tables added after the original list are named explicitly rather than left to
 * the cascade from `organizations`: the list documents what a tenant owns, and a
 * cascade from the wrong root is how a fixture leaks.
 */
const TENANT_TABLES = [
  'usage_meters',
  'invoice_line_items',
  'invoices',
  'organization_subscriptions',
  'tasks',
  'pods',
  'deliverables',
  'request_comments',
  'service_requests',
  'service_categories',
  'notification_deliveries',
  'memberships',
  'audit_events',
  'users',
  'organizations',
] as const;

/**
 * Truncation can collide with a connection from the previous test's pool that has
 * not released its lock yet — a real flake, seen once in a full run of 362 tests.
 * Retrying is honest here: the suite is serial, so nothing else can be holding
 * these tables and a retry is waiting for a lock to drop, not hiding a bug.
 */
async function resetDatabase(): Promise<void> {
  const statement = `TRUNCATE TABLE ${TENANT_TABLES.map((table) => `"${table}"`).join(', ')} RESTART IDENTITY CASCADE`;

  let lastError: unknown = null;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    try {
      await prisma.$executeRawUnsafe(statement);
      resetOutbox();
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
    }
  }

  throw lastError;
}

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});
