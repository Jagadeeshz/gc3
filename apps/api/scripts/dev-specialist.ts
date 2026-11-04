// Creates (or resets) a SPECIALIST account in the dev database so the ops guard
// can be exercised against the running server.
import 'dotenv/config';
import { prisma } from '../src/db/client';
import { hashPassword } from '../src/auth/password';

const email = 'ops.specialist@gc3.local';
const password = 'Verify-Portal-2026';

const existing = await prisma.user.findUnique({ where: { email } });

const user = existing
  ? await prisma.user.update({
      where: { email },
      data: { passwordHash: await hashPassword(password), status: 'ACTIVE', platformRole: 'SPECIALIST' },
    })
  : await prisma.user.create({
      data: {
        email,
        fullName: 'Ops Specialist',
        passwordHash: await hashPassword(password),
        platformRole: 'SPECIALIST',
        status: 'ACTIVE',
      },
    });

console.log(JSON.stringify({ id: user.id, email: user.email, platformRole: user.platformRole }));
await prisma.$disconnect();
