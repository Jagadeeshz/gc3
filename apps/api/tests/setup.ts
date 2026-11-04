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
 */
async function resetDatabase(): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "notification_deliveries", "memberships", "audit_events", "users", "organizations" RESTART IDENTITY CASCADE',
  );
  resetOutbox();
}

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});
