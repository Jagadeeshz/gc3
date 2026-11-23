import { Bot, Compass, Headset, MousePointerClick, Palette, TrendingUp, type LucideIcon } from 'lucide-react';

/**
 * The catalogue, as data.
 *
 * Lives outside the client components so a server component can read it too: values
 * exported from a 'use client' module cannot be imported across that boundary, and
 * doing it fails the band silently rather than loudly.
 */

export type Pod = {
  name: string;
  outcome: string;
  composition: string;
  pool: string;
  icon: LucideIcon;
  /** Rendered plate for the catalogue card. REMAU is a shared unit and carries none. */
  image?: string;
};

export const PODS: readonly Pod[] = [
  {
    name: 'Creative',
    outcome: 'Brand systems, campaign visuals and production artwork, made by a standing team.',
    composition: '1 manager · 2 specialists · 2 agents',
    pool: '120 credits a month',
    icon: Palette,
    image: '/brand/pods/creative.jpg',
  },
  {
    name: 'Growth',
    outcome: 'Performance campaigns, lifecycle marketing and the analytics behind them.',
    composition: '1 manager · 4 specialists · 4 agents',
    pool: '240 credits a month',
    icon: TrendingUp,
    image: '/brand/pods/growth.jpg',
  },
  {
    name: 'Strategy',
    outcome: 'Positioning, roadmaps and commercial models that decide where the work goes.',
    composition: '1 manager · 6 specialists · 6 agents',
    pool: '360 credits a month',
    icon: Compass,
    image: '/brand/pods/strategy.jpg',
  },
  {
    name: 'Automation',
    outcome: 'Process audits, internal tooling and the workflows that remove the manual step.',
    composition: 'Custom team, scoped per engagement',
    pool: 'Priced per credit',
    icon: Bot,
    image: '/brand/pods/automation.jpg',
  },
  {
    name: 'Interactive',
    outcome: 'Product surfaces, prototypes and front-end builds that hold up in production.',
    composition: 'Custom team, scoped per engagement',
    pool: 'Priced per credit',
    icon: MousePointerClick,
    image: '/brand/pods/interactive.jpg',
  },
  {
    name: 'REMAU',
    outcome: 'Remote assistance unit: continuous capacity for the work that never stops.',
    composition: 'Shared pod · 240h, 280h peak',
    pool: 'Three-month minimum',
    icon: Headset,
  },
];
