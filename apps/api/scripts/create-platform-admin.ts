#!/usr/bin/env tsx
/**
 * Bootstrap a GC3 staff account.
 *
 * There is deliberately no public registration endpoint — staff accounts are
 * provisioned out of band. This script is the only way a first PLATFORM_ADMIN
 * comes into existence.
 *
 *   pnpm --filter @gc3/api auth:bootstrap
 *   ADMIN_EMAIL=ops@quantocos.example ADMIN_PASSWORD='...' pnpm ... auth:bootstrap
 */
import 'dotenv/config';
import { hashPassword } from '../src/auth/password';
import { prisma } from '../src/db/client';
import { userRepository } from '../src/repositories/user.repository';
import type { StaffRole } from '@gc3/types';

const STAFF_ROLES: readonly StaffRole[] = [
  'PLATFORM_ADMIN',
  'OPERATIONS_MANAGER',
  'ACCOUNT_MANAGER',
  'POD_MANAGER',
  'SPECIALIST',
  'FINANCE_MANAGER',
];

async function main(): Promise<void> {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const fullName = process.env.ADMIN_NAME ?? 'GC3 Admin';
  const roleRaw = process.env.ADMIN_ROLE ?? 'PLATFORM_ADMIN';

  if (!email || !password) {
    console.error('ADMIN_EMAIL and ADMIN_PASSWORD are required.');
    console.error('  ADMIN_EMAIL=ops@quantocos.example ADMIN_PASSWORD=... pnpm auth:bootstrap');
    process.exit(1);
  }

  if (password.length < 12) {
    console.error('ADMIN_PASSWORD must be at least 12 characters.');
    process.exit(1);
  }

  const platformRole = STAFF_ROLES.find((candidate) => candidate === roleRaw);

  if (!platformRole) {
    console.error(`ADMIN_ROLE must be one of: ${STAFF_ROLES.join(', ')}`);
    process.exit(1);
  }

  const passwordHash = await hashPassword(password);
  const user = await userRepository.upsertStaff({ email, fullName, passwordHash, platformRole });

  console.log(`[bootstrap] ${user.email} ready — role ${user.platformRole}, status ${user.status}`);
  console.log(`[bootstrap] id ${user.id}`);
}

main()
  .catch((error: unknown) => {
    console.error('[bootstrap] failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
