// Dev-only fixtures for the Phase 3 browser walkthrough:
//  - an OPERATIONS_MANAGER account
//  - a SPECIALIST account (re-used from the slice 15 check)
//  - a client owner with a known password
//  - one request wound into the SLA warning window, so the sweep has something to find
import 'dotenv/config';
import { prisma } from '../src/db/client';
import { hashPassword } from '../src/auth/password';

const PASSWORD = 'Verify-Portal-2026';

async function upsertStaff(email: string, fullName: string, role: 'OPERATIONS_MANAGER' | 'SPECIALIST') {
  const passwordHash = await hashPassword(PASSWORD);
  const existing = await prisma.user.findUnique({ where: { email } });

  return existing
    ? prisma.user.update({
        where: { email },
        data: { passwordHash, status: 'ACTIVE', platformRole: role },
      })
    : prisma.user.create({
        data: { email, fullName, passwordHash, platformRole: role, status: 'ACTIVE' },
      });
}

const manager = await upsertStaff('ops.manager@gc3.local', 'Ops Manager', 'OPERATIONS_MANAGER');
const specialist = await upsertStaff('ops.specialist@gc3.local', 'Ops Specialist', 'SPECIALIST');

const clientEmail = 'client.owner@helios.test';
const client = await prisma.user.findUnique({ where: { email: clientEmail } });
if (client) {
  await prisma.user.update({
    where: { email: clientEmail },
    data: { passwordHash: await hashPassword(PASSWORD), status: 'ACTIVE' },
  });
}

const org = await prisma.organization.findFirst({ where: { name: 'Helios Cloud' } });
if (!org) {
  throw new Error('Helios Cloud missing — run the earlier slices first');
}

// Wind one open request into the warning window: a 72h contract, 71h elapsed.
const target = await prisma.serviceRequest.findFirst({
  where: { organizationId: org.id, deletedAt: null, status: { in: ['SUBMITTED', 'TRIAGE', 'IN_PROGRESS'] } },
  orderBy: { createdAt: 'asc' },
});

if (target) {
  await prisma.serviceRequest.update({
    where: { id: target.id },
    data: {
      priority: 'HIGH',
      createdAt: new Date(Date.now() - 71 * 3_600_000),
      slaTargetAt: new Date(Date.now() + 1 * 3_600_000),
      slaAlertedState: null,
      slaAlertedAt: null,
      assigneeId: specialist.id,
    },
  });
}

console.log(
  JSON.stringify(
    {
      manager: manager.email,
      specialist: specialist.email,
      client: client ? client.email : 'missing',
      organization: org.name,
      slaRequest: target ? { id: target.id, reference: target.reference } : null,
    },
    null,
    2,
  ),
);

await prisma.$disconnect();
