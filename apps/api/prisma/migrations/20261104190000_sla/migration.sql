-- Internal SLA tracking.
--
-- The commitment is service-specific (Brief §"SLA | Service-specific response and
-- delivery commitments"), so a category may carry its own delivery hours; when it
-- does not, the priority default from lib/sla.ts applies.
--
-- `sla_target_at` is materialised rather than computed on read: the commitment is a
-- fact about the request that should not silently move because a policy constant
-- changed. `sla_alerted_state` records the last state an alert was sent for, which
-- is what makes the sweep idempotent and still allows an escalation from AT_RISK to
-- BREACHED.

ALTER TABLE "service_categories"
  ADD COLUMN "sla_delivery_hours" INTEGER;

ALTER TABLE "service_requests"
  ADD COLUMN "sla_target_at" timestamptz(3),
  ADD COLUMN "sla_alerted_state" VARCHAR(20),
  ADD COLUMN "sla_alerted_at" timestamptz(3);

-- Existing requests get the priority default measured from creation, so the SLA
-- view has something to show for history rather than only for new work.
UPDATE "service_requests"
SET "sla_target_at" = "created_at" + CASE "priority"
  WHEN 'URGENT' THEN INTERVAL '8 hours'
  WHEN 'HIGH' THEN INTERVAL '24 hours'
  WHEN 'NORMAL' THEN INTERVAL '72 hours'
  ELSE INTERVAL '168 hours'
END
WHERE "sla_target_at" IS NULL;

CREATE INDEX "service_requests_sla_target_at_idx" ON "service_requests" ("sla_target_at");

ALTER TYPE "NotificationKind" ADD VALUE IF NOT EXISTS 'SLA_RISK';
