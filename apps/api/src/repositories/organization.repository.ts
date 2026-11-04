import type { Organization, OrganizationStatus } from '@gc3/types';
import type { CreateOrganizationInput } from '@gc3/validation';
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
