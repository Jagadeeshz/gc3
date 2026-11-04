-- Event notifications.
--
-- Two new kinds — DELIVERABLE_RELEASED and REQUEST_STATUS_UPDATED — go to a
-- *person* about a *thing*, not to a membership row. So:
--
--   * membership_id becomes nullable (an event recipient may be a staff user who
--     holds no membership)
--   * subject_request_id / subject_deliverable_id record what the email was about
--
-- That reference is the whole reason an event email is retryable: unlike an
-- invitation, whose token cannot be replayed from a hash, an event body can be
-- rebuilt from the row it points at.

ALTER TABLE "notification_deliveries"
  ALTER COLUMN "membership_id" DROP NOT NULL;

ALTER TABLE "notification_deliveries"
  ADD COLUMN "subject_request_id" UUID,
  ADD COLUMN "subject_deliverable_id" UUID;

ALTER TABLE "notification_deliveries"
  ADD CONSTRAINT "notification_deliveries_subject_request_id_fkey"
  FOREIGN KEY ("subject_request_id") REFERENCES "service_requests" ("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "notification_deliveries"
  ADD CONSTRAINT "notification_deliveries_subject_deliverable_id_fkey"
  FOREIGN KEY ("subject_deliverable_id") REFERENCES "deliverables" ("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "notification_deliveries_user_id_idx"
  ON "notification_deliveries" ("user_id");

-- PostgreSQL 12+ allows ADD VALUE inside a transaction as long as the new value is
-- not used in that same transaction, which is the case here.
ALTER TYPE "NotificationKind" ADD VALUE IF NOT EXISTS 'DELIVERABLE_RELEASED';
ALTER TYPE "NotificationKind" ADD VALUE IF NOT EXISTS 'REQUEST_STATUS_UPDATED';
