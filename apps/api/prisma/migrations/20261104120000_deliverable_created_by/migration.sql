-- Deliverable authorship.
--
-- `approved_by_id` answers "who signed this off" but nothing answered "who
-- produced it". A deliverable is staff output, and a client-facing audit trail
-- without an author is not an audit trail. Nullable so existing rows are
-- unaffected, and ON DELETE SET NULL so removing a user never destroys delivery
-- history.

ALTER TABLE "deliverables"
  ADD COLUMN "created_by_id" UUID;

ALTER TABLE "deliverables"
  ADD CONSTRAINT "deliverables_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users" ("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "deliverables_created_by_id_idx" ON "deliverables" ("created_by_id");
