// Puts one request into the SLA warning window, owned by a real staff account, so
// a queued sweep has something to find. Dev-only, like the other scripts here.
//
//   tsx scripts/prepare-sla-risk.ts [reference]
import 'dotenv/config';
import { prisma } from '../src/db/client';

const reference = process.argv[2] ?? 'REQ-4746CD7A';

const org = await prisma.organization.findFirstOrThrow({ where: { name: 'Helios Cloud' } });
const owner = await prisma.user.findFirstOrThrow({ where: { email: 'ops.specialist@gc3.local' } });
const request = await prisma.serviceRequest.findFirstOrThrow({
  where: { organizationId: org.id, reference },
});

await prisma.serviceRequest.update({
  where: { id: request.id },
  data: {
    status: 'IN_PROGRESS',
    priority: 'HIGH',
    assigneeId: owner.id,
    // A 72h contract with 71h elapsed: inside the final-quarter warning window.
    createdAt: new Date(Date.now() - 71 * 3_600_000),
    slaTargetAt: new Date(Date.now() + 3_600_000),
    slaAlertedState: null,
    slaAlertedAt: null,
  },
});

console.log(
  JSON.stringify({
    prepared: request.reference,
    id: request.id,
    assignee: owner.email,
    slaTargetAt: new Date(Date.now() + 3_600_000).toISOString(),
  }),
);

await prisma.$disconnect();
