-- Two staff roles the operations dashboards need but the platform never had.
--
-- SALES_MANAGER — owns the commercial relationship (onboarding, renewals,
-- proposals). Distinct from ACCOUNT_MANAGER, which exists but carries delivery
-- duties; a sales desk should not be able to move workflow state.
--
-- MANAGEMENT — the executive seat: read across revenue and delivery, write
-- nothing. It is deliberately incapable of acting, so a report can be trusted as
-- a report.
--
-- ALTER TYPE ... ADD VALUE cannot be combined with use of the new value in the
-- same transaction, so this migration does only that and nothing else.

ALTER TYPE "StaffRole" ADD VALUE IF NOT EXISTS 'SALES_MANAGER';
ALTER TYPE "StaffRole" ADD VALUE IF NOT EXISTS 'MANAGEMENT';
