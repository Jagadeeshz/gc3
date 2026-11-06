import type { StaffRole } from '@gc3/types';
import {
  Activity,
  BarChart3,
  Bell,
  BookOpen,
  Boxes,
  Briefcase,
  Building2,
  ClipboardList,
  Clock,
  CreditCard,
  FileCheck2,
  FileStack,
  FolderKanban,
  Gauge,
  Globe2,
  Handshake,
  History,
  LayoutDashboard,
  LifeBuoy,
  ListChecks,
  MessagesSquare,
  Package,
  Plug,
  Repeat,
  ScrollText,
  Settings,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  UserCircle,
  Users,
  UsersRound,
  type LucideIcon,
} from 'lucide-react';

/**
 * The staff dashboards, per persona.
 *
 * A persona is what the product calls a role's workspace. Six exist, and the tab
 * list for each is fixed: a sales manager does not get to see the security log by
 * discovering a URL, and an administrator does not get a "my tasks" board.
 *
 * Each tab declares how honest it is:
 *
 *   live     — reads a real endpoint over real rows.
 *   partial  — reads something real, but not the whole idea (state which part).
 *   unbacked — no model exists yet. The panel says what would back it rather
 *              than rendering invented numbers.
 *
 * That third field is the point of this file: it is the record of which screens
 * are backed by the database and which are placeholders, in one place, instead of
 * a mock-data array pretending to be an operations console.
 */

export type OpsPersona =
  | 'POD_MEMBER'
  | 'POD_MANAGER'
  | 'SALES_MANAGER'
  | 'OPERATIONS_MANAGER'
  | 'MANAGEMENT'
  | 'ADMINISTRATOR';

export type OpsPanel =
  | 'overview'
  | 'tasks'
  | 'member-desk'
  | 'my-requests'
  | 'my-deliverables'
  | 'deliverables'
  | 'requests'
  | 'pods'
  | 'staff'
  | 'tenants'
  | 'workload'
  | 'catalogue'
  | 'notifications'
  | 'audit'
  | 'analytics'
  | 'finance'
  | 'subscriptions'
  | 'renewals'
  | 'sla'
  | 'regions'
  | 'retention'
  | 'knowledge'
  | 'profile'
  | 'settings'
  | 'unbacked';

export interface OpsTab {
  readonly key: string;
  readonly label: string;
  readonly icon: LucideIcon;
  readonly panel: OpsPanel;
  readonly backing: 'live' | 'partial' | 'unbacked';
  /** Shown on unbacked/partial tabs: what the screen is actually reading. */
  readonly note?: string;
}

/** Which workspace a signed-in staff member lands in. */
export function opsPersonaFor(platformRole: StaffRole | null): OpsPersona | null {
  switch (platformRole) {
    case 'SPECIALIST':
      return 'POD_MEMBER';
    case 'POD_MANAGER':
      return 'POD_MANAGER';
    case 'ACCOUNT_MANAGER':
    case 'SALES_MANAGER':
      return 'SALES_MANAGER';
    case 'OPERATIONS_MANAGER':
      return 'OPERATIONS_MANAGER';
    case 'MANAGEMENT':
      return 'MANAGEMENT';
    case 'FINANCE_MANAGER':
      return 'MANAGEMENT';
    case 'PLATFORM_ADMIN':
      return 'ADMINISTRATOR';
    default:
      return null;
  }
}

export const OPS_PERSONA_LABEL: Record<OpsPersona, string> = {
  POD_MEMBER: 'Pod member',
  POD_MANAGER: 'Pod manager',
  SALES_MANAGER: 'Sales manager',
  OPERATIONS_MANAGER: 'Operations manager',
  MANAGEMENT: 'Management',
  ADMINISTRATOR: 'Administrator',
};

const TABS: Record<OpsPersona, readonly OpsTab[]> = {
  // Nine tabs: the work in front of one person.
  POD_MEMBER: [
    { key: 'my-workspace', label: 'My Workspace', icon: LayoutDashboard, panel: 'member-desk', backing: 'live' },
    { key: 'my-tasks', label: 'My Tasks', icon: ListChecks, panel: 'tasks', backing: 'live' },
    { key: 'assigned-projects', label: 'Assigned Projects', icon: FolderKanban, panel: 'my-requests', backing: 'live' },
    { key: 'client-accounts', label: 'Client Accounts', icon: Building2, panel: 'tenants', backing: 'partial', note: 'Only the accounts your own work belongs to — derived from your tasks, not the tenant directory.' },
    { key: 'deliverables', label: 'Deliverables', icon: Package, panel: 'my-deliverables', backing: 'live' },
    { key: 'messages', label: 'Messages', icon: MessagesSquare, panel: 'unbacked', backing: 'unbacked', note: 'Comments live on each request. There is no cross-tenant message inbox in the schema.' },
    { key: 'time-utilization', label: 'Time & Utilization', icon: Clock, panel: 'unbacked', backing: 'unbacked', note: 'No timesheet or time-entry model exists. Task load is the only capacity signal the platform holds.' },
    { key: 'knowledge', label: 'Knowledge Centre', icon: BookOpen, panel: 'knowledge', backing: 'partial', note: 'A navigation map, not a document library.' },
    { key: 'my-profile', label: 'My Profile', icon: UserCircle, panel: 'profile', backing: 'live' },
  ],

  // Twelve tabs: running one pod.
  POD_MANAGER: [
    { key: 'overview', label: 'Overview', icon: LayoutDashboard, panel: 'overview', backing: 'live' },
    { key: 'my-pod', label: 'My Pod', icon: UsersRound, panel: 'pods', backing: 'live' },
    { key: 'client-accounts', label: 'Client Accounts', icon: Building2, panel: 'tenants', backing: 'live' },
    { key: 'service-requests', label: 'Service Requests', icon: ClipboardList, panel: 'requests', backing: 'live' },
    { key: 'projects', label: 'Projects', icon: FolderKanban, panel: 'requests', backing: 'live' },
    { key: 'task-allocation', label: 'Task Allocation', icon: ListChecks, panel: 'tasks', backing: 'live' },
    { key: 'deliverables', label: 'Deliverables', icon: Package, panel: 'deliverables', backing: 'live' },
    { key: 'team-performance', label: 'Team Performance', icon: Activity, panel: 'workload', backing: 'partial', note: 'Open, overdue and due-today task counts. No time tracking, so no utilisation percentage.' },
    { key: 'capacity', label: 'Capacity', icon: Gauge, panel: 'workload', backing: 'partial', note: 'Load per person against live work. Capacity itself is not a stored attribute.' },
    { key: 'messages', label: 'Messages', icon: MessagesSquare, panel: 'unbacked', backing: 'unbacked', note: 'Request comments only; no team inbox model.' },
    { key: 'reports', label: 'Reports', icon: BarChart3, panel: 'analytics', backing: 'live' },
    { key: 'settings', label: 'Settings', icon: Settings, panel: 'settings', backing: 'live' },
  ],

  // Ten tabs: the commercial desk.
  SALES_MANAGER: [
    { key: 'overview', label: 'Overview', icon: LayoutDashboard, panel: 'finance', backing: 'live' },
    { key: 'leads', label: 'Leads', icon: TrendingUp, panel: 'unbacked', backing: 'unbacked', note: 'No lead model. Nothing in the schema records an unqualified prospect.' },
    { key: 'companies', label: 'Companies', icon: Building2, panel: 'tenants', backing: 'live' },
    { key: 'opportunities', label: 'Opportunities', icon: Handshake, panel: 'unbacked', backing: 'unbacked', note: 'No pipeline or opportunity model, and no stage history to report on.' },
    { key: 'proposals', label: 'Proposals', icon: FileStack, panel: 'unbacked', backing: 'unbacked', note: 'Proposals are not modelled; there is no document entity with an expiry or an outcome.' },
    { key: 'subscriptions', label: 'Subscriptions', icon: CreditCard, panel: 'subscriptions', backing: 'live' },
    { key: 'onboarding', label: 'Client Onboarding', icon: Boxes, panel: 'unbacked', backing: 'unbacked', note: 'Tenants have a created-at date, but no onboarding steps, checklist or owner.' },
    { key: 'renewals', label: 'Renewals', icon: Repeat, panel: 'renewals', backing: 'partial', note: 'Derived from each subscription period end. There is no renewal workflow or outreach log.' },
    { key: 'sales-reports', label: 'Sales Reports', icon: BarChart3, panel: 'unbacked', backing: 'unbacked', note: 'Sales reporting needs the pipeline that does not exist yet. Revenue reporting is on Revenue.' },
    { key: 'settings', label: 'Settings', icon: Settings, panel: 'settings', backing: 'live' },
  ],

  // Eleven tabs: running delivery across pods.
  OPERATIONS_MANAGER: [
    { key: 'overview', label: 'Overview', icon: LayoutDashboard, panel: 'overview', backing: 'live' },
    { key: 'client-accounts', label: 'Client Accounts', icon: Building2, panel: 'tenants', backing: 'live' },
    { key: 'pod-management', label: 'Pod Management', icon: UsersRound, panel: 'pods', backing: 'live' },
    { key: 'service-requests', label: 'Service Requests', icon: ClipboardList, panel: 'requests', backing: 'live' },
    { key: 'projects', label: 'Projects', icon: FolderKanban, panel: 'requests', backing: 'live' },
    { key: 'workforce', label: 'Workforce', icon: Users, panel: 'staff', backing: 'live' },
    { key: 'capacity-planning', label: 'Capacity Planning', icon: Gauge, panel: 'workload', backing: 'partial', note: 'Live load per person. No stored capacity, so no percentage against it.' },
    { key: 'sla-delivery', label: 'SLA & Delivery', icon: LifeBuoy, panel: 'sla', backing: 'live' },
    { key: 'quality-feedback', label: 'Quality & Feedback', icon: FileCheck2, panel: 'unbacked', backing: 'unbacked', note: 'No QA score, CSAT rating or feedback collection exists in the schema.' },
    { key: 'reports', label: 'Reports', icon: BarChart3, panel: 'analytics', backing: 'live' },
    { key: 'settings', label: 'Settings', icon: Settings, panel: 'settings', backing: 'live' },
  ],

  // Ten tabs: the executive seat. Read-only by construction.
  MANAGEMENT: [
    { key: 'executive-overview', label: 'Executive Overview', icon: LayoutDashboard, panel: 'overview', backing: 'live' },
    { key: 'revenue', label: 'Revenue', icon: TrendingUp, panel: 'finance', backing: 'live' },
    { key: 'subscriptions', label: 'Subscriptions', icon: CreditCard, panel: 'subscriptions', backing: 'live' },
    { key: 'clients', label: 'Clients', icon: Building2, panel: 'tenants', backing: 'live' },
    { key: 'sales-performance', label: 'Sales Performance', icon: Handshake, panel: 'unbacked', backing: 'unbacked', note: 'There is no pipeline to attribute revenue to, so there is no sales performance to report.' },
    { key: 'pod-performance', label: 'Pod Performance', icon: Activity, panel: 'analytics', backing: 'live' },
    { key: 'service-delivery', label: 'Service Delivery', icon: LifeBuoy, panel: 'sla', backing: 'live' },
    { key: 'regional-performance', label: 'Regional Performance', icon: Globe2, panel: 'regions', backing: 'partial', note: 'Grouped by the tenant region field. Regions are labels, not operating units with their own targets.' },
    { key: 'retention', label: 'Retention', icon: TrendingDown, panel: 'retention', backing: 'partial', note: 'Subscription status by tenant. No historical churn events or cohort analysis.' },
    { key: 'business-reports', label: 'Business Reports', icon: BarChart3, panel: 'analytics', backing: 'live' },
  ],

  // Eleven tabs: the platform itself.
  ADMINISTRATOR: [
    { key: 'admin-overview', label: 'Admin Overview', icon: LayoutDashboard, panel: 'overview', backing: 'live' },
    { key: 'users-roles', label: 'Users & Roles', icon: Users, panel: 'staff', backing: 'live' },
    { key: 'organizations', label: 'Organizations', icon: Building2, panel: 'tenants', backing: 'live' },
    { key: 'subscriptions-plans', label: 'Subscriptions & Plans', icon: CreditCard, panel: 'subscriptions', backing: 'live' },
    { key: 'service-catalogue', label: 'Service Catalogue', icon: BookOpen, panel: 'catalogue', backing: 'live' },
    { key: 'pod-configuration', label: 'Pod Configuration', icon: UsersRound, panel: 'pods', backing: 'live' },
    { key: 'regions-currencies', label: 'Regions & Currencies', icon: Globe2, panel: 'regions', backing: 'partial', note: 'Regions are real (tenant field). Currency is not modelled — every amount is INR paise.' },
    { key: 'notifications', label: 'Notifications', icon: Bell, panel: 'notifications', backing: 'live' },
    { key: 'integrations', label: 'Integrations', icon: Plug, panel: 'unbacked', backing: 'unbacked', note: 'No integration registry. SMTP and Redis are configured by environment, not by record.' },
    { key: 'audit-logs', label: 'Audit Logs', icon: History, panel: 'audit', backing: 'live' },
    { key: 'platform-settings', label: 'Platform Settings', icon: ScrollText, panel: 'settings', backing: 'live' },
  ],
};

export function opsTabsFor(persona: OpsPersona): readonly OpsTab[] {
  return TABS[persona];
}

/** The tab a request resolves to: the named one if it belongs, else the first. */
export function resolveOpsTab(persona: OpsPersona, key: string | null): OpsTab {
  const tabs = TABS[persona];
  const match = key ? tabs.find((tab) => tab.key === key) : undefined;

  return match ?? (tabs[0] as OpsTab);
}

export const OPS_BACKING_LABEL: Record<OpsTab['backing'], string> = {
  live: 'Live data',
  partial: 'Partial data',
  unbacked: 'Not instrumented',
};

export { ShieldCheck };
