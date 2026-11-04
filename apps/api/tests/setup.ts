import { afterAll, beforeEach } from 'vitest';
import { prisma } from '../src/db/client';

/**
 * Every test starts from an empty, fully migrated schema. TRUNCATE ... CASCADE
 * clears the tenant-owned tables in one statement, so a leaked row from a
 * previous test can never make a tenancy assertion pass for the wrong reason.
 */
async function resetDatabase(): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "memberships", "audit_events", "users", "organizations" RESTART IDENTITY CASCADE',
  );
}

beforeEach(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});
