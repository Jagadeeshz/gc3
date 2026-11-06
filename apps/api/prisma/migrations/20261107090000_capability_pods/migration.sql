-- Official Quantocos commercial catalogue: capability pods.
--
-- This is a price list, not a billing mechanism. The billing tables
-- (subscription_tiers, usage_meters, invoices) keep metering requests, storage and
-- API calls; pods are sold on credit pools, team composition and stacking, and the
-- platform does not yet hold a credit ledger. Two models, one catalogue:
--
--   capability_pods  → what we sell, in the currency we sell it in
--   subscription_tiers → what the platform currently bills a tenant against
--
-- Keeping them apart is deliberate. Encoding USD credit plans into the paise-based
-- billing rows would have made every invoice ambiguous about which currency it was.

CREATE TABLE "capability_pods" (
    "id"                 UUID NOT NULL,
    "code"               VARCHAR(40) NOT NULL,
    "name"               VARCHAR(80) NOT NULL,
    "tagline"            VARCHAR(200),
    "description"        VARCHAR(800),
    "monthly_price_cents" INTEGER NOT NULL DEFAULT 0,
    "credit_rate_cents"  INTEGER NOT NULL DEFAULT 0,
    "currency"           VARCHAR(3) NOT NULL DEFAULT 'USD',
    "credits_included"   INTEGER NOT NULL DEFAULT 0,
    "hours_included"     INTEGER NOT NULL DEFAULT 0,
    "peak_hours_included" INTEGER NOT NULL DEFAULT 0,
    "managers"           INTEGER NOT NULL DEFAULT 0,
    "specialists"        INTEGER NOT NULL DEFAULT 0,
    "agents"             INTEGER NOT NULL DEFAULT 0,
    "team_summary"       VARCHAR(200),
    "includes_codes"     TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "perks"              TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    "min_term_months"    INTEGER NOT NULL DEFAULT 0,
    "is_custom_priced"   BOOLEAN NOT NULL DEFAULT FALSE,
    "is_active"          BOOLEAN NOT NULL DEFAULT TRUE,
    "sort_order"         INTEGER NOT NULL DEFAULT 0,
    "created_at"         TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"         TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "capability_pods_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "capability_pods_code_key" ON "capability_pods"("code");
CREATE INDEX "capability_pods_is_active_sort_order_idx" ON "capability_pods"("is_active", "sort_order");
