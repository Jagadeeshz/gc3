// Dev-only fixture for the client portal walkthrough.
//
// 1. Puts the two accounts named in the portal spec on the password the spec uses,
//    so the documented logins actually work.
// 2. Seeds the eight capability areas as service categories in the demo tenant, so
//    the Services grid shows real catalogue rows rather than placeholder cards.
//
// Nothing here runs in production: it is a script a developer invokes by hand.
import 'dotenv/config';
import { prisma } from '../src/db/client';
import { hashPassword } from '../src/auth/password';

const PASSWORD = 'Password123!';

const ACCOUNTS = [
  { email: 'client.owner@helios.test', label: 'client owner', fullName: 'Aarav Shah' },
  { email: 'client.member@helios.test', label: 'client member', fullName: 'Meera Member' },
  { email: 'admin@gc3.local', label: 'ops admin', fullName: 'GC3 Platform Admin' },
] as const;

const CAPABILITIES = [
  { name: 'Creative', slug: 'creative', description: 'Brand systems, art direction and production artwork.', sla: 72 },
  { name: 'Digital', slug: 'digital', description: 'Websites, landing experiences and digital campaigns.', sla: 72 },
  { name: 'Interactive', slug: 'interactive', description: 'Prototypes, motion and interactive product surfaces.', sla: 96 },
  { name: 'Development', slug: 'development', description: 'Front-end and platform engineering, integrations and QA.', sla: 96 },
  { name: 'Strategy', slug: 'strategy', description: 'Positioning, research and go-to-market planning.', sla: 48 },
  { name: 'Learning', slug: 'learning', description: 'Enablement, curriculum and training delivery.', sla: 120 },
  { name: 'Automation', slug: 'automation', description: 'Workflow automation, agentic pipelines and integration glue.', sla: 96 },
  { name: 'Back Office', slug: 'back-office', description: 'Data hygiene, reporting and operational support.', sla: 48 },
] as const;

const passwordHash = await hashPassword(PASSWORD);

for (const account of ACCOUNTS) {
  const user = await prisma.user.findUnique({ where: { email: account.email } });

  if (!user) {
    console.warn(`missing ${account.label}: ${account.email} — skipped`);
    continue;
  }

  await prisma.user.update({
    where: { email: account.email },
    data: { passwordHash, status: 'ACTIVE', ...(account.fullName ? { fullName: account.fullName } : {}) },
  });

  console.log(`${account.label.padEnd(14)} ${account.email} → ${PASSWORD}`);
}

const organization = await prisma.organization.findFirst({
  where: { name: { contains: 'Helios', mode: 'insensitive' }, deletedAt: null },
});

if (!organization) {
  throw new Error('Helios organization not found — run the Phase 2 fixtures first');
}

for (const [index, capability] of CAPABILITIES.entries()) {
  await prisma.serviceCategory.upsert({
    where: { organizationId_slug: { organizationId: organization.id, slug: capability.slug } },
    create: {
      organizationId: organization.id,
      name: capability.name,
      slug: capability.slug,
      description: capability.description,
      slaDeliveryHours: capability.sla,
      isActive: true,
    },
    update: {
      name: capability.name,
      description: capability.description,
      slaDeliveryHours: capability.sla,
      isActive: true,
      deletedAt: null,
    },
  });

  console.log(`category ${String(index + 1).padStart(2, '0')} ${capability.name} (${capability.sla}h SLA)`);
}

console.log(`\n${CAPABILITIES.length} capabilities ready in ${organization.name}`);
await prisma.$disconnect();
