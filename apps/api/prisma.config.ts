import 'dotenv/config';
import { defineConfig } from 'prisma/config';

/**
 * Prisma CLI configuration (required in Prisma ORM 7).
 *
 * The datasource URL lives here rather than in schema.prisma, and environment
 * variables are no longer loaded automatically — hence the dotenv import.
 * The API itself reads DATABASE_URL through src/config/env.ts.
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    /**
     * Migrations must run against the DIRECT connection, not the pooler: a
     * transaction-mode pooler cannot hold the advisory lock Prisma takes, and
     * `migrate deploy` over 6543 fails with a confusing timeout.
     */
    /*
     * Migrations must run against the DIRECT connection: a transaction-mode pooler
     * cannot hold the advisory lock Prisma takes, and `migrate deploy` over 6543 fails
     * with a timeout that looks like a network fault.
     *
     * `prisma generate` also loads this file, and it must not demand a real URL —
     * generate does not connect, and the build machine only carries the pooled URL.
     * Hence the placeholder: it satisfies the config, generate succeeds, and a
     * migration run against it fails loudly on the first connection attempt instead
     * of silently using the wrong database.
     */
    url:
      process.env.SUPABASE_DIRECT_URL ??
      process.env.SUPABASE_DB_URL ??
      process.env.DATABASE_URL ??
      'postgresql://generate-only:generate-only@localhost:5432/generate-only',
  },
});
