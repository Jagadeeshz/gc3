-- Internal task breakdown: how a pod carves a request into work items.
--
-- Tasks are tenant-owned and hang off a service request. They are staff-only by
-- design — nothing here is ever serialised for a client — and they cascade with
-- the request they belong to, since a task without its request has no meaning.
--
-- pod_id and assignee_id are SET NULL on delete: losing the pod or the person
-- must not erase the work item, only its owner.

CREATE TYPE "TaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE', 'CANCELLED');

CREATE TABLE "tasks" (
  "id"              UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "request_id"      UUID NOT NULL,
  "pod_id"          UUID,
  "assignee_id"     UUID,
  "created_by_id"   UUID,
  "title"           VARCHAR(200) NOT NULL,
  "description"     VARCHAR(2000),
  "status"          "TaskStatus" NOT NULL DEFAULT 'TODO',
  "due_at"          timestamptz(3),
  "created_at"      timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at"      timestamptz(3),

  CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "tasks_organization_id_request_id_idx" ON "tasks" ("organization_id", "request_id");
CREATE INDEX "tasks_organization_id_assignee_id_idx" ON "tasks" ("organization_id", "assignee_id");
CREATE INDEX "tasks_pod_id_idx" ON "tasks" ("pod_id");

ALTER TABLE "tasks"
  ADD CONSTRAINT "tasks_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tasks"
  ADD CONSTRAINT "tasks_request_id_fkey"
  FOREIGN KEY ("request_id") REFERENCES "service_requests" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tasks"
  ADD CONSTRAINT "tasks_pod_id_fkey"
  FOREIGN KEY ("pod_id") REFERENCES "pods" ("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "tasks"
  ADD CONSTRAINT "tasks_assignee_id_fkey"
  FOREIGN KEY ("assignee_id") REFERENCES "users" ("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "tasks"
  ADD CONSTRAINT "tasks_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users" ("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
