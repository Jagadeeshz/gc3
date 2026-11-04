-- Notification retry/backoff.
--
-- A failed delivery used to be a dead end: the row recorded the failure and
-- nothing acted on it. The row is still one-per-attempt, but a failure can now
-- carry a schedule:
--
--   * `attempt`          — 1 for the original send, incrementing per retry
--   * `next_attempt_at`  — set while the chain is still live and due later;
--                          cleared when the attempt runs or the chain ends
--   * `last_attempt_at`  — when this particular attempt ran
--
-- Existing rows default to attempt 1 with no schedule, so they are inert: a
-- deployment of this migration will not suddenly re-send historical failures.

ALTER TABLE "notification_deliveries"
  ADD COLUMN "attempt" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "next_attempt_at" timestamptz(3),
  ADD COLUMN "last_attempt_at" timestamptz(3);

CREATE INDEX "notification_deliveries_status_next_attempt_at_idx"
  ON "notification_deliveries" ("status", "next_attempt_at");
