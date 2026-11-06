/**
 * Align every local demo account on one known password.
 *
 * Development only. This is the script that exists because the alternative — a
 * password remembered from a previous session, half-applied — is how an afternoon
 * disappears. It refuses to run when NODE_ENV is production, touches nothing but the
 * password hash and the ACTIVE status, and prints what it did so the result can be
 * read rather than assumed.
 *
 *   pnpm --filter @gc3/api exec tsx scripts/dev-passwords.ts
 *   DEMO_PASSWORD='something else' pnpm --filter @gc3/api exec tsx scripts/dev-passwords.ts
 */
import 'dotenv/config';
import { hashPassword } from '../src/auth/password';
import { prisma } from '../src/db/client';

const PASSWORD = process.env.DEMO_PASSWORD ?? 'GC3-Demo-2026!';

if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to reset passwords with NODE_ENV=production.');
  process.exit(1);
}

const users = await prisma.user.findMany({
  select: { id: true, email: true, fullName: true, platformRole: true, status: true },
  orderBy: [{ platformRole: 'asc' }, { email: 'asc' }],
});

const hash = await hashPassword(PASSWORD);

for (const user of users) {
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: hash, status: 'ACTIVE' },
  });

  const memberships = await prisma.membership.findMany({
    where: { userId: user.id },
    select: { roles: true, organization: { select: { name: true } } },
  });

  const where =
    memberships.length > 0
      ? memberships.map((m) => `${m.roles.join('+')} in ${m.organization.name}`).join('; ')
      : (user.platformRole ?? 'no role');

  console.log(
    `${user.email.padEnd(34)} ${(user.fullName ?? '').padEnd(18)} ${where}`,
  );
}

console.log(`\n${users.length} accounts now on: ${PASSWORD}`);
await prisma.$disconnect();
