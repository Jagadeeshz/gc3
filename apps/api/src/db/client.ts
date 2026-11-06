import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { env, runtimeDatabaseUrl } from '../config/env';

/**
 * Prisma ORM 7 requires an explicit driver adapter — there is no bundled query
 * engine connection any more, so the pool behaves like node-postgres.
 *
 * Hosted Postgres (Supabase, Neon, Render) hands out URLs carrying parameters that
 * belong to the *pooler*, not to libpq: `pgbouncer=true`, `connection_limit=1`,
 * `schema=public`. Handing those straight to node-postgres throws
 * `invalid connection option`. So the string is parsed, the pooler-only keys are
 * dropped, and TLS is required whenever the host is a managed provider.
 *
 * Serverless also changes the pool arithmetic: one connection per instance, because
 * a burst of function invocations multiplies whatever `max` says. The pooler is what
 * makes that safe.
 */

const POOLER_ONLY_PARAMS = ['pgbouncer', 'connection_limit', 'pool_timeout', 'connect_timeout', 'schema'];

function normalise(raw: string): { connectionString: string; ssl: false | { rejectUnauthorized: boolean } } {
  const url = new URL(raw);

  for (const key of POOLER_ONLY_PARAMS) {
    url.searchParams.delete(key);
  }

  // Managed providers sign their own certificates; requiring a CA that is not in the
  // image would fail every connection. Local Postgres keeps plaintext.
  const managed = /supabase\.(co|com)|neon\.tech|render\.com|railway\.app|amazonaws\.com/i.test(url.hostname) ||
    url.searchParams.get('sslmode') === 'require';

  // `sslmode` is a libpq keyword; node-postgres takes TLS through the `ssl` option.
  url.searchParams.delete('sslmode');

  return {
    connectionString: url.toString(),
    ssl: managed ? { rejectUnauthorized: false } : false,
  };
}

function createPrismaClient(): PrismaClient {
  const { connectionString, ssl } = normalise(runtimeDatabaseUrl());
  const serverless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

  const adapter = new PrismaPg({
    connectionString,
    // Match Prisma 6's 5s connect timeout; node-postgres defaults to unlimited.
    connectionTimeoutMillis: 5_000,
    max: serverless ? 1 : 10,
    ...(ssl === false ? {} : { ssl }),
  });

  return new PrismaClient({ adapter });
}

/**
 * Single client per process. Cached on globalThis so `tsx watch` reloads — and
 * repeated warm invocations of a serverless function — do not leak a new pool.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient = globalForPrisma.prisma ?? createPrismaClient();

globalForPrisma.prisma = prisma;

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
