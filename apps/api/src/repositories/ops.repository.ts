import type {
  OpsDashboard,
  OpsOrganizationSummary,
  OpsQueueItem,
  ServiceRequestPriority,
  ServiceRequestStatus,
} from '@gc3/types';
import { prisma } from '../db/client';
import { OPEN_STATUSES } from '../lib/request-status';
import { computeSlaState } from '../lib/sla';
import { podRepository } from './pod.repository';

/**
 * Cross-tenant reads for the operations console.
 *
 * This is the only repository that deliberately reads across organizations. It is
 * mounted behind `ops:read` (PLATFORM_ADMIN and OPERATIONS_MANAGER only) and it
 * takes no tenant header — the tenant boundary here is the permission, not the
 * scope, which is why the routes that use it live outside the tenant middleware.
 */
export const opsRepository = {
  async dashboard(input: {
    queueLimit: number;
    organizationId?: string;
  }): Promise<OpsDashboard> {
    const tenantFilter = input.organizationId ? { organizationId: input.organizationId } : {};
    const now = new Date();

    const [
      organizations,
      statusGroups,
      overdueGroups,
      unassignedGroups,
      releasedGroups,
      memberGroups,
      pods,
      slaRows,
      queueRows,
    ] = await Promise.all([
      prisma.organization.findMany({
        where: { deletedAt: null, ...(input.organizationId ? { id: input.organizationId } : {}) },
        select: { id: true, name: true, slug: true, status: true },
        orderBy: { name: 'asc' },
      }),

      prisma.serviceRequest.groupBy({
        by: ['organizationId', 'status'],
        where: { deletedAt: null, ...tenantFilter },
        _count: { _all: true },
      }),

      prisma.serviceRequest.groupBy({
        by: ['organizationId'],
        where: {
          deletedAt: null,
          status: { in: [...OPEN_STATUSES] },
          dueAt: { lt: now },
          ...tenantFilter,
        },
        _count: { _all: true },
      }),

      prisma.serviceRequest.groupBy({
        by: ['organizationId'],
        where: {
          deletedAt: null,
          status: { in: [...OPEN_STATUSES] },
          podId: null,
          assigneeId: null,
          ...tenantFilter,
        },
        _count: { _all: true },
      }),

      prisma.deliverable.groupBy({
        by: ['organizationId'],
        where: { deletedAt: null, status: 'RELEASED', ...tenantFilter },
        _count: { _all: true },
      }),

      prisma.membership.groupBy({
        by: ['organizationId'],
        where: { status: 'ACTIVE', ...tenantFilter },
        _count: { _all: true },
      }),

      podRepository.listForOps(),

      // SLA states are computed per request, so the raw fields come back rather
      // than a count: the same helper that drives the sweep must drive the totals.
      prisma.serviceRequest.findMany({
        where: {
          deletedAt: null,
          status: { in: [...OPEN_STATUSES] },
          ...tenantFilter,
        },
        select: {
          organizationId: true,
          status: true,
          slaTargetAt: true,
          createdAt: true,
          closedAt: true,
        },
      }),

      // The routing worklist: anything open that is unassigned, half-assigned, or
      // past its due date. Sorted oldest-due first so the top of the list is what
      // an operations manager should actually look at.
      prisma.serviceRequest.findMany({
        where: {
          deletedAt: null,
          status: { in: [...OPEN_STATUSES] },
          OR: [{ podId: null }, { assigneeId: null }, { dueAt: { lt: now } }],
          ...tenantFilter,
        },
        orderBy: [{ dueAt: 'asc' }, { createdAt: 'asc' }],
        take: input.queueLimit,
        include: {
          organization: { select: { name: true } },
          pod: { select: { name: true } },
          assignee: { select: { fullName: true } },
        },
      }),
    ]);

    const openByOrg = new Map<string, number>();
    const blockedByOrg = new Map<string, number>();
    for (const group of statusGroups) {
      if (group.status === 'CLOSED' || group.status === 'CANCELLED') {
        continue;
      }

      openByOrg.set(
        group.organizationId,
        (openByOrg.get(group.organizationId) ?? 0) + group._count._all,
      );

      if (group.status === 'BLOCKED') {
        blockedByOrg.set(group.organizationId, group._count._all);
      }
    }

    const overdueByOrg = new Map(overdueGroups.map((g) => [g.organizationId, g._count._all]));
    const unassignedByOrg = new Map(unassignedGroups.map((g) => [g.organizationId, g._count._all]));
    const releasedByOrg = new Map(releasedGroups.map((g) => [g.organizationId, g._count._all]));
    const membersByOrg = new Map(memberGroups.map((g) => [g.organizationId, g._count._all]));

    const slaAtRiskByOrg = new Map<string, number>();
    const slaBreachedByOrg = new Map<string, number>();

    for (const row of slaRows) {
      const state = computeSlaState(
        {
          status: row.status as ServiceRequestStatus,
          targetAt: row.slaTargetAt,
          closedAt: row.closedAt,
          startAt: row.createdAt,
        },
        now,
      );

      if (state === 'AT_RISK') {
        slaAtRiskByOrg.set(row.organizationId, (slaAtRiskByOrg.get(row.organizationId) ?? 0) + 1);
      } else if (state === 'BREACHED') {
        slaBreachedByOrg.set(
          row.organizationId,
          (slaBreachedByOrg.get(row.organizationId) ?? 0) + 1,
        );
      }
    }

    const podCountByOrg = new Map<string, number>();
    for (const pod of pods) {
      podCountByOrg.set(pod.organizationId, (podCountByOrg.get(pod.organizationId) ?? 0) + 1);
    }

    const organizationRows: OpsOrganizationSummary[] = organizations.map((organization) => ({
      organizationId: organization.id,
      name: organization.name,
      slug: organization.slug,
      status: organization.status,
      openRequests: openByOrg.get(organization.id) ?? 0,
      blockedRequests: blockedByOrg.get(organization.id) ?? 0,
      overdueRequests: overdueByOrg.get(organization.id) ?? 0,
      unassignedRequests: unassignedByOrg.get(organization.id) ?? 0,
      podCount: podCountByOrg.get(organization.id) ?? 0,
      memberCount: membersByOrg.get(organization.id) ?? 0,
      releasedDeliverables: releasedByOrg.get(organization.id) ?? 0,
      slaAtRisk: slaAtRiskByOrg.get(organization.id) ?? 0,
      slaBreached: slaBreachedByOrg.get(organization.id) ?? 0,
    }));

    const queue: OpsQueueItem[] = queueRows.map((row) => ({
      requestId: row.id,
      reference: row.reference,
      title: row.title,
      organizationId: row.organizationId,
      organizationName: row.organization.name,
      status: row.status as ServiceRequestStatus,
      priority: row.priority as ServiceRequestPriority,
      dueAt: row.dueAt ? row.dueAt.toISOString() : null,
      podId: row.podId,
      podName: row.pod?.name ?? null,
      assigneeId: row.assigneeId,
      assigneeName: row.assignee?.fullName ?? null,
      slaTargetAt: row.slaTargetAt ? row.slaTargetAt.toISOString() : null,
      slaState: computeSlaState(
        {
          status: row.status as ServiceRequestStatus,
          targetAt: row.slaTargetAt,
          closedAt: row.closedAt,
          startAt: row.createdAt,
        },
        now,
      ),
    }));

    const sum = (pick: (row: OpsOrganizationSummary) => number): number =>
      organizationRows.reduce((total, row) => total + pick(row), 0);

    return {
      generatedAt: now.toISOString(),
      totals: {
        organizations: organizationRows.length,
        openRequests: sum((row) => row.openRequests),
        blockedRequests: sum((row) => row.blockedRequests),
        overdueRequests: sum((row) => row.overdueRequests),
        unassignedRequests: sum((row) => row.unassignedRequests),
        pods: pods.length,
        releasedDeliverables: sum((row) => row.releasedDeliverables),
        slaAtRisk: sum((row) => row.slaAtRisk),
        slaBreached: sum((row) => row.slaBreached),
      },
      organizations: organizationRows,
      pods,
      queue,
    };
  },
};
