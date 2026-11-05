// Dev-only fixtures for the Phase 4 browser walkthrough.
//
// Resets the walkthrough accounts to a known password, adds a FINANCE_MANAGER,
// and gives the demo tenant usage that exercises the warning and overage paths so
// the billing screens are not all zeroes.
import 'dotenv/config';
import { prisma } from '../src/db/client';
import { hashPassword } from '../src/auth/password';
import { financeRepository } from '../src/repositories/finance.repository';
import { usageRepository } from '../src/repositories/usage.repository';

const PASSWORD = 'Verify-Portal-2026';

async function upsertUser(
  email: string,
  fullName: string,
  platformRole: 'PLATFORM_ADMIN' | 'OPERATIONS_MANAGER' | 'FINANCE_MANAGER' | null,
) {
  const passwordHash = await hashPassword(PASSWORD);
  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    return prisma.user.update({
      where: { email },
      data: { passwordHash, status: 'ACTIVE', ...(platformRole ? { platformRole } : {}) },
    });
  }

  return prisma.user.create({
    data: { email, fullName, passwordHash, platformRole, status: 'ACTIVE' },
  });
}

const accounts = [
  ['portal.verify@gc3.local', 'Portal Admin', 'PLATFORM_ADMIN'],
  ['ops.manager@gc3.local', 'Priya Operations', 'OPERATIONS_MANAGER'],
  ['fin.manager@gc3.local', 'Ravi Finance', 'FINANCE_MANAGER'],
] as const;

for (const [email, fullName, role] of accounts) {
  const user = await upsertUser(email, fullName, role);
  console.log(`${role.padEnd(20)} ${user.email}`);
}

// The client owner keeps its membership; only the password is reset.
const clientEmail = 'client.owner@helios.test';
const client = await prisma.user.findUnique({ where: { email: clientEmail } });

if (client) {
  await prisma.user.update({
    where: { email: clientEmail },
    data: { passwordHash: await hashPassword(PASSWORD), status: 'ACTIVE' },
  });
  console.log(`CLIENT_OWNER         ${clientEmail}`);
} else {
  console.log(`CLIENT_OWNER         ${clientEmail} — MISSING, re-run the Phase 2 fixtures`);
}

// Usage on the demo tenant: 17 of 20 requests (85% — the warning band) and a
// little storage, so the meters and an overage line are both visible.
const organization = await prisma.organization.findFirst({
  where: { name: { contains: 'Helios', mode: 'insensitive' }, deletedAt: null },
});

if (organization) {
  const { tier } = await financeRepository.ensureSubscription(organization.id);
  await usageRepository.set(organization.id, 'REQUESTS', 17);
  await usageRepository.set(organization.id, 'STORAGE_KB', 640 * 1_024);
  await usageRepository.set(organization.id, 'API_CALLS', 51_400);
  console.log(
    `usage seeded for ${organization.name} (${tier.code}): 17/20 requests, 640 MB storage, 51,400 API calls`,
  );
} else {
  console.log('no Helios organization found — usage not seeded');
}

await prisma.$disconnect();
