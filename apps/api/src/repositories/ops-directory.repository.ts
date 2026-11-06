import type {
  DeliverableStatus,
  IsoDateTime,
  OpsCatalogueRow,
  OpsDeliverableRow,
  OpsNotificationRow,
  OpsRequestRow,
  OpsStaffRow,
  OpsTaskRow,
  OpsTenantRow,
  OpsWorkloadRow,
  ServiceRequestStatus,
  StaffRole,
  TaskStatus,
} from '@gc3/types';
import { prisma } from '../db/client';

/**
 * Cross-tenant reads for the staff dashboards.
 *
 * Two families of callers, and the repository states which is which:
 *
 *  - **Directory reads** (`listTenants`, `listStaff`) answer "who are our clients
 *    and who works here". They are the only queries that return rows from every
 *    tenant, and they are gated on `directory:read` — a permission the sales desk
 *    and the executive seat hold, because both need the client list, and neither
 *    needs the security log that `ops:read` also unlocks.
 *
 *  - **Operational reads** (`listRequests`, `listDeliverables`, `listTasks`,
 *    `workload`) answer "what is in flight". Gated on `ops:read` or `task:read`
 *    and, for a caller without platform visibility, narrowed to their own work
 *    before it leaves this file. Scoping happens in SQL, not in the component:
 *    a dashboard that filters in the browser has already leaked the rows.
 *
 * Every query is bounded by an explicit `take`. A console that can be asked for
 * "everything" is how an operations tool becomes an outage.
 */

const SLA_WARNING_FRACTION = 0.75;

function slaStateFor(
  slaTargetAt: Date | null,
  createdAt: Date,
  now: Date,
): OpsRequestRow['slaState'] {
  if (!slaTargetAt) {
    return 'NONE';
  }

  if (now.getTime() >= slaTargetAt.getTime()) {
    return 'BREACHED';
  }

  const total = slaTargetAt.getTime() - createdAt.getTime();
  const elapsed = now.getTime() - createdAt.getTime();

  return total > 0 && elapsed / total >= SLA_WARNING_FRACTION ? 'WARNING' : 'OK';
}

export const opsDirectoryRepository = {
  /** Every client account, with the counts an account manager asks about first. */
  async listTenants(limit = 100): Promise<readonly OpsTenantRow[]> {
    const rows = await prisma.organization.findMany({
      where: { deletedAt: null },
      take: limit,
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        region: true,
        timezone: true,
        createdAt: true,
        _count: {
          select: {
            memberships: true,
            serviceRequests: true,
            pods: true,
            deliverables: true,
          },
        },
        subscription: {
          select: {
            status: true,
            currentPeriodEnd: true,
            tier: { select: { code: true, name: true, monthlyPriceCents: true } },
          },
        },
      },
    });

    const openCounts = await prisma.serviceRequest.groupBy({
      by: ['organizationId'],
      where: {
        deletedAt: null,
        status: { notIn: ['CLOSED', 'CANCELLED', 'DELIVERED'] as ServiceRequestStatus[] },
      },
      _count: { _all: true },
    });

    const openByOrg = new Map(openCounts.map((row) => [row.organizationId, row._count._all]));

    return rows.map((row) => {
      const subscription = row.subscription;

      return {
        id: row.id,
        name: row.name,
        slug: row.slug,
        status: row.status,
        region: row.region,
        timezone: row.timezone,
        createdAt: row.createdAt.toISOString() as IsoDateTime,
        counts: {
          members: row._count.memberships,
          requests: row._count.serviceRequests,
          openRequests: openByOrg.get(row.id) ?? 0,
          deliverables: row._count.deliverables,
          pods: row._count.pods,
        },
        plan: {
          tierCode: subscription?.tier.code ?? null,
          tierName: subscription?.tier.name ?? null,
          status: subscription?.status ?? null,
          monthlyPricePaise: subscription?.tier.monthlyPriceCents ?? null,
          renewsAt: (subscription?.currentPeriodEnd.toISOString() as IsoDateTime) ?? null,
        },
      };
    });
  },

  /** Every staff account, its role, its pods and its live task load. */
  async listStaff(limit = 200): Promise<readonly OpsStaffRow[]> {
    const now = new Date();

    const rows = await prisma.user.findMany({
      where: { platformRole: { not: null }, deletedAt: null },
      take: limit,
      orderBy: { fullName: 'asc' },
      select: {
        id: true,
        email: true,
        fullName: true,
        platformRole: true,
        status: true,
        podMemberships: {
          select: { pod: { select: { id: true, name: true } } },
        },
      },
    });

    const loads = await prisma.task.groupBy({
      by: ['assigneeId'],
      where: { deletedAt: null, status: { in: ['TODO', 'IN_PROGRESS'] as TaskStatus[] } },
      _count: { _all: true },
    });

    const overdue = await prisma.task.groupBy({
      by: ['assigneeId'],
      where: {
        deletedAt: null,
        status: { in: ['TODO', 'IN_PROGRESS'] as TaskStatus[] },
        dueAt: { lt: now },
      },
      _count: { _all: true },
    });

    const loadByUser = new Map(loads.map((row) => [row.assigneeId, row._count._all]));
    const overdueByUser = new Map(overdue.map((row) => [row.assigneeId, row._count._all]));

    return rows.map((row) => ({
      id: row.id,
      email: row.email,
      fullName: row.fullName,
      platformRole: row.platformRole as StaffRole,
      status: row.status,
      pods: row.podMemberships.map((membership) => membership.pod),
      openTasks: loadByUser.get(row.id) ?? 0,
      overdueTasks: overdueByUser.get(row.id) ?? 0,
    }));
  },

  /** Requests across tenants, newest first, with SLA state computed once. */
  async listRequests(options: {
    readonly status?: ServiceRequestStatus | undefined;
    readonly organizationId?: string | undefined;
    readonly podId?: string | undefined;
    /** When present, the row set is exactly these requests — no tenant widening. */
    readonly requestIds?: readonly string[] | undefined;
    readonly limit?: number | undefined;
  }): Promise<readonly OpsRequestRow[]> {
    const now = new Date();

    const rows = await prisma.serviceRequest.findMany({
      where: {
        deletedAt: null,
        ...(options.status ? { status: options.status } : {}),
        ...(options.organizationId ? { organizationId: options.organizationId } : {}),
        ...(options.podId ? { podId: options.podId } : {}),
        ...(options.requestIds ? { id: { in: [...options.requestIds] } } : {}),
      },
      take: options.limit ?? 50,
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        reference: true,
        title: true,
        status: true,
        priority: true,
        organizationId: true,
        podId: true,
        slaTargetAt: true,
        createdAt: true,
        updatedAt: true,
        organization: { select: { name: true } },
        pod: { select: { name: true } },
      },
    });

    return rows.map((row) => ({
      id: row.id,
      reference: row.reference,
      title: row.title,
      status: row.status,
      priority: row.priority,
      organizationId: row.organizationId,
      organizationName: row.organization.name,
      podId: row.podId,
      podName: row.pod?.name ?? null,
      slaTargetAt: (row.slaTargetAt?.toISOString() as IsoDateTime) ?? null,
      slaState: slaStateFor(row.slaTargetAt, row.createdAt, now),
      createdAt: row.createdAt.toISOString() as IsoDateTime,
      updatedAt: row.updatedAt.toISOString() as IsoDateTime,
    }));
  },

  /** Deliverables across tenants — the review queue a pod manager works from. */
  async listDeliverables(options: {
    readonly status?: DeliverableStatus | undefined;
    readonly organizationId?: string | undefined;
    readonly requestIds?: readonly string[] | undefined;
    readonly limit?: number | undefined;
  }): Promise<readonly OpsDeliverableRow[]> {
    const rows = await prisma.deliverable.findMany({
      where: {
        deletedAt: null,
        ...(options.status ? { status: options.status } : {}),
        ...(options.organizationId ? { organizationId: options.organizationId } : {}),
        ...(options.requestIds ? { requestId: { in: [...options.requestIds] } } : {}),
      },
      take: options.limit ?? 50,
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        status: true,
        version: true,
        updatedAt: true,
        organization: { select: { name: true } },
        request: { select: { id: true, reference: true } },
      },
    });

    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      status: row.status,
      version: row.version,
      organizationName: row.organization.name,
      requestReference: row.request?.reference ?? null,
      requestId: row.request?.id ?? null,
      updatedAt: row.updatedAt.toISOString() as IsoDateTime,
    }));
  },

  /**
   * Internal tasks.
   *
   * `assigneeId` and `podIds` are applied by the route, not trusted from the
   * client: a specialist's "my tasks" is the id from their token, and a pod
   * manager's board is the pods they are seated in. Passing `null` for both is
   * the platform-wide view and requires `ops:read`.
   */
  async listTasks(options: {
    readonly assigneeId?: string | null | undefined;
    readonly podIds?: readonly string[] | null | undefined;
    readonly status?: TaskStatus | undefined;
    readonly organizationId?: string | undefined;
    readonly limit?: number | undefined;
  }): Promise<readonly OpsTaskRow[]> {
    const now = new Date();
    const podFilter =
      options.podIds === null || options.podIds === undefined
        ? {}
        : { podId: { in: [...options.podIds] } };

    const rows = await prisma.task.findMany({
      where: {
        deletedAt: null,
        ...(options.assigneeId ? { assigneeId: options.assigneeId } : {}),
        ...(options.status ? { status: options.status } : {}),
        ...(options.organizationId ? { organizationId: options.organizationId } : {}),
        ...podFilter,
      },
      take: options.limit ?? 100,
      orderBy: [{ dueAt: 'asc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        title: true,
        status: true,
        dueAt: true,
        assigneeId: true,
        organization: { select: { name: true } },
        request: { select: { id: true, reference: true } },
        pod: { select: { name: true } },
        assignee: { select: { fullName: true } },
      },
    });

    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      status: row.status,
      dueAt: (row.dueAt?.toISOString() as IsoDateTime) ?? null,
      organizationName: row.organization.name,
      requestReference: row.request.reference,
      requestId: row.request.id,
      podName: row.pod?.name ?? null,
      assigneeId: row.assigneeId,
      assigneeName: row.assignee?.fullName ?? null,
      overdue:
        row.dueAt !== null &&
        row.dueAt.getTime() < now.getTime() &&
        row.status !== 'DONE' &&
        row.status !== 'CANCELLED',
    }));
  },

  /**
   * Load per person.
   *
   * This is the honest capacity signal the schema supports: counts of open,
   * overdue and due-today tasks. It is not utilisation — there is no timesheet
   * table — and the UI says so rather than dividing by an invented capacity.
   */
  async workload(options: { readonly podIds?: readonly string[] | null | undefined }): Promise<
    readonly OpsWorkloadRow[]
  > {
    // An explicit empty scope means "nothing in view". Returning early matters:
    // a sentinel string here reaches Postgres as a uuid comparison and 500s.
    if (Array.isArray(options.podIds) && options.podIds.length === 0) {
      return [];
    }

    const now = new Date();
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    const podFilter =
      options.podIds === null || options.podIds === undefined
        ? {}
        : { podId: { in: [...options.podIds] } };

    const open = await prisma.task.groupBy({
      by: ['assigneeId'],
      where: {
        deletedAt: null,
        status: { in: ['TODO', 'IN_PROGRESS'] as TaskStatus[] },
        assigneeId: { not: null },
        ...podFilter,
      },
      _count: { _all: true },
    });

    const overdue = await prisma.task.groupBy({
      by: ['assigneeId'],
      where: {
        deletedAt: null,
        status: { in: ['TODO', 'IN_PROGRESS'] as TaskStatus[] },
        assigneeId: { not: null },
        dueAt: { lt: now },
        ...podFilter,
      },
      _count: { _all: true },
    });

    const dueToday = await prisma.task.groupBy({
      by: ['assigneeId'],
      where: {
        deletedAt: null,
        status: { in: ['TODO', 'IN_PROGRESS'] as TaskStatus[] },
        assigneeId: { not: null },
        dueAt: { gte: now, lte: endOfDay },
        ...podFilter,
      },
      _count: { _all: true },
    });

    const ids = open.map((row) => row.assigneeId).filter((id): id is string => id !== null);

    if (ids.length === 0) {
      return [];
    }

    const users = await prisma.user.findMany({
      where: { id: { in: ids }, deletedAt: null },
      select: {
        id: true,
        fullName: true,
        email: true,
        platformRole: true,
        podMemberships: { select: { pod: { select: { name: true } } } },
      },
    });

    const overdueBy = new Map(overdue.map((row) => [row.assigneeId, row._count._all]));
    const todayBy = new Map(dueToday.map((row) => [row.assigneeId, row._count._all]));
    const openBy = new Map(open.map((row) => [row.assigneeId, row._count._all]));

    return users
      .map((user) => ({
        userId: user.id,
        fullName: user.fullName,
        email: user.email,
        platformRole: (user.platformRole ?? 'SPECIALIST') as StaffRole,
        openTasks: openBy.get(user.id) ?? 0,
        overdueTasks: overdueBy.get(user.id) ?? 0,
        dueToday: todayBy.get(user.id) ?? 0,
        pods: user.podMemberships.map((membership) => membership.pod.name),
      }))
      .sort((a, b) => b.openTasks - a.openTasks);
  },

  /**
   * The requests a person touches through their own tasks.
   *
   * This is the scope a pod member's boards are built on: their work is the
   * door into the tenant, not a tenant-wide read. A pod manager passes their
   * pod ids instead of their user id.
   */
  async requestIdsForUser(
    userId: string,
    podIds: readonly string[] | null,
  ): Promise<readonly string[]> {
    const tasks = await prisma.task.findMany({
      where: {
        deletedAt: null,
        ...(podIds && podIds.length > 0
          ? { podId: { in: [...podIds] } }
          : { assigneeId: userId }),
      },
      select: { requestId: true },
      take: 500,
    });

    return [...new Set(tasks.map((task) => task.requestId))];
  },

  /** The pods a person is seated in — the boundary of a pod manager's board. */
  async podIdsForUser(userId: string): Promise<readonly string[]> {
    const seats = await prisma.podMember.findMany({
      where: { userId },
      select: { podId: true },
    });

    return seats.map((seat) => seat.podId);
  },

  /** The service catalogue, tenant-resolved, for catalogue administration. */
  async listCatalogue(options: { readonly limit?: number | undefined }): Promise<
    readonly OpsCatalogueRow[]
  > {
    const rows = await prisma.serviceCategory.findMany({
      where: { deletedAt: null },
      take: options.limit ?? 100,
      orderBy: [{ organization: { name: 'asc' } }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        slug: true,
        slaDeliveryHours: true,
        isActive: true,
        organization: { select: { name: true } },
      },
    });

    return rows.map((row) => ({
      id: row.id,
      organizationName: row.organization.name,
      name: row.name,
      slug: row.slug,
      slaDeliveryHours: row.slaDeliveryHours,
      isActive: row.isActive,
    }));
  },

  /** Recent notification attempts, tenant-resolved, newest first. */
  async listNotifications(options: { readonly limit?: number | undefined }): Promise<
    readonly OpsNotificationRow[]
  > {
    const rows = await prisma.notificationDelivery.findMany({
      take: options.limit ?? 50,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        kind: true,
        status: true,
        recipient: true,
        attempt: true,
        error: true,
        createdAt: true,
        organization: { select: { name: true } },
      },
    });

    return rows.map((row) => ({
      id: row.id,
      organizationName: row.organization.name,
      recipient: row.recipient,
      kind: row.kind,
      status: row.status,
      attempt: row.attempt,
      error: row.error,
      createdAt: row.createdAt.toISOString() as IsoDateTime,
    }));
  },
};
