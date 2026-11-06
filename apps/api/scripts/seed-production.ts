/**
 * Seed a hosted database: capability pods + billing tiers.
 *
 * Both seeds are idempotent, so this is safe to run against an existing database —
 * it upserts the catalogue rather than duplicating it. Exists as one command because
 * "did you remember to run both seeds?" is a deployment failure waiting to happen.
 */
import 'dotenv/config';
import { execFileSync } from 'node:child_process';

const steps = ['scripts/seed-pods.ts', 'scripts/seed-tiers.ts'];

for (const step of steps) {
  console.log(`\n▶ ${step}`);
  execFileSync('pnpm', ['exec', 'tsx', step], { stdio: 'inherit' });
}

console.log('\nCatalogue seeded.');
