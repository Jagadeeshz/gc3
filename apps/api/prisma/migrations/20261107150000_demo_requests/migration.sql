-- Inbound "Book a demo" submissions.
--
-- Tenant-less by design: the submitter has no account yet. organizationId is null
-- until someone converts the request into a tenant, at which point it is set.

CREATE TABLE "demo_requests" (
    "id"              UUID NOT NULL,
    "organization_id" UUID,
    "email"           VARCHAR(254) NOT NULL,
    "full_name"       VARCHAR(120) NOT NULL,
    "company_name"    VARCHAR(160) NOT NULL,
    "company_size"    VARCHAR(40) NOT NULL,
    "message"         VARCHAR(1000),
    "source"          VARCHAR(40) NOT NULL DEFAULT 'website',
    "ip_hash"         VARCHAR(64),
    "created_at"      TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "demo_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "demo_requests_created_at_idx" ON "demo_requests"("created_at");
CREATE INDEX "demo_requests_email_idx" ON "demo_requests"("email");

ALTER TABLE "demo_requests"
  ADD CONSTRAINT "demo_requests_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
