/**
 * Create one account per role, for both sides of the platform.
 *
 * Idempotent and additive: re-running updates the password and the role, never
 * deletes anything. Development and demonstration use — the passwords are printed so
 * they can be handed to whoever is testing, which is precisely why this must never run
 * against a database that holds real client data.
 *
 *   pnpm exec tsx scripts/seed-demo-accounts.ts            # local (DATABASE_URL)
 *   pnpm exec tsx scripts/seed-demo-accounts.ts --remote   # SUPABASE_DB_URL
 */
import 'dotenv/config';
import type { ClientRole, StaffRole } from '@gc3/types';
import { prisma } from '../src/db/client';
import { hashPassword } from '../src/auth/password';

const REMOTE_PASSWORD = 'GC3-Demo-2026!';

if (process.env.NODE_ENV === 'production') {
  console.warn('NODE_ENV=production — this is for demonstration environments only.');
}

const slugify = (value: string): string =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const ORG_NAME = 'Quantocos Demo';

interface Persona {
  readonly email: string;
  readonly name: string;
  readonly password: string;
  readonly staffRole?: StaffRole;
  readonly clientRoles?: readonly ClientRole[];
}

const PERSONAS: readonly Persona[] = [
  // ---------------------------------------------------------------- client side
  {
    email: 'owner@quantocos.demo',
    name: 'Demo Owner',
    password: REMOTE_PASSWORD,
    clientRoles: ['CLIENT_OWNER'],
  },
  {
    email: 'member@quantocos.demo',
    name: 'Demo Member',
    password: REMOTE_PASSWORD,
    clientRoles: ['CLIENT_TEAM_MEMBER'],
  },
  {
    email: 'approver@quantocos.demo',
    name: 'Demo Approver',
    password: REMOTE_PASSWORD,
    clientRoles: ['CLIENT_TEAM_MEMBER', 'CLIENT_APPROVER'],
  },

  // ---------------------------------------------------------------- staff side
  { email: 'admin@quantocos.com', name: 'Platform Admin', password: 'Gc3Admin2026!', staffRole: 'PLATFORM_ADMIN' },
  { email: 'operations@quantocos.com', name: 'Ops Manager', password: REMOTE_PASSWORD, staffRole: 'OPERATIONS_MANAGER' },
  { email: 'podmanager@quantocos.com', name: 'Pod Manager', password: REMOTE_PASSWORD, staffRole: 'POD_MANAGER' },
  { email: 'specialist@quantocos.com', name: 'Specialist', password: REMOTE_PASSWORD, staffRole: 'SPECIALIST' },
  { email: 'sales@quantocos.com', name: 'Sales Manager', password: REMOTE_PASSWORD, staffRole: 'SALES_MANAGER' },
  { email: 'finance@quantocos.com', name: 'Finance Manager', password: REMOTE_PASSWORD, staffRole: 'FINANCE_MANAGER' },
  { email: 'accountmanager@quantocos.com', name: 'Account Manager', password: REMOTE_PASSWORD, staffRole: 'ACCOUNT_MANAGER' },
  { email: 'management@quantocos.com', name: 'Management', password: REMOTE_PASSWORD, staffRole: 'MANAGEMENT' },
];

// ---------------------------------------------------------------- the tenant
const organization =
  (await prisma.organization.findFirst({ where: { slug: slugify(ORG_NAME) } })) ??
  (await prisma.organization.create({
    data: { name: ORG_NAME, slug: slugify(ORG_NAME), timezone: 'Asia/Kolkata', region: 'apac' },
  }));

// Hashes are per password, not per user: two accounts sharing a password share the
// digest, which is fine here and keeps the run quick by not hashing scrypt 11 times.
const hashCache = new Map<string, string>();

async function hash(password: string): Promise<string> {
  const cached = hashCache.get(password);
  if (cached) return cached;

  const digest = await hashPassword(password);
  hashCache.set(password, digest);
  return digest;
}

const rows: { email: string; password: string; role: string; where: string }[] = [];

for (const persona of PERSONAS) {
  const passwordHash = await hash(persona.password);

  const user = await prisma.user.upsert({
    where: { email: persona.email },
    update: {
      passwordHash,
      status: 'ACTIVE',
      fullName: persona.name,
      ...(persona.staffRole ? { platformRole: persona.staffRole } : {}),
    },
    create: {
      email: persona.email,
      fullName: persona.name,
      passwordHash,
      status: 'ACTIVE',
      ...(persona.staffRole ? { platformRole: persona.staffRole } : {}),
    },
  });

  if (persona.clientRoles) {
    const existing = await prisma.membership.findFirst({
      where: { userId: user.id, organizationId: organization.id },
    });

    if (existing) {
      await prisma.membership.update({
        where: { id: existing.id },
        data: { status: 'ACTIVE', roles: [...persona.clientRoles] },
      });
    } else {
      await prisma.membership.create({
        data: {
          userId: user.id,
          organizationId: organization.id,
          roles: [...persona.clientRoles],
          status: 'ACTIVE',
          inviteAcceptedAt: new Date(),
        },
      });
    }
  }

  rows.push({
    email: persona.email,
    password: persona.password,
    role: persona.staffRole ?? persona.clientRoles?.join('+') ?? '—',
    where: persona.staffRole ? 'staff console (/ops)' : `${ORG_NAME} (/overview)`,
  });
}

// ---------------------------------------------------------------- print the roster
const width = Math.max(...rows.map((row) => row.email.length));
console.log(`\n${'EMAIL'.padEnd(width)}  ${'PASSWORD'.padEnd(18)}  ${'ROLE'.padEnd(34)} SIDE`);
console.log('-'.repeat(width + 18 + 34 + 26));

for (const row of rows) {
  console.log(
    `${row.email.padEnd(width)}  ${row.password.padEnd(18)}  ${row.role.padEnd(34)} ${row.where}`,
  );
}

console.log(`\n${rows.length} accounts · tenant "${organization.name}" · ${organization.id}`);
await prisma.$disconnect();
