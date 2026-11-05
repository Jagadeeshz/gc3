import type { AuditActorType, AuditLogEntry, AuditLogPage, Uuid } from '@gc3/types';
import { prisma } from '../db/client';

/**
 * The security audit log.
 *
 * Two jobs: write a row when something consequential changes, and read those rows
 * back for review. The table is append-only — nothing here updates or deletes.
 *
 * Every entry names an actor of some kind. `SYSTEM` is not a cop-out: it is the
 * honest answer for work the platform did on its own (provisioning a plan,
 * running a sweep), and being able to separate those from human actions is what
 * makes the log useful during an incident.
 */
export interface AuditInput {
  readonly organizationId?: string | null;
  readonly actorType?: AuditActorType;
  readonly actorId?: string | null;
  readonly action: string;
  readonly targetType: string;
  readonly targetId?: string | null;
  readonly metadata?: Record<string, unknown>;
  readonly ip?: string | null;
  readonly userAgent?: string | null;
  readonly requestId?: string | null;
}

/**
 * Actions a security review cares about.
 *
 * Exported as data rather than prose so it can be asserted in tests and quoted in
 * the README: if a sensitive operation is added and this list is not updated, the
 * omission is visible.
 */
export const SENSITIVE_AUDIT_ACTIONS: readonly string[] = [
  'organization.created',
  'organization.updated',
  'membership.invited',
  'membership.invite_resent',
  'membership.invite_revoked',
  'membership.invite_accepted',
  'membership.roles_changed',
  'membership.revoked',
  'subscription.tier_changed',
  'subscription.auto_provisioned',
  'invoice.issued',
  'invoice.paid',
  'invoice.void',
];

/** Trims a user agent so one exotic client cannot bloat the table. */
function clip(value: string | null | undefined, max: number): string | null {
  if (!value) {
    return null;
  }

  return value.length > max ? value.slice(0, max) : value;
}

/**
 * Records an audit row.
 *
 * Never throws: an audit failure must not roll back the business change that
 * already committed, but it must be loud in the logs, because a silent gap in an
 * audit trail is worse than a noisy one.
 */
export async function recordAudit(input: AuditInput): Promise<void> {
  try {
    await prisma.auditEvent.create({
      data: {
        organizationId: input.organizationId ?? null,
        actorType: input.actorType ?? (input.actorId ? 'USER' : 'SYSTEM'),
        actorId: input.actorId ?? null,
        action: input.action,
        targetType: input.targetType,
        targetId: input.targetId ?? null,
        metadata: (input.metadata ?? null) as never,
        ip: clip(input.ip, 64),
        userAgent: clip(input.userAgent, 300),
        requestId: clip(input.requestId, 64),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[gc3-api][audit] FAILED to record ${input.action}: ${message}`);
  }
}

interface AuditRow {
  id: string;
  organizationId: string | null;
  actorType: AuditActorType;
  actorId: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: unknown;
  ip: string | null;
  userAgent: string | null;
  requestId: string | null;
  createdAt: Date;
  organization: { name: string } | null;
  actor: { email: string } | null;
}

function toEntry(row: AuditRow): AuditLogEntry {
  return {
    id: row.id,
    organizationId: row.organizationId,
    organizationName: row.organization?.name ?? null,
    actorType: row.actorType,
    actorId: row.actorId,
    actorEmail: row.actor?.email ?? null,
    action: row.action,
    targetType: row.targetType ?? 'unknown',
    targetId: row.targetId,
    metadata: (row.metadata ?? null) as Record<string, unknown> | null,
    ip: row.ip,
    userAgent: row.userAgent,
    requestId: row.requestId,
    createdAt: row.createdAt.toISOString(),
  };
}

export const auditRepository = {
  /** Newest first, optionally narrowed by tenant, action, actor or time. */
  async list(input: {
    organizationId?: string | null;
    action?: string;
    actorId?: string;
    since?: Date;
    page: number;
    pageSize: number;
  }): Promise<AuditLogPage> {
    const where = {
      ...(input.organizationId ? { organizationId: input.organizationId } : {}),
      ...(input.action ? { action: input.action } : {}),
      ...(input.actorId ? { actorId: input.actorId } : {}),
      ...(input.since ? { createdAt: { gte: input.since } } : {}),
    };

    const [rows, total] = await Promise.all([
      prisma.auditEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
        include: {
          organization: { select: { name: true } },
          // actorId is a plain UUID column, not a relation, so the email is
          // resolved separately below rather than through an include.
        },
      }),
      prisma.auditEvent.count({ where }),
    ]);

    const actorIds = [...new Set(rows.map((row) => row.actorId).filter((id): id is string => !!id))];
    const actors = actorIds.length
      ? await prisma.user.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, email: true },
        })
      : [];

    const emailById = new Map(actors.map((actor) => [actor.id, actor.email]));

    return {
      items: rows.map((row) =>
        toEntry({
          ...row,
          actor: row.actorId ? { email: emailById.get(row.actorId) ?? 'unknown' } : null,
        } as AuditRow),
      ),
      total,
      page: input.page,
      pageSize: input.pageSize,
    };
  },

  /** Convenience for tests and support: every row for one target. */
  async forTarget(targetType: string, targetId: string): Promise<AuditLogEntry[]> {
    const rows = await prisma.auditEvent.findMany({
      where: { targetType, targetId },
      orderBy: { createdAt: 'desc' },
      include: { organization: { select: { name: true } } },
    });

    return rows.map((row) => toEntry({ ...row, actor: null } as AuditRow));
  },
};

export type { Uuid };
