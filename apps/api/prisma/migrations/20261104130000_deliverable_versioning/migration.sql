-- Deliverable versioning.
--
-- A deliverable used to be immutable: created once, then approved and released.
-- That breaks the moment someone has to correct a file after sign-off, because
-- silently swapping released content would invalidate the human approval the
-- Brief requires (§8.3).
--
-- So: the deliverable row keeps the *current* snapshot plus a version counter,
-- and every version — including v1 — is appended to `deliverable_versions`.
-- Replacing content on an APPROVED or RELEASED deliverable resets it to PENDING
-- and clears the approval, so "released" always means "a human approved exactly
-- this content".

ALTER TABLE "deliverables"
  ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE "deliverable_versions" (
  "id"              UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "deliverable_id"  UUID NOT NULL,
  "version"         INTEGER NOT NULL,
  "title"           VARCHAR(200) NOT NULL,
  "description"     VARCHAR(1000),
  "file_url"        VARCHAR(500),
  "created_by_id"   UUID,
  "change_note"     VARCHAR(500),
  "created_at"      timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "deliverable_versions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "deliverable_versions_deliverable_id_version_key"
  ON "deliverable_versions" ("deliverable_id", "version");

CREATE INDEX "deliverable_versions_organization_id_created_at_idx"
  ON "deliverable_versions" ("organization_id", "created_at");

ALTER TABLE "deliverable_versions"
  ADD CONSTRAINT "deliverable_versions_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "deliverable_versions"
  ADD CONSTRAINT "deliverable_versions_deliverable_id_fkey"
  FOREIGN KEY ("deliverable_id") REFERENCES "deliverables" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "deliverable_versions"
  ADD CONSTRAINT "deliverable_versions_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users" ("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: every existing deliverable becomes version 1 of itself, so history is
-- complete from the first row rather than starting empty.
INSERT INTO "deliverable_versions" (
  "id",
  "organization_id",
  "deliverable_id",
  "version",
  "title",
  "description",
  "file_url",
  "created_by_id",
  "change_note",
  "created_at"
)
SELECT
  gen_random_uuid(),
  d."organization_id",
  d."id",
  1,
  d."title",
  d."description",
  d."file_url",
  d."created_by_id",
  'Initial version',
  d."created_at"
FROM "deliverables" AS d;
