-- Phase 4 — finance: subscription tiers, tenant subscriptions, invoices, line
-- items and usage meters.
--
-- Money is integer minor units everywhere (no float, no numeric-string parsing).
-- SubscriptionTier is the one global table in the schema: it is the platform's
-- price list, identical for every tenant, so it carries no organization_id.
-- Everything else is tenant-owned and cascades with its organization.

CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELLED');
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PAID', 'OVERDUE', 'VOID');
CREATE TYPE "InvoiceLineItemKind" AS ENUM ('TIER_FEE', 'USAGE', 'ADJUSTMENT');
CREATE TYPE "UsageMeterKey" AS ENUM ('REQUESTS', 'STORAGE_KB', 'API_CALLS');

CREATE TABLE "subscription_tiers" (
  "id"                            UUID NOT NULL,
  "code"                          VARCHAR(40) NOT NULL,
  "name"                          VARCHAR(80) NOT NULL,
  "description"                   VARCHAR(500),
  "monthly_price_cents"           INTEGER NOT NULL,
  "currency"                      VARCHAR(3) NOT NULL DEFAULT 'INR',
  "requests_included"             INTEGER NOT NULL DEFAULT 0,
  "storage_mb_included"           INTEGER NOT NULL DEFAULT 0,
  "api_calls_included"            INTEGER NOT NULL DEFAULT 0,
  "seats_included"                INTEGER NOT NULL DEFAULT 0,
  "request_overage_cents"         INTEGER NOT NULL DEFAULT 0,
  "storage_mb_overage_cents"      INTEGER NOT NULL DEFAULT 0,
  "api_calls_overage_cents_per_1k" INTEGER NOT NULL DEFAULT 0,
  "is_active"                     BOOLEAN NOT NULL DEFAULT true,
  "sort_order"                    INTEGER NOT NULL DEFAULT 0,
  "created_at"                    timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"                    timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "subscription_tiers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "subscription_tiers_code_key" ON "subscription_tiers" ("code");
CREATE INDEX "subscription_tiers_is_active_sort_order_idx" ON "subscription_tiers" ("is_active", "sort_order");

CREATE TABLE "organization_subscriptions" (
  "id"                   UUID NOT NULL,
  "organization_id"      UUID NOT NULL,
  "tier_id"              UUID NOT NULL,
  "status"               "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
  "current_period_start" timestamptz(3) NOT NULL,
  "current_period_end"   timestamptz(3) NOT NULL,
  "started_at"           timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "cancelled_at"         timestamptz(3),
  "created_at"           timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"           timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "organization_subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "organization_subscriptions_organization_id_key" ON "organization_subscriptions" ("organization_id");
CREATE INDEX "organization_subscriptions_tier_id_idx" ON "organization_subscriptions" ("tier_id");

ALTER TABLE "organization_subscriptions"
  ADD CONSTRAINT "organization_subscriptions_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "organization_subscriptions"
  ADD CONSTRAINT "organization_subscriptions_tier_id_fkey"
  FOREIGN KEY ("tier_id") REFERENCES "subscription_tiers" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "invoices" (
  "id"               UUID NOT NULL,
  "organization_id"  UUID NOT NULL,
  "number"           VARCHAR(40) NOT NULL,
  "status"           "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
  "period_start"     timestamptz(3) NOT NULL,
  "period_end"       timestamptz(3) NOT NULL,
  "currency"         VARCHAR(3) NOT NULL DEFAULT 'INR',
  "subtotal_cents"   INTEGER NOT NULL,
  "tax_cents"        INTEGER NOT NULL DEFAULT 0,
  "total_cents"      INTEGER NOT NULL,
  "notes"            VARCHAR(500),
  "issued_at"        timestamptz(3),
  "due_at"           timestamptz(3),
  "paid_at"          timestamptz(3),
  "paid_by_user_id"  UUID,
  "voided_at"        timestamptz(3),
  "created_by_id"    UUID,
  "created_at"       timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"       timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "invoices_organization_id_number_key" ON "invoices" ("organization_id", "number");
CREATE INDEX "invoices_organization_id_status_idx" ON "invoices" ("organization_id", "status");
CREATE INDEX "invoices_status_due_at_idx" ON "invoices" ("status", "due_at");

ALTER TABLE "invoices"
  ADD CONSTRAINT "invoices_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "invoices"
  ADD CONSTRAINT "invoices_paid_by_user_id_fkey"
  FOREIGN KEY ("paid_by_user_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "invoices"
  ADD CONSTRAINT "invoices_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "invoice_line_items" (
  "id"                UUID NOT NULL,
  "organization_id"   UUID NOT NULL,
  "invoice_id"        UUID NOT NULL,
  "kind"              "InvoiceLineItemKind" NOT NULL,
  "description"       VARCHAR(200) NOT NULL,
  "quantity"          INTEGER NOT NULL,
  "unit_amount_cents" INTEGER NOT NULL,
  "amount_cents"      INTEGER NOT NULL,
  "meter_key"         VARCHAR(20),
  "created_at"        timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "invoice_line_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "invoice_line_items_invoice_id_idx" ON "invoice_line_items" ("invoice_id");

ALTER TABLE "invoice_line_items"
  ADD CONSTRAINT "invoice_line_items_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "invoice_line_items"
  ADD CONSTRAINT "invoice_line_items_invoice_id_fkey"
  FOREIGN KEY ("invoice_id") REFERENCES "invoices" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "usage_meters" (
  "id"              UUID NOT NULL,
  "organization_id" UUID NOT NULL,
  "key"             "UsageMeterKey" NOT NULL,
  "period"          VARCHAR(7) NOT NULL,
  "quantity"        INTEGER NOT NULL DEFAULT 0,
  "created_at"      timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"      timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "usage_meters_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "usage_meters_organization_id_key_period_key" ON "usage_meters" ("organization_id", "key", "period");
CREATE INDEX "usage_meters_organization_id_period_idx" ON "usage_meters" ("organization_id", "period");

ALTER TABLE "usage_meters"
  ADD CONSTRAINT "usage_meters_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
