import type { ServiceRequestStatus, SlaSweepReport } from '@gc3/types';
import { env } from '../config/env';
import { prisma } from '../db/client';
import { OPEN_STATUSES } from '../lib/request-status';
import { computeSlaState, isRiskyState } from '../lib/sla';
import { enqueueEvent } from '../notifications/events';

/**
 * SLA risk engine.
 *
 * One pass over open requests with a commitment, computing the state with the same
 * pure helper the dashboard uses. A request that is AT_RISK or BREACHED gets one
 * email per state — `sla_alerted_state` remembers the last one and is what makes a
 * repeated sweep silent. An escalation (AT_RISK → BREACHED) is a new state, so it
 * alerts again; a recovery back to ON_TRACK is not alerted at all.
 *
 * Nobody is invented as a recipient: the assignee is first choice, then the pod
 * lead. If neither exists the request is counted as skipped, because mailing an
 * unrelated administrator trains people to ignore these alerts.
 */
export async function runSlaSweep(
  options: { organizationId?: string; now?: Date } = {},
): Promise<SlaSweepReport> {
  const now = options.now ?? new Date();

  const rows = await prisma.serviceRequest.findMany({
    where: {
      deletedAt: null,
      status: { in: [...OPEN_STATUSES] },
      slaTargetAt: { not: null },
      ...(options.organizationId ? { organizationId: options.organizationId } : {}),
    },
    select: {
      id: true,
      organizationId: true,
      status: true,
      slaTargetAt: true,
      closedAt: true,
      createdAt: true,
      slaAlertedState: true,
      assigneeId: true,
      pod: { select: { leadId: true } },
    },
  });

  let atRisk = 0;
  let breached = 0;
  let alerted = 0;
  let skipped = 0;

  for (const row of rows) {
    const state = computeSlaState(
      {
        status: row.status as ServiceRequestStatus,
        targetAt: row.slaTargetAt,
        closedAt: row.closedAt,
        startAt: row.createdAt,
      },
      now,
    );

    if (!isRiskyState(state)) {
      continue;
    }

    if (state === 'AT_RISK') {
      atRisk += 1;
    } else {
      breached += 1;
    }

    if (row.slaAlertedState === state) {
      continue;
    }

    if (!row.assigneeId && !row.pod?.leadId) {
      skipped += 1;
      continue;
    }

    enqueueEvent({
      kind: 'sla_risk',
      organizationId: row.organizationId,
      requestId: row.id,
      state,
    });

    // Recorded before dispatch completes: the alert has been queued, and a second
    // sweep a minute later must not queue it again.
    await prisma.serviceRequest.update({
      where: { id: row.id },
      data: { slaAlertedState: state, slaAlertedAt: now },
    });

    alerted += 1;
  }

  return { scanned: rows.length, atRisk, breached, alerted, skipped };
}

/** Runs the sweep on an interval. Returns null when the timer is disabled. */
export function startSlaWorker(): NodeJS.Timeout | null {
  if (env.SLA_SWEEP_INTERVAL_SECONDS === 0) {
    return null;
  }

  const timer = setInterval(() => {
    void runSlaSweep().catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[gc3-api][sla] sweep failed: ${message}`);
    });
  }, env.SLA_SWEEP_INTERVAL_SECONDS * 1_000);

  timer.unref();
  return timer;
}
