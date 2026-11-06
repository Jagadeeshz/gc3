// Dev fixture for the staff dashboards: one account per persona, seated in the
// demo pod, with real tasks so the boards are not empty.
import 'dotenv/config';
import { prisma } from '../src/db/client';
import { hashPassword } from '../src/auth/password';

const PASSWORD = 'Password123!';

const ACCOUNTS = [
  { email: 'pod.manager@gc3.local', fullName: 'Priya Podmanager', role: 'POD_MANAGER' },
  { email: 'sales.manager@gc3.local', fullName: 'Sana Sales', role: 'SALES_MANAGER' },
  { email: 'management@gc3.local', fullName: 'Mahesh Management', role: 'MANAGEMENT' },
  { email: 'ops.manager@gc3.local', fullName: 'Ravi Operations', role: 'OPERATIONS_MANAGER' },
  { email: 'ops.specialist@gc3.local', fullName: 'Dev Specialist', role: 'SPECIALIST' },
] as const;

const passwordHash = await hashPassword(PASSWORD);

for (const account of ACCOUNTS) {
  const existing = await prisma.user.findUnique({ where: { email: account.email } });

  if (existing) {
    // Real accounts from earlier phases: only align the password and role.
    await prisma.user.update({
      where: { email: account.email },
      data: { passwordHash, status: 'ACTIVE', platformRole: account.role },
    });
    console.log(`${account.role.padEnd(16)} ${account.email} → ${PASSWORD} (existing)`);
    continue;
  }

  await prisma.user.upsert({
    where: { email: account.email },
    create: {
      email: account.email,
      fullName: account.fullName,
      passwordHash,
      status: 'ACTIVE',
      platformRole: account.role,
    },
    update: { passwordHash, status: 'ACTIVE', platformRole: account.role },
  });

  console.log(`${account.role.padEnd(16)} ${account.email} → ${PASSWORD}`);
}

const organization = await prisma.organization.findFirst({
  where: { name: { contains: 'Helios', mode: 'insensitive' }, deletedAt: null },
});

if (!organization) {
  throw new Error('Helios organization not found — run the earlier fixtures first');
}

const pod = await prisma.pod.findFirst({
  where: { organizationId: organization.id, deletedAt: null },
});

if (!pod) {
  throw new Error('No pod in the demo tenant — run the Phase 3 fixtures first');
}

// Seat the pod manager and the specialist in the demo pod.
const seats = ['pod.manager@gc3.local', 'ops.specialist@gc3.local'];

for (const email of seats) {
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    console.warn(`  (skipped seat: ${email} not found)`);
    continue;
  }

  await prisma.podMember.upsert({
    where: { podId_userId: { podId: pod.id, userId: user.id } },
    create: { organizationId: organization.id, podId: pod.id, userId: user.id },
    update: {},
  });

  console.log(`seated ${email} in ${pod.name}`);
}

// Real tasks, so "My Tasks" and the allocation board show something.
const request = await prisma.serviceRequest.findFirst({
  where: { organizationId: organization.id, deletedAt: null },
  orderBy: { createdAt: 'desc' },
});

const specialist = await prisma.user.findUnique({ where: { email: 'ops.specialist@gc3.local' } });
const podManager = await prisma.user.findUnique({ where: { email: 'pod.manager@gc3.local' } });

if (!request || !specialist || !podManager) {
  throw new Error('Need a request plus the specialist and pod-manager accounts');
}

const now = Date.now();
const TASKS = [
  { title: 'Draft the concept directions', assignee: specialist.id, due: new Date(now + 86400000), status: 'IN_PROGRESS' as const },
  { title: 'Assemble the Figma file', assignee: specialist.id, due: new Date(now - 86400000), status: 'TODO' as const },
  { title: 'Review copy before hand-off', assignee: podManager.id, due: new Date(now + 3600000), status: 'TODO' as const },
];

for (const task of TASKS) {
  const existing = await prisma.task.findFirst({
    where: { requestId: request.id, title: task.title, deletedAt: null },
  });

  if (existing) {
    await prisma.task.update({
      where: { id: existing.id },
      data: { assigneeId: task.assignee, dueAt: task.due, status: task.status, podId: pod.id },
    });
  } else {
    await prisma.task.create({
      data: {
        organizationId: organization.id,
        requestId: request.id,
        podId: pod.id,
        assigneeId: task.assignee,
        createdById: podManager.id,
        title: task.title,
        status: task.status,
        dueAt: task.due,
      },
    });
  }

  console.log(`task: ${task.title} → ${task.assignee === specialist.id ? 'specialist' : 'pod manager'}`);
}

console.log('\nstaff dashboards ready');
await prisma.$disconnect();
