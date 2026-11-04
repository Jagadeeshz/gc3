-- Auth & RBAC slice.
--
-- 1. StaffRole: GC3 internal roles (global, not tenant-attached).
-- 2. users.password_hash: scrypt digest; NULL means "invited, has not set a
--    password", which must never authenticate.
-- 3. users.platform_role: present only for staff.
-- 4. Timestamps -> timestamptz(3). Prisma's default emits `timestamp(3) without
--    time zone`, so audit rows silently lose their zone once the session time
--    zone is not UTC. Existing values are interpreted as UTC (the values were
--    written by a UTC session) and preserved.

-- 1. Enum
CREATE TYPE "StaffRole" AS ENUM (
  'PLATFORM_ADMIN',
  'OPERATIONS_MANAGER',
  'ACCOUNT_MANAGER',
  'POD_MANAGER',
  'SPECIALIST',
  'FINANCE_MANAGER'
);

-- 2 & 3. User auth columns
ALTER TABLE "users" ADD COLUMN "password_hash" TEXT;
ALTER TABLE "users" ADD COLUMN "platform_role" "StaffRole";

CREATE INDEX "users_platform_role_idx" ON "users" ("platform_role");

-- 4. Timestamps to timestamptz, preserving existing data as UTC
ALTER TABLE "organizations"
  ALTER COLUMN "created_at" SET DATA TYPE timestamptz(3) USING "created_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "updated_at" SET DATA TYPE timestamptz(3) USING "updated_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "deleted_at" SET DATA TYPE timestamptz(3) USING "deleted_at" AT TIME ZONE 'UTC';

ALTER TABLE "users"
  ALTER COLUMN "last_seen_at" SET DATA TYPE timestamptz(3) USING "last_seen_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "created_at" SET DATA TYPE timestamptz(3) USING "created_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "updated_at" SET DATA TYPE timestamptz(3) USING "updated_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "deleted_at" SET DATA TYPE timestamptz(3) USING "deleted_at" AT TIME ZONE 'UTC';

ALTER TABLE "memberships"
  ALTER COLUMN "created_at" SET DATA TYPE timestamptz(3) USING "created_at" AT TIME ZONE 'UTC',
  ALTER COLUMN "updated_at" SET DATA TYPE timestamptz(3) USING "updated_at" AT TIME ZONE 'UTC';

ALTER TABLE "audit_events"
  ALTER COLUMN "created_at" SET DATA TYPE timestamptz(3) USING "created_at" AT TIME ZONE 'UTC';
