-- Phase 5 · audit context
--
-- An audit row that cannot say where a change came from is only half a record.
-- These three nullable columns carry the request that produced it: source IP,
-- user agent and the correlation id the API already returns to the caller.
--
-- Nullable on purpose: rows written by the platform itself (auto-provisioning,
-- sweeps) have no request behind them, and historical rows predate the columns.

ALTER TABLE "audit_events" ADD COLUMN "ip" VARCHAR(64);
ALTER TABLE "audit_events" ADD COLUMN "user_agent" VARCHAR(300);
ALTER TABLE "audit_events" ADD COLUMN "request_id" VARCHAR(64);

-- Security review reads the log newest-first across the whole platform.
CREATE INDEX "audit_events_created_at_idx" ON "audit_events" ("created_at" DESC);
