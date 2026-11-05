import type { Organization, OrganizationStatus } from '@gc3/types';
import type { CreateOrganizationInput } from '@gc3/validation';
import { recordAudit } from '../audit/audit-log';
import { prisma } from '../db/client';

/** Row shape returned by Prisma (Date objects) → API contract (ISO strings). */
type OrganizationRow = {
  id: string;
  name: string;
  slug: string;
  status: OrganizationStatus;
  timezone: string;
  region: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

function toEntity(row: OrganizationRow): Organization {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: row.status,
    timezone: row.timezone,
    region: row.region,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
  };
}

export const organizationRepository = {
  async create(input: CreateOrganizationInput, actorId?: string): Promise<Organization> {
    const row = await prisma.organization.create({
      data: {
        name: input.name,
        slug: input.slug,
        timezone: input.timezone,
        region: input.region,
      },
    });

    await prisma.auditEvent.create({
      data: {
        organizationId: row.id,
        // Attribute the event to the authenticated creator when there is one.
        actorType: actorId ? 'USER' : 'SYSTEM',
        actorId: actorId ?? null,
        action: 'organization.created',
        targetType: 'organization',
        targetId: row.id,
      },
    });

    return toEntity(row);
  },

  /**
   * Edits a tenant's own record.
   *
   * Tenant edits are a sensitive operation: a renamed or re-slugged tenant changes
   * what clients see and what URLs resolve. The row is written first, then the
   * audit entry records exactly which fields changed and what they were before —
   * an audit row saying only "updated" would be useless a month later.
   */
  async updateScoped(
    scope: string,
    id: string,
    input: { name?: string; slug?: string; timezone?: string; region?: string },
    actor: { userId: string; ip?: string | null; userAgent?: string | null; requestId?: string | null },
  ): Promise<Organization | null> {
    const current = await prisma.organization.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, name: true, slug: true, timezone: true, region: true },
    });

    if (!current || current.id !== scope) {
      return null;
    }

    const changed = Object.entries(input).filter(([key, value]) => {
      const before = (current as unknown as Record<string, unknown>)[key];
      return value !== undefined && value !== before;
    });

    if (changed.length === 0) {
      // Nothing to write and nothing to log: an audit trail full of no-op edits is
      // noise that hides the real ones.
      return this.findByIdScoped(scope, id);
    }

    const row = await prisma.organization.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.slug !== undefined ? { slug: input.slug } : {}),
        ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
        ...(input.region !== undefined ? { region: input.region } : {}),
      },
    });

    await recordAudit({
      organizationId: id,
      actorType: 'USER',
      actorId: actor.userId,
      action: 'organization.updated',
      targetType: 'organization',
      targetId: id,
      metadata: {
        fields: changed.map(([key]) => key),
        before: Object.fromEntries(
          changed.map(([key]) => [key, (current as unknown as Record<string, unknown>)[key] ?? null]),
        ),
        after: Object.fromEntries(changed.map(([key, value]) => [key, value])),
      },
      ip: actor.ip ?? null,
      userAgent: actor.userAgent ?? null,
      requestId: actor.requestId ?? null,
    });

    return toEntity(row);
  },

  /**
   * Every live tenant. Platform-scoped by nature: only staff call this, and only
   * to populate an organization picker — it is not a tenant read.
   */
  async listAll(limit = 100): Promise<Organization[]> {
    const rows = await prisma.organization.findMany({
      where: { deletedAt: null },
      orderBy: { name: 'asc' },
      take: limit,
    });

    return rows.map(toEntity);
  },

  /**
   * Tenant-scoped read. When the requested id is not the caller's tenant scope
   * the repository returns null before touching the database, so a foreign id
   * is indistinguishable from a missing one — no existence leak across tenants.
   */
  async findByIdScoped(scope: string, id: string): Promise<Organization | null> {
    if (id !== scope) {
      return null;
    }

    const row = await prisma.organization.findFirst({
      where: { id, deletedAt: null },
    });

    return row ? toEntity(row) : null;
  },
};
