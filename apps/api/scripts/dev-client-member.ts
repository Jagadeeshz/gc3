// Dev-only fixture: an ACTIVE client *member* in the Helios workspace, so the
// member view (no billing, no subscription, no team roster) can be walked in a
// browser the same way the owner view is.
import 'dotenv/config';
import { prisma } from '../src/db/client';
import { hashPassword } from '../src/auth/password';

const PASSWORD = 'Verify-Portal-2026';
const EMAIL = 'client.member@helios.test';

const organization = await prisma.organization.findFirst({
  where: { name: { contains: 'Helios', mode: 'insensitive' }, deletedAt: null },
});

if (!organization) {
  throw new Error('Helios organization not found — run the Phase 2 fixtures first');
}

const passwordHash = await hashPassword(PASSWORD);

const user = await prisma.user.upsert({
  where: { email: EMAIL },
  create: {
    email: EMAIL,
    fullName: 'Meera Member',
    passwordHash,
    status: 'ACTIVE',
  },
  update: { passwordHash, status: 'ACTIVE' },
});

const existing = await prisma.membership.findFirst({
  where: { organizationId: organization.id, userId: user.id },
});

if (existing) {
  await prisma.membership.update({
    where: { id: existing.id },
    data: { roles: ['CLIENT_TEAM_MEMBER'], status: 'ACTIVE' },
  });
} else {
  await prisma.membership.create({
    data: {
      organizationId: organization.id,
      userId: user.id,
      roles: ['CLIENT_TEAM_MEMBER'],
      status: 'ACTIVE',
    },
  });
}

// A second owner, so the owner-only screens are not all backed by one account.
await prisma.membership.updateMany({
  where: { organizationId: organization.id, roles: { has: 'CLIENT_OWNER' } },
  data: { status: 'ACTIVE' },
});

console.log(`${EMAIL} / ${PASSWORD} — CLIENT_TEAM_MEMBER in ${organization.name}`);
await prisma.$disconnect();
