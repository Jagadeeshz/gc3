import {
  BookOpen,
  ClipboardList,
  CreditCard,
  FolderKanban,
  LayoutDashboard,
  LifeBuoy,
  MessageSquare,
  Package,
  Receipt,
  Settings,
  UserCircle,
  Users,
  Wrench,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/**
 * Client navigation.
 *
 * Two lists, one per role, because an owner and a member genuinely do different
 * work: the owner buys, pays and manages people; the member delivers and
 * collaborates. A member has no billing or subscription entry at all — not a
 * disabled one, not a greyed one, none — so there is nothing to click that the
 * API would refuse.
 *
 * `ownerOnly` entries are also filtered from the member list, so this file is the
 * single place that decides who sees what.
 */
export interface ClientNavItem {
  readonly href: string;
  readonly label: string;
  readonly icon: LucideIcon;
  readonly ownerOnly?: boolean;
  /** Present for members only — an owner reaches their profile from Settings. */
  readonly memberOnly?: boolean;
}

export interface ClientNavSection {
  readonly title: string;
  readonly items: readonly ClientNavItem[];
}

const DELIVERY: readonly ClientNavItem[] = [
  { href: '/overview', label: 'Overview', icon: LayoutDashboard },
  { href: '/subscription', label: 'My Subscription', icon: CreditCard, ownerOnly: true },
  { href: '/services', label: 'Services', icon: Wrench },
  { href: '/requests', label: 'Service Requests', icon: ClipboardList },
  { href: '/projects', label: 'Projects', icon: FolderKanban },
  { href: '/deliverables', label: 'Deliverables', icon: Package },
  { href: '/pod', label: 'My Pod', icon: Users, ownerOnly: true },
];

const ENGAGEMENT: readonly ClientNavItem[] = [
  { href: '/messages', label: 'Messages', icon: MessageSquare },
  { href: '/team', label: 'Team Members', icon: Users, ownerOnly: true },
  { href: '/knowledge', label: 'Knowledge Centre', icon: BookOpen },
  { href: '/support', label: 'Support', icon: LifeBuoy },
];

const BILLING: readonly ClientNavItem[] = [
  { href: '/billing', label: 'Billing & Invoices', icon: Receipt, ownerOnly: true },
];

const ACCOUNT: readonly ClientNavItem[] = [
  { href: '/settings', label: 'Settings', icon: Settings, ownerOnly: true },
  { href: '/profile', label: 'My Profile', icon: UserCircle, memberOnly: true },
];

/**
 * Builds the sidebar for a role.
 *
 * Owner: thirteen entries (the brief's list). Member: nine — no billing, no
 * subscription, no team roster, and no settings, because none of those belong to
 * them. Entries are filtered out entirely rather than disabled: a greyed link
 * still advertises a screen the API will refuse.
 */
export function clientNavFor(isOwner: boolean): readonly ClientNavSection[] {
  const keep = (items: readonly ClientNavItem[]) =>
    items.filter((item) => {
      if (isOwner && item.memberOnly) {
        return false;
      }

      return isOwner || !item.ownerOnly;
    });

  return [
    { title: 'Delivery', items: keep(DELIVERY) },
    { title: 'Engagement', items: keep(ENGAGEMENT) },
    { title: 'Billing', items: keep(BILLING) },
    { title: 'Account', items: keep(ACCOUNT) },
  ].filter((section) => section.items.length > 0);
}

/** The label a member sees for the projects screen, which they own but do not own *the* account. */
export const PROJECTS_LABEL = { owner: 'Projects', member: 'My Projects' } as const;
