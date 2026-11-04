-- Invite acceptance.
--
-- A membership in INVITED status now carries a one-time acceptance token:
--   * only the SHA-256 hash is stored (a DB leak yields no working invite)
--   * the token expires (INVITE_TTL_HOURS, default 168h / 7 days)
--   * the hash is cleared and invite_accepted_at stamped on first use, so the
--     token is single-use even under concurrent requests
--
-- All three columns are nullable, so existing rows are unaffected.

ALTER TABLE "memberships"
  ADD COLUMN "invite_token_hash" VARCHAR(64),
  ADD COLUMN "invite_token_expires_at" timestamptz(3),
  ADD COLUMN "invite_accepted_at" timestamptz(3);

CREATE UNIQUE INDEX "memberships_invite_token_hash_key"
  ON "memberships" ("invite_token_hash");
