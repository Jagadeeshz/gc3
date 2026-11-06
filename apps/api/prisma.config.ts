import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

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
    url: process.env.SUPABASE_DIRECT_URL ?? env('DATABASE_URL'),
  },
});
