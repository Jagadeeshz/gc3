import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { env } from '../config/env';

/**
 * Prisma ORM 7 requires an explicit driver adapter — there is no bundled query
 * engine connection any more. The pool therefore behaves like node-postgres.
 */
function createPrismaClient(): PrismaClient {
  const adapter = new PrismaPg({
    connectionString: env.DATABASE_URL,
    // Match Prisma 6's 5s connect timeout; node-postgres defaults to unlimited.
    connectionTimeoutMillis: 5_000,
    max: 10,
  });

  return new PrismaClient({ adapter });
}

/**
 * Single client per process. Cached on globalThis so `tsx watch` reloads do not
 * leak a new pool on every file change.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient = globalForPrisma.prisma ?? createPrismaClient();

if (env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

/**
 * True when a Prisma write violates a unique constraint (P2002). Checked
 * structurally so the repository layer does not depend on generated class
 * identities that change between Prisma releases.
 */
export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}
