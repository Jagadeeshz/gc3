// Seeds the platform price list. Idempotent: re-running updates the existing rows
// by code rather than duplicating them, so this is safe at every deploy.
//
//   pnpm --filter @gc3/api db:seed:tiers
//
// Prices are integer minor units (paise for INR). These are the standard tiers the
// brief calls for; changing them is a commercial decision, which is why nothing in
// the application writes to this table — only this script does.
import 'dotenv/config';
import { prisma } from '../src/db/client';

interface TierSeed {
  code: string;
  name: string;
  description: string;
  monthlyPriceCents: number;
  requestsIncluded: number;
  storageMbIncluded: number;
  apiCallsIncluded: number;
  seatsIncluded: number;
  requestOverageCents: number;
  storageMbOverageCents: number;
  apiCallsOverageCentsPer1k: number;
  sortOrder: number;
}

const TIERS: TierSeed[] = [
  {
    code: 'STARTER',
    name: 'Starter',
    description: 'One delivery pod, standard turnaround, 20 requests a month.',
    monthlyPriceCents: 2_500_000, // ₹25,000
    requestsIncluded: 20,
    storageMbIncluded: 5_120, // 5 GB
    apiCallsIncluded: 50_000,
    seatsIncluded: 5,
    requestOverageCents: 50_000, // ₹500 per extra request
    storageMbOverageCents: 500, // ₹5 per extra MB
    apiCallsOverageCentsPer1k: 5_000, // ₹50 per extra 1,000 calls
    sortOrder: 10,
  },
  {
    code: 'PROFESSIONAL',
    name: 'Professional',
    description: 'Multiple pods, priority triage, 100 requests a month.',
    monthlyPriceCents: 7_500_000, // ₹75,000
    requestsIncluded: 100,
    storageMbIncluded: 25_600, // 25 GB
    apiCallsIncluded: 250_000,
    seatsIncluded: 20,
    requestOverageCents: 40_000, // ₹400
    storageMbOverageCents: 400, // ₹4
    apiCallsOverageCentsPer1k: 4_000, // ₹40
    sortOrder: 20,
  },
  {
    code: 'ENTERPRISE',
    name: 'Enterprise',
    description: 'Dedicated pods, named account team, 500 requests a month.',
    monthlyPriceCents: 25_000_000, // ₹2,50,000
    requestsIncluded: 500,
    storageMbIncluded: 102_400, // 100 GB
    apiCallsIncluded: 1_000_000,
    seatsIncluded: 100,
    requestOverageCents: 30_000, // ₹300
    storageMbOverageCents: 300, // ₹3
    apiCallsOverageCentsPer1k: 3_000, // ₹30
    sortOrder: 30,
  },
];

let written = 0;

for (const tier of TIERS) {
  await prisma.subscriptionTier.upsert({
    where: { code: tier.code },
    create: { ...tier, currency: 'INR', isActive: true },
    update: { ...tier, currency: 'INR', isActive: true },
  });

  written += 1;
}

const all = await prisma.subscriptionTier.findMany({
  orderBy: { sortOrder: 'asc' },
  select: { code: true, monthlyPriceCents: true, requestsIncluded: true, storageMbIncluded: true },
});

console.log(JSON.stringify({ seeded: written, tiers: all }, null, 2));
await prisma.$disconnect();
