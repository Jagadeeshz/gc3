// Seeds the official Quantocos capability-pod catalogue.
//
// Idempotent: re-running updates by `code` rather than duplicating, so it is safe
// at every deploy and in the test database.
//
//   pnpm --filter @gc3/api db:seed:pods
//
// Two rules this file encodes and nothing in the application may override:
//
//  1. Prices are the brief's, in integer minor units of the pod's currency. USD,
//     so $3,000 is 300_000. Nothing here converts currency; an FX guess would be a
//     commercial decision, not a seed value.
//  2. Stacking is data, not copy: `includesCodes` is the rule Growth carries
//     Creative, and Strategy carries both. The API and UI read it from here.
import 'dotenv/config';
import { prisma } from '../src/db/client';

interface PodSeed {
  code: string;
  name: string;
  tagline: string;
  description: string;
  monthlyPriceCents: number;
  creditRateCents: number;
  creditsIncluded: number;
  hoursIncluded: number;
  peakHoursIncluded: number;
  managers: number;
  specialists: number;
  agents: number;
  teamSummary: string | null;
  includesCodes: string[];
  perks: string[];
  minTermMonths: number;
  isCustomPriced: boolean;
  sortOrder: number;
}

const CREDIT_RATE_USD = 2_500; // $25.00 per credit

const PODS: PodSeed[] = [
  {
    code: 'CREATIVE',
    name: 'Creative Pod',
    tagline: 'Replaces your in-house creative function.',
    description:
      'A standing creative team on a monthly credit pool: social content, design, copy, video and motion, decks and brand assets.',
    monthlyPriceCents: 300_000, // $3,000
    creditRateCents: 0,
    creditsIncluded: 120,
    hoursIncluded: 0,
    peakHoursIncluded: 0,
    managers: 1,
    specialists: 2,
    agents: 2,
    teamSummary: null,
    includesCodes: [],
    perks: ['Social content', 'Design', 'Copy', 'Video & motion', 'Decks', 'Brand assets'],
    minTermMonths: 0,
    isCustomPriced: false,
    sortOrder: 10,
  },
  {
    code: 'GROWTH',
    name: 'Growth (Digital) Pod',
    tagline: 'Replaces an agency plus a creative team — one hire.',
    description:
      'Digital growth delivery on a larger credit pool, carrying the entire Creative catalogue on the same pool.',
    monthlyPriceCents: 600_000, // $6,000
    creditRateCents: 0,
    creditsIncluded: 240,
    hoursIncluded: 0,
    peakHoursIncluded: 0,
    managers: 1,
    specialists: 4,
    agents: 4,
    teamSummary: null,
    includesCodes: ['CREATIVE'],
    perks: ['Everything in Creative', 'Performance & lifecycle', 'Landing pages', 'Campaign delivery'],
    minTermMonths: 0,
    isCustomPriced: false,
    sortOrder: 20,
  },
  {
    code: 'STRATEGY',
    name: 'Strategy Pod',
    tagline: 'Replaces a fractional CMO/CTO and an agency.',
    description:
      'Senior strategy across brand, product and technology, carrying both the Growth and Creative catalogues.',
    monthlyPriceCents: 900_000, // $9,000
    creditRateCents: 0,
    creditsIncluded: 360,
    hoursIncluded: 0,
    peakHoursIncluded: 0,
    managers: 1,
    specialists: 6,
    agents: 6,
    teamSummary: null,
    includesCodes: ['GROWTH', 'CREATIVE'],
    perks: ['Everything in Growth & Creative', 'Positioning', 'Roadmapping', 'Architecture review'],
    minTermMonths: 0,
    isCustomPriced: false,
    sortOrder: 30,
  },
  {
    code: 'AUTOMATION',
    name: 'Automation Pod',
    tagline: 'Custom team, priced per credit.',
    description:
      'Process audits, RAG chatbots, voice agents, custom agents and content pipelines, staffed to the engagement.',
    monthlyPriceCents: 0,
    creditRateCents: CREDIT_RATE_USD,
    creditsIncluded: 0,
    hoursIncluded: 0,
    peakHoursIncluded: 0,
    managers: 0,
    specialists: 0,
    agents: 0,
    teamSummary: 'Custom team, scoped per engagement',
    includesCodes: [],
    perks: ['Process audits', 'RAG chatbots', 'Voice agents', 'Custom agents', 'Content pipelines'],
    minTermMonths: 0,
    isCustomPriced: true,
    sortOrder: 40,
  },
  {
    code: 'INTERACTIVE',
    name: 'Interactive Pod',
    tagline: 'Custom team, priced per credit.',
    description:
      'Property visualisation, 3D web experiences, configurators, scrollytelling, VR showrooms and game-engine proofs of concept.',
    monthlyPriceCents: 0,
    creditRateCents: CREDIT_RATE_USD,
    creditsIncluded: 0,
    hoursIncluded: 0,
    peakHoursIncluded: 0,
    managers: 0,
    specialists: 0,
    agents: 0,
    teamSummary: 'Custom team, scoped per engagement',
    includesCodes: [],
    perks: [
      'Property visualisation',
      '3D web experiences',
      'Configurators',
      'Scrollytelling',
      'VR showrooms',
      'Game-engine POCs',
    ],
    minTermMonths: 0,
    isCustomPriced: true,
    sortOrder: 50,
  },
  {
    code: 'REMAU',
    name: 'REMAU Pod',
    tagline: 'Real Estate Marketing & Automation.',
    description:
      'A shared pod for property launches: campaigns, NRI-diaspora marketing, XR walkthroughs and investor communications. Three-month minimum.',
    monthlyPriceCents: 800_000, // $8,000
    creditRateCents: 0,
    creditsIncluded: 0,
    hoursIncluded: 240,
    peakHoursIncluded: 280,
    managers: 0,
    specialists: 0,
    agents: 0,
    teamSummary: 'Shared pod · 240 hours a month, 280 at peak',
    includesCodes: [],
    perks: [
      'Property launch campaigns',
      'NRI-diaspora marketing',
      'XR walkthroughs',
      'Investor comms',
    ],
    minTermMonths: 3,
    isCustomPriced: false,
    sortOrder: 60,
  },
];

for (const pod of PODS) {
  await prisma.capabilityPod.upsert({
    where: { code: pod.code },
    create: { ...pod, currency: 'USD', isActive: true },
    update: { ...pod, currency: 'USD', isActive: true },
  });

  const parts = [
    pod.isCustomPriced ? `$${pod.creditRateCents / 100}/credit` : `$${pod.monthlyPriceCents / 100}/mo`,
    pod.creditsIncluded > 0 ? `${pod.creditsIncluded} credits` : null,
    pod.hoursIncluded > 0 ? `${pod.hoursIncluded}h (${pod.peakHoursIncluded}h peak)` : null,
    pod.managers + pod.specialists + pod.agents > 0
      ? `${pod.managers}M/${pod.specialists}S/${pod.agents}A`
      : (pod.teamSummary ?? 'custom team'),
  ].filter(Boolean);

  console.log(`${pod.code.padEnd(12)} ${parts.join(' · ')}`);
}

console.log(`\n${PODS.length} pods seeded`);
await prisma.$disconnect();
