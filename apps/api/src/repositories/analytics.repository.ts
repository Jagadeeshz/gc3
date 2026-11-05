import type { AnalyticsReport, PodEfficiencyRow, TenantGrowthRow, ThroughputBucket } from '@gc3/types';
import { prisma } from '../db/client';

/**
 * Executive analytics.
 *
 * Read-only reporting over the operational tables. Two rules shape the SQL:
 *
 *  1. **Time is bucketed in the database.** `date_trunc` and `percentile_cont`
 *     are what Postgres is for; pulling every row into Node to average it is how
 *     an analytics endpoint becomes a memory incident at month end.
 *  2. **A number that cannot be computed is null, not zero.** "No request has
 *     closed yet" and "requests close in zero hours" are different claims, and a
 *     dashboard that conflates them lies quietly.
 *
 * Nothing here reads a client's data across tenants: the whole point is the
 * cross-tenant view, which is why the route is gated on `ops:read`.
 */
interface TurnaroundRow {
  sampled: bigint | number;
  avg_hours: number | null;
  median_hours: number | null;
  p90_hours: number | null;
  on_time: bigint | number;
  late: bigint | number;
}

interface ThroughputRow {
  bucket: string;
  total: bigint | number;
}

interface PodRow {
  id: string;
  name: string;
  open_requests: bigint | number;
  closed_requests: bigint | number;
  avg_open_age_hours: number | null;
  on_time: bigint | number;
  late: bigint | number;
}

interface GrowthRow {
  month: string;
  new_tenants: bigint | number;
}

function ratio(part: number, whole: number): number | null {
  return whole === 0 ? null : Math.round((part / whole) * 1_000) / 10;
}

function round(value: number | null): number | null {
  return value === null ? null : Math.round(value * 10) / 10;
}

/** "2026-11-03" -> "03 Nov"; "2026-11" -> "Nov 26". */
function bucketLabel(bucket: string, monthly: boolean): string {
  const [year, month, day] = bucket.split('-');

  if (monthly) {
    return new Date(Date.UTC(Number(year), Number(month) - 1, 1)).toLocaleDateString('en-GB', {
      month: 'short',
      year: '2-digit',
      timeZone: 'UTC',
    });
  }

  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day))).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    timeZone: 'UTC',
  });
}

export const analyticsRepository = {
  /**
   * The platform report.
   *
   * `windowDays` bounds the flow and turnaround figures; totals describe the
   * platform as it stands now, because "how many tenants exist" is not a
   * time-boxed question.
   */
  async report(input: { windowDays: number; now?: Date } = { windowDays: 90 }): Promise<AnalyticsReport> {
    const now = input.now ?? new Date();
    const since = new Date(now.getTime() - input.windowDays * 86_400_000);
    const weekBuckets = 8;
    const monthBuckets = 6;

    const [
      turnaroundRows,
      createdRows,
      closedRows,
      podRows,
      growthRows,
      totals,
      activeTenants,
      tenantsBeforeWindow,
    ] = await Promise.all([
      // Turnaround and punctuality, in one pass over the closed requests.
      prisma.$queryRaw<TurnaroundRow[]>`
        SELECT
          COUNT(*)::bigint AS sampled,
          AVG(EXTRACT(EPOCH FROM (closed_at - created_at)) / 3600)::float AS avg_hours,
          PERCENTILE_CONT(0.5) WITHIN GROUP (
            ORDER BY EXTRACT(EPOCH FROM (closed_at - created_at)) / 3600
          )::float AS median_hours,
          PERCENTILE_CONT(0.9) WITHIN GROUP (
            ORDER BY EXTRACT(EPOCH FROM (closed_at - created_at)) / 3600
          )::float AS p90_hours,
          COUNT(*) FILTER (
            WHERE sla_target_at IS NOT NULL AND closed_at <= sla_target_at
          )::bigint AS on_time,
          COUNT(*) FILTER (
            WHERE sla_target_at IS NOT NULL AND closed_at > sla_target_at
          )::bigint AS late
        FROM service_requests
        WHERE deleted_at IS NULL AND closed_at IS NOT NULL AND closed_at >= ${since}
      `,
      // Flow in: requests raised per week.
      prisma.$queryRaw<ThroughputRow[]>`
        SELECT to_char(date_trunc('week', created_at), 'YYYY-MM-DD') AS bucket,
               COUNT(*)::bigint AS total
        FROM service_requests
        WHERE deleted_at IS NULL AND created_at >= ${since}
        GROUP BY 1 ORDER BY 1
      `,
      // Flow out: requests closed per week — bucketed by closure, not creation,
      // so a slow month shows up in the week it was actually cleared.
      prisma.$queryRaw<ThroughputRow[]>`
        SELECT to_char(date_trunc('week', closed_at), 'YYYY-MM-DD') AS bucket,
               COUNT(*)::bigint AS total
        FROM service_requests
        WHERE deleted_at IS NULL AND closed_at IS NOT NULL AND closed_at >= ${since}
        GROUP BY 1 ORDER BY 1
      `,
      prisma.$queryRaw<PodRow[]>`
        SELECT p.id,
               p.name,
               COUNT(r.id) FILTER (WHERE r.closed_at IS NULL)::bigint AS open_requests,
               COUNT(r.id) FILTER (WHERE r.closed_at IS NOT NULL)::bigint AS closed_requests,
               AVG(EXTRACT(EPOCH FROM (now() - r.created_at)) / 3600)
                 FILTER (WHERE r.closed_at IS NULL)::float AS avg_open_age_hours,
               COUNT(r.id) FILTER (
                 WHERE r.closed_at IS NOT NULL AND r.sla_target_at IS NOT NULL
                   AND r.closed_at <= r.sla_target_at
               )::bigint AS on_time,
               COUNT(r.id) FILTER (
                 WHERE r.closed_at IS NOT NULL AND r.sla_target_at IS NOT NULL
                   AND r.closed_at > r.sla_target_at
               )::bigint AS late
        FROM pods p
        LEFT JOIN service_requests r ON r.pod_id = p.id AND r.deleted_at IS NULL
        WHERE p.deleted_at IS NULL
        GROUP BY p.id, p.name
        ORDER BY p.name
      `,
      prisma.$queryRaw<GrowthRow[]>`
        SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS month,
               COUNT(*)::bigint AS new_tenants
        FROM organizations
        WHERE deleted_at IS NULL AND created_at >= date_trunc('month', ${since}::timestamptz)
        GROUP BY 1 ORDER BY 1
      `,
      Promise.all([
        prisma.serviceRequest.count({ where: { deletedAt: null } }),
        prisma.serviceRequest.count({ where: { deletedAt: null, closedAt: { not: null } } }),
        prisma.organization.count({ where: { deletedAt: null } }),
        prisma.pod.count({ where: { deletedAt: null } }),
      ]),
      prisma.serviceRequest.findMany({
        where: { deletedAt: null },
        select: { organizationId: true },
        distinct: ['organizationId'],
      }),
      prisma.organization.count({ where: { deletedAt: null, createdAt: { lt: since } } }),
    ]);

    const turnaround = turnaroundRows[0];
    const created = new Map(createdRows.map((row) => [row.bucket, Number(row.total)]));
    const closed = new Map(closedRows.map((row) => [row.bucket, Number(row.total)]));

    // A fixed eight-week axis, so the chart does not silently change shape when a
    // week happens to have no activity.
    const throughput: ThroughputBucket[] = [];

    for (let index = weekBuckets - 1; index >= 0; index -= 1) {
      const weekStart = new Date(now.getTime() - index * 7 * 86_400_000);
      const day = weekStart.getUTCDay();
      const monday = new Date(weekStart.getTime() - ((day + 6) % 7) * 86_400_000);
      const bucket = monday.toISOString().slice(0, 10);

      throughput.push({
        bucket,
        label: bucketLabel(bucket, false),
        created: created.get(bucket) ?? 0,
        closed: closed.get(bucket) ?? 0,
      });
    }

    const pods: PodEfficiencyRow[] = podRows.map((row) => {
      const onTime = Number(row.on_time);
      const late = Number(row.late);

      return {
        podId: row.id,
        podName: row.name,
        openRequests: Number(row.open_requests),
        closedRequests: Number(row.closed_requests),
        avgOpenAgeHours: round(row.avg_open_age_hours),
        onTime,
        late,
        onTimeRate: ratio(onTime, onTime + late),
      };
    });

    const growthByMonth = new Map(growthRows.map((row) => [row.month, Number(row.new_tenants)]));
    const tenantGrowth: TenantGrowthRow[] = [];
    let running = tenantsBeforeWindow;

    for (let index = monthBuckets - 1; index >= 0; index -= 1) {
      const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - index, 1));
      const month = `${date.getUTCFullYear()}-${`${date.getUTCMonth() + 1}`.padStart(2, '0')}`;
      const newTenants = growthByMonth.get(month) ?? 0;
      running += newTenants;

      tenantGrowth.push({
        month,
        label: bucketLabel(month, true),
        newTenants,
        cumulative: running,
      });
    }

    const [requestTotal, closedTotal, tenantTotal, podTotal] = totals;
    const onTime = Number(turnaround?.on_time ?? 0);
    const late = Number(turnaround?.late ?? 0);

    return {
      generatedAt: now.toISOString(),
      windowDays: input.windowDays,
      windowStart: since.toISOString(),
      totals: {
        requests: requestTotal,
        openRequests: requestTotal - closedTotal,
        closedRequests: closedTotal,
        tenants: tenantTotal,
        activeTenants: activeTenants.length,
        pods: podTotal,
      },
      turnaround: {
        sampled: Number(turnaround?.sampled ?? 0),
        avgHours: round(turnaround?.avg_hours ?? null),
        medianHours: round(turnaround?.median_hours ?? null),
        p90Hours: round(turnaround?.p90_hours ?? null),
        onTime,
        late,
        onTimeRate: ratio(onTime, onTime + late),
      },
      throughput,
      pods,
      tenantGrowth,
    };
  },
};
