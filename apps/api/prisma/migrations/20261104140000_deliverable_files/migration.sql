-- Stored deliverable files with checksums.
--
-- Until now a deliverable's "file" was a URL we never fetched, so a released
-- asset could be swapped behind that URL and no part of this system would know.
-- Uploaded bytes are now stored by the API, and the digest recorded at upload
-- time is what makes "this is the file that was approved" verifiable.
--
-- Both the deliverable (current content) and each version row carry the storage
-- key, digest, size and MIME type. All nullable: existing rows keep working as
-- URL-only deliverables.

ALTER TABLE "deliverables"
  ADD COLUMN "file_key" VARCHAR(300),
  ADD COLUMN "file_sha256" VARCHAR(64),
  ADD COLUMN "file_size" INTEGER,
  ADD COLUMN "file_mime_type" VARCHAR(120);

ALTER TABLE "deliverable_versions"
  ADD COLUMN "file_key" VARCHAR(300),
  ADD COLUMN "file_sha256" VARCHAR(64),
  ADD COLUMN "file_size" INTEGER,
  ADD COLUMN "file_mime_type" VARCHAR(120);

CREATE INDEX "deliverables_file_sha256_idx" ON "deliverables" ("file_sha256");
