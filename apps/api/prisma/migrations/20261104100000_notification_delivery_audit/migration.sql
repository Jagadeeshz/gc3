-- Notification delivery audit.
--
-- One row per delivery attempt, success, failure or skip. Kept separate from
-- audit_events: an audit event records a business action, this records what
-- happened when we tried to notify someone about it — including the failures
-- that usually vanish into logs.

CREATE TYPE "NotificationKind" AS ENUM ('INVITATION', 'RESENT');
CREATE TYPE "NotificationStatus" AS ENUM ('SENT', 'FAILED', 'SKIPPED');

CREATE TABLE "notification_deliveries" (
  "id"              UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "membership_id"   UUID NOT NULL,
  "user_id"         UUID NOT NULL,
  "kind"            "NotificationKind" NOT NULL,
  "channel"         VARCHAR(20) NOT NULL DEFAULT 'email',
  "driver"          VARCHAR(40) NOT NULL,
  "status"          "NotificationStatus" NOT NULL,
  "recipient"       VARCHAR(254) NOT NULL,
  "message_id"      VARCHAR(120),
  "error"           VARCHAR(500),
  "created_at"      timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "notification_deliveries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "notification_deliveries_organization_id_created_at_idx"
  ON "notification_deliveries" ("organization_id", "created_at");
CREATE INDEX "notification_deliveries_membership_id_idx"
  ON "notification_deliveries" ("membership_id");
CREATE INDEX "notification_deliveries_status_idx"
  ON "notification_deliveries" ("status");

ALTER TABLE "notification_deliveries"
  ADD CONSTRAINT "notification_deliveries_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notification_deliveries"
  ADD CONSTRAINT "notification_deliveries_membership_id_fkey"
  FOREIGN KEY ("membership_id") REFERENCES "memberships" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notification_deliveries"
  ADD CONSTRAINT "notification_deliveries_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users" ("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
