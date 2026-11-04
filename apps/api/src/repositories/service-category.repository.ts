import type { ServiceCategory } from '@gc3/types';
import { prisma } from '../db/client';

type CategoryRow = {
  id: string;
  organizationId: string;
  name: string;
  slug: string;
  description: string | null;
  isActive: boolean;
  slaDeliveryHours: number | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

function toEntity(row: CategoryRow): ServiceCategory {
  return {
    id: row.id,
    organizationId: row.organizationId,
    name: row.name,
    slug: row.slug,
    description: row.description,
    isActive: row.isActive,
    slaDeliveryHours: row.slaDeliveryHours,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    deletedAt: row.deletedAt ? row.deletedAt.toISOString() : null,
  };
}

/**
 * Service categories are tenant-owned in this model: each organization gets its
 * own catalogue. The platform-wide default catalogue described in §6.2 will be a
 * seeding concern layered on top, not a set of global rows that tenant queries
 * would have to special-case.
 */
export const serviceCategoryRepository = {
  async createScoped(
    organizationId: string,
    input: { name: string; slug: string; description?: string; slaDeliveryHours?: number | null },
  ): Promise<ServiceCategory> {
    const row = await prisma.serviceCategory.create({
      data: {
        organizationId,
        name: input.name,
        slug: input.slug,
        description: input.description ?? null,
        slaDeliveryHours: input.slaDeliveryHours ?? null,
      },
    });

    return toEntity(row);
  },

  async findByIdScoped(organizationId: string, id: string): Promise<ServiceCategory | null> {
    const row = await prisma.serviceCategory.findFirst({
      where: { id, organizationId, deletedAt: null },
    });

    return row ? toEntity(row) : null;
  },

  async listScoped(
    organizationId: string,
    options: { includeInactive?: boolean } = {},
  ): Promise<ServiceCategory[]> {
    const rows = await prisma.serviceCategory.findMany({
      where: {
        organizationId,
        deletedAt: null,
        ...(options.includeInactive ? {} : { isActive: true }),
      },
      orderBy: { name: 'asc' },
    });

    return rows.map(toEntity);
  },

  /** Soft delete keeps historical requests pointing at a real row. */
  async softDeleteScoped(organizationId: string, id: string): Promise<boolean> {
    const result = await prisma.serviceCategory.updateMany({
      where: { id, organizationId, deletedAt: null },
      data: { deletedAt: new Date(), isActive: false },
    });

    return result.count === 1;
  },

  /**
   * Tenant-guarded field update. Returns null when the id is not this tenant's,
   * deleted, or missing — the caller turns all three into the same 404.
   */
  async updateScoped(
    organizationId: string,
    id: string,
    input: {
      name?: string;
      slug?: string;
      description?: string | null;
      isActive?: boolean;
      slaDeliveryHours?: number | null;
    },
  ): Promise<ServiceCategory | null> {
    const result = await prisma.serviceCategory.updateMany({
      where: { id, organizationId, deletedAt: null },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.slug !== undefined ? { slug: input.slug } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(input.slaDeliveryHours !== undefined
          ? { slaDeliveryHours: input.slaDeliveryHours }
          : {}),
      },
    });

    if (result.count !== 1) {
      return null;
    }

    const row = await prisma.serviceCategory.findFirst({ where: { id, organizationId } });
    return row ? toEntity(row) : null;
  },
};
