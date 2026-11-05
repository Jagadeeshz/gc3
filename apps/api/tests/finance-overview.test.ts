import { describe, expect, it } from 'vitest';
import {
  API,
  authGet,
  authPatch,
  authPost,
  createMember,
  createOrganization,
  createStaff,
} from './helpers/api';
import { periodFor } from '../src/lib/period';

/**
 * The platform money view (`GET /ops/billing`).
 *
 * MRR is derived from active subscriptions, so these tests move a tenant between
 * plans and assert the number follows — rather than trusting a snapshot.
 */
describe('GET /ops/billing', () => {
  it('reports MRR from active subscriptions and the tier mix behind it', async () => {
    const admin = await createStaff('PLATFORM_ADMIN');
    const before = await authGet(`${API}/ops/billing`, admin.token).expect(200);

    const organization = await createOrganization({ name: 'Revenue Co' });
    await authGet(`${API}/subscription`, admin.token, organization.id).expect(200); // provisions STARTER

    const starter = await authGet(`${API}/ops/billing`, admin.token).expect(200);
    const starterRow = (starter.body.data.tenants as { id: string; tierCode: string; mrrCents: number }[])
      .find((tenant) => tenant.id === organization.id);

    expect(starterRow?.tierCode).toBe('STARTER');
    expect(starterRow?.mrrCents).toBe(2_500_000);
    expect(starter.body.data.mrrCents).toBe(before.body.data.mrrCents + 2_500_000);

    // An upgrade moves the recurring revenue with it.
    await authPatch(
      `${API}/subscription`,
      admin.token,
      { tierCode: 'ENTERPRISE' },
      organization.id,
    ).expect(200);

    const enterprise = await authGet(`${API}/ops/billing`, admin.token).expect(200);
    expect(enterprise.body.data.mrrCents).toBe(before.body.data.mrrCents + 25_000_000);

    const enterpriseRow = (enterprise.body.data.tenants as { id: string; mrrCents: number }[]).find(
      (tenant) => tenant.id === organization.id,
    );
    expect(enterpriseRow?.mrrCents).toBe(25_000_000);
  });

  it('counts invoices by status and separates billed from settled money', async () => {
    const admin = await createStaff('PLATFORM_ADMIN');
    const organization = await createOrganization({ name: 'Settlement Co' });
    const period = periodFor().key;

    const created = await authPost(
      `${API}/invoices/generate`,
      admin.token,
      { period },
      organization.id,
    ).expect(201);

    const invoiceId = created.body.data.id as string;
    const total = created.body.data.totalCents as number;

    const drafted = await authGet(`${API}/ops/billing`, admin.token).expect(200);
    expect(drafted.body.data.invoices.draft).toBeGreaterThanOrEqual(1);

    await authPatch(`${API}/invoices/${invoiceId}/status`, admin.token, { status: 'ISSUED' }, organization.id)
      .expect(200);

    const issued = await authGet(`${API}/ops/billing`, admin.token).expect(200);
    expect(issued.body.data.invoices.outstandingCents).toBeGreaterThanOrEqual(total);

    await authPatch(`${API}/invoices/${invoiceId}/status`, admin.token, { status: 'PAID' }, organization.id)
      .expect(200);

    const paid = await authGet(`${API}/ops/billing`, admin.token).expect(200);
    expect(paid.body.data.invoices.paidCents).toBeGreaterThanOrEqual(total);
    // Settling moves money out of outstanding, not just into paid.
    expect(paid.body.data.invoices.outstandingCents).toBeLessThan(
      issued.body.data.invoices.outstandingCents,
    );
  });

  it('lists tenants with their plan and this period\u2019s usage', async () => {
    const admin = await createStaff('PLATFORM_ADMIN');
    const organization = await createOrganization({ name: 'Usage Ledger Co' });

    await authPost(
      `${API}/service-requests`,
      admin.token,
      { title: 'Metered', description: 'Counts against the tenant ledger' },
      organization.id,
    ).expect(201);

    const overview = await authGet(`${API}/ops/billing`, admin.token).expect(200);
    const row = (
      overview.body.data.tenants as {
        id: string;
        tierCode: string | null;
        status: string | null;
        requestsThisPeriod: number;
      }[]
    ).find((tenant) => tenant.id === organization.id);

    expect(row).toBeDefined();
    expect(row?.tierCode).toBe('STARTER');
    expect(row?.status).toBe('ACTIVE');
    expect(row?.requestsThisPeriod).toBeGreaterThanOrEqual(1);
  });

  it('is readable by finance staff and refused to clients', async () => {
    const finance = await createStaff('FINANCE_MANAGER');
    const owner = await createMember({
      organizationId: (await createOrganization()).id,
      roles: ['CLIENT_OWNER'],
    });

    await authGet(`${API}/ops/billing`, finance.token).expect(200);
    await authGet(`${API}/ops/billing`, owner.token).expect(403);
  });
});
