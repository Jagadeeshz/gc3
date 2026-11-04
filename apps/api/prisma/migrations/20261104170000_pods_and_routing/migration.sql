-- Pods and request routing.
--
-- A pod is the standing team inside one tenant that owns execution. Requests gain
-- an optional pod assignment alongside the existing per-person assignee, so the
-- platform can route work at team granularity ("this goes to the Cloud pod") and
-- still name a human owner when one is known.
--
-- Both are tenant-owned: `pods.organization_id` is required, and the API refuses to
-- attach a request to a pod from another organization.

CREATE TABLE "pods" (
  "id"              UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "name"            VARCHAR(120) NOT NULL,
  "slug"            VARCHAR(60) NOT NULL,
  "description"     VARCHAR(500),
  "lead_id"         UUID,
  "is_active"       BOOLEAN NOT NULL DEFAULT true,
  "created_at"      timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at"      timestamptz(3),

  CONSTRAINT "pods_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pods_organization_id_slug_key" ON "pods" ("organization_id", "slug");
CREATE INDEX "pods_organization_id_is_active_idx" ON "pods" ("organization_id", "is_active");

ALTER TABLE "pods"
  ADD CONSTRAINT "pods_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "pods"
  ADD CONSTRAINT "pods_lead_id_fkey"
  FOREIGN KEY ("lead_id") REFERENCES "users" ("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "pod_members" (
  "id"              UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "pod_id"          UUID NOT NULL,
  "user_id"         UUID NOT NULL,
  "created_at"      timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "pod_members_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "pod_members_pod_id_user_id_key" ON "pod_members" ("pod_id", "user_id");
CREATE INDEX "pod_members_organization_id_idx" ON "pod_members" ("organization_id");

ALTER TABLE "pod_members"
  ADD CONSTRAINT "pod_members_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "pod_members"
  ADD CONSTRAINT "pod_members_pod_id_fkey"
  FOREIGN KEY ("pod_id") REFERENCES "pods" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "pod_members"
  ADD CONSTRAINT "pod_members_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "service_requests"
  ADD COLUMN "pod_id" UUID;

ALTER TABLE "service_requests"
  ADD CONSTRAINT "service_requests_pod_id_fkey"
  FOREIGN KEY ("pod_id") REFERENCES "pods" ("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "service_requests_pod_id_idx" ON "service_requests" ("pod_id");
