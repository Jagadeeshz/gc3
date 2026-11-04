-- Rename rather than drop/recreate: the column already holds data.
-- Prisma's schema diff proposed dropping "actorType" and adding "actor_type",
-- which would lose the existing audit rows. Preserve them.
ALTER TABLE "audit_events" RENAME COLUMN "actorType" TO "actor_type";
