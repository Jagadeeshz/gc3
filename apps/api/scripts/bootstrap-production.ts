/**
 * Bootstrap a deployed GC³ instance: platform admin + a demo tenant you can log into.
 *
 * Production-safe by construction — it creates data, never deletes any, and it is
 * idempotent: re-running it re-uses the organisation, the users and the categories it
 * finds by their unique keys.
 *
 *   ADMIN_EMAIL=you@company.com ADMIN_PASSWORD='…' pnpm exec tsx scripts/bootstrap-production.ts
 *
 * The demo tenant is deliberately separate from the admin account: the admin exists to
 * operate the platform, the client owner exists to look at the product as a customer.
 */
import 'dotenv/config';
import { prisma } from '../src/db/client';
import { hashPassword } from '../src/auth/password';

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL ?? 'admin@gc3.local').toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const ADMIN_NAME = process.env.ADMIN_NAME ?? 'Platform Admin';

const DEMO_EMAIL = (process.env.DEMO_EMAIL ?? 'owner@quantocos.demo').toLowerCase();
const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? 'Quantocos-Demo-2026!';

if (!ADMIN_PASSWORD || ADMIN_PASSWORD.length < 12) {
  throw new Error('Set ADMIN_PASSWORD (12+ characters). It is the console login.');
}

const slugify = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// ---------------------------------------------------------------- platform admin
const adminHash = await hashPassword(ADMIN_PASSWORD);
const admin = await prisma.user.upsert({
  where: { email: ADMIN_EMAIL },
  update: { passwordHash: adminHash, status: 'ACTIVE', platformRole: 'PLATFORM_ADMIN' },
  create: {
    email: ADMIN_EMAIL,
    fullName: ADMIN_NAME,
    passwordHash: adminHash,
    status: 'ACTIVE',
    platformRole: 'PLATFORM_ADMIN',
  },
});
console.log(`admin      ${admin.email}`);

// ---------------------------------------------------------------- demo tenant
const orgName = 'Quantocos Demo';
const organization =
  (await prisma.organization.findFirst({ where: { slug: slugify(orgName) } })) ??
  (await prisma.organization.create({
    data: { name: orgName, slug: slugify(orgName), timezone: 'Asia/Kolkata', region: 'apac' },
  }));
console.log(`tenant     ${organization.name} (${organization.id})`);

const demoHash = await hashPassword(DEMO_PASSWORD);
const owner = await prisma.user.upsert({
  where: { email: DEMO_EMAIL },
  update: { passwordHash: demoHash, status: 'ACTIVE' },
  create: { email: DEMO_EMAIL, fullName: 'Demo Owner', passwordHash: demoHash, status: 'ACTIVE' },
});

const membership = await prisma.membership.findFirst({
  where: { userId: owner.id, organizationId: organization.id },
});

if (membership) {
  await prisma.membership.update({
    where: { id: membership.id },
    data: { status: 'ACTIVE', roles: ['CLIENT_OWNER'] },
  });
} else {
  await prisma.membership.create({
    data: {
      userId: owner.id,
      organizationId: organization.id,
      roles: ['CLIENT_OWNER'],
      status: 'ACTIVE',
      inviteAcceptedAt: new Date(),
    },
  });
}
console.log(`client     ${owner.email}`);

// ---------------------------------------------------------------- catalogue + work
const capabilities = [
  { name: 'Brand & Creative', description: 'Design, copy, social and motion', sla: 48 },
  { name: 'Growth & Performance', description: 'Paid, lifecycle and analytics', sla: 72 },
  { name: 'Platform & Automation', description: 'Integrations, agents and pipelines', sla: 96 },
];

const categories = [];
for (const capability of capabilities) {
  const slug = slugify(capability.name);
  const existing = await prisma.serviceCategory.findFirst({
    where: { organizationId: organization.id, slug },
  });

  categories.push(
    existing ??
      (await prisma.serviceCategory.create({
        data: {
          organizationId: organization.id,
          name: capability.name,
          slug,
          description: capability.description,
          slaDeliveryHours: capability.sla,
        },
      })),
  );
}
console.log(`categories ${categories.length}`);

const existingRequests = await prisma.serviceRequest.count({ where: { organizationId: organization.id } });

if (existingRequests === 0) {
  const seed = [
    { title: 'Q4 campaign creative set', priority: 'HIGH' as const, status: 'IN_PROGRESS' as const },
    { title: 'Website performance audit', priority: 'NORMAL' as const, status: 'SUBMITTED' as const },
    { title: 'Lifecycle email sequences', priority: 'LOW' as const, status: 'DRAFT' as const },
  ];

  for (const [index, item] of seed.entries()) {
    const slaHours = capabilities[index % capabilities.length].sla;

    await prisma.serviceRequest.create({
      data: {
        organizationId: organization.id,
        categoryId: categories[index % categories.length].id,
        reference: `REQ-${Math.random().toString(16).slice(2, 10).toUpperCase()}`,
        title: item.title,
        description: 'Seeded for the deployment walkthrough.',
        status: item.status,
        priority: item.priority,
        requesterId: owner.id,
        slaTargetAt: new Date(Date.now() + slaHours * 3_600_000),
        ...(item.status === 'DRAFT' ? {} : { submittedAt: new Date() }),
      },
    });
  }
  console.log(`requests   3`);
} else {
  console.log(`requests   ${existingRequests} already present`);
}

console.log('\n--- sign in ---');
console.log(`platform admin  ${ADMIN_EMAIL}`);
console.log(`client owner    ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);

await prisma.$disconnect();
