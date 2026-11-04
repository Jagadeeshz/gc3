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
    url: env('DATABASE_URL'),
  },
});
