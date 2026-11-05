import { describe, expect, it } from 'vitest';
import type { SubscriptionTier } from '@gc3/types';
import {
  API,
  authGet,
  authPatch,
  authPost,
  createMember,
  createOrganization,
  createStaff,
} from './helpers/api';
import { prisma } from '../src/db/client';
import { computeBill, invoiceNumber, toMegabytes } from '../src/lib/billing';
import { periodFor } from '../src/lib/period';
import { usageRepository } from '../src/repositories/usage.repository';

const STARTER: SubscriptionTier = {
  id: 'tier-starter',
  code: 'STARTER',
  name: 'Starter',
  description: null,
  monthlyPriceCents: 2_500_000,
  currency: 'INR',
  requestsIncluded: 20,
  storageMbIncluded: 5_120,
  apiCallsIncluded: 50_000,
  seatsIncluded: 5,
  requestOverageCents: 50_000,
  storageMbOverageCents: 500,
  apiCallsOverageCentsPer1k: 5_000,
  isActive: true,
  sortOrder: 10,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe('computeBill — the arithmetic', () => {
  it('charges only the plan when usage is inside the allowance', () => {
    const bill = computeBill({
      tier: STARTER,
      usage: { requests: 20, storageKb: 5_120 * 1_024, apiCalls: 50_000 },
      periodLabel: 'November 2026',
    });

    expect(bill.lines).toHaveLength(1);
    expect(bill.lines[0]).toMatchObject({
      kind: 'TIER_FEE',
      quantity: 1,
      unitAmountCents: 2_500_000,
      amountCents: 2_500_000,
    });
    expect(bill.totalCents).toBe(2_500_000);
  });

  it('charges request overage at the tier unit price', () => {
    const bill = computeBill({
      tier: STARTER,
      usage: { requests: 25, storageKb: 0, apiCalls: 0 },
      periodLabel: 'November 2026',
    });

    const overage = bill.lines.find((line) => line.meterKey === 'REQUESTS');
    expect(overage).toMatchObject({ quantity: 5, unitAmountCents: 50_000, amountCents: 250_000 });
    expect(bill.totalCents).toBe(2_750_000);
  });

  it('converts storage from KB to whole MB before charging', () => {
    expect(toMegabytes(1_048_576)).toBe(1_024);
    expect(toMegabytes(1_048_575)).toBe(1_023); // never rounds up in the platform's favour

    const usedKb = (5_120 + 3) * 1_024 + 512; // 3 whole MB over, plus a stray half
    const bill = computeBill({
      tier: STARTER,
      usage: { requests: 0, storageKb: usedKb, apiCalls: 0 },
      periodLabel: 'November 2026',
    });

    const overage = bill.lines.find((line) => line.meterKey === 'STORAGE_KB');
    expect(overage).toMatchObject({ quantity: 3, amountCents: 1_500 });
  });

  it('bills API overage in blocks of 1,000, a part block counting as a block', () => {
    const bill = computeBill({
      tier: STARTER,
      usage: { requests: 0, storageKb: 0, apiCalls: 50_001 },
      periodLabel: 'November 2026',
    });

    const overage = bill.lines.find((line) => line.meterKey === 'API_CALLS');
    expect(overage).toMatchObject({ quantity: 1, unitAmountCents: 5_000, amountCents: 5_000 });
  });

  it('adds the lines up exactly, with no float drift', () => {
    const bill = computeBill({
      tier: STARTER,
      usage: { requests: 25, storageKb: 5_121 * 1_024, apiCalls: 51_000 },
      periodLabel: 'November 2026',
    });

    const summed = bill.lines.reduce((total, line) => total + line.amountCents, 0);
    expect(bill.subtotalCents).toBe(summed);
    expect(bill.totalCents).toBe(summed + bill.taxCents);
    expect(bill.totalCents).toBe(2_755_500);
  });

  it('numbers invoices per month and per tenant', () => {
    expect(invoiceNumber('2026-11', 1)).toBe('INV-2026-11-0001');
    expect(invoiceNumber('2026-11', 42)).toBe('INV-2026-11-0042');
  });
});

describe('POST /invoices/generate', () => {
  it('bills the month: plan fee plus metered overage', async () => {
    const organization = await createOrganization({ name: 'Invoice Co' });
    const admin = await createStaff('PLATFORM_ADMIN');
    const period = periodFor().key;

    await usageRepository.set(organization.id, 'REQUESTS', 25, period);
    await usageRepository.set(organization.id, 'STORAGE_KB', 5_121 * 1_024, period);
    await usageRepository.set(organization.id, 'API_CALLS', 51_000, period);

    const response = await authPost(
      `${API}/invoices/generate`,
      admin.token,
      { period, notes: 'November run' },
      organization.id,
    ).expect(201);

    const invoice = response.body.data;
    expect(invoice.number).toBe(`INV-${period}-0001`);
    expect(invoice.status).toBe('DRAFT');
    expect(invoice.currency).toBe('INR');
    expect(invoice.totalCents).toBe(2_755_500);
    expect(invoice.lineItems).toHaveLength(4);
    expect(invoice.lineItems[0].kind).toBe('TIER_FEE');
    expect(invoice.notes).toBe('November run');
    expect(invoice.issuedAt).toBeNull();
  });

  it('refuses to bill the same month twice, pointing at the existing invoice', async () => {
    const organization = await createOrganization();
    const admin = await createStaff('PLATFORM_ADMIN');
    const period = periodFor().key;

    const first = await authPost(
      `${API}/invoices/generate`,
      admin.token,
      { period },
      organization.id,
    ).expect(201);

    const second = await authPost(
      `${API}/invoices/generate`,
      admin.token,
      { period },
      organization.id,
    ).expect(409);

    expect(second.body.error.message).toContain(first.body.data.id);
  });

  it('defaults to the last complete month', async () => {
    const organization = await createOrganization();
    const admin = await createStaff('PLATFORM_ADMIN');

    const response = await authPost(`${API}/invoices/generate`, admin.token, {}, organization.id)
      .expect(201);

    const periodStart = new Date(response.body.data.periodStart);
    const thisMonthStart = new Date(
      Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1),
    );

    expect(periodStart.getTime()).toBeLessThan(thisMonthStart.getTime());
  });

  it('rejects a malformed period', async () => {
    const organization = await createOrganization();
    const admin = await createStaff('PLATFORM_ADMIN');

    await authPost(`${API}/invoices/generate`, admin.token, { period: '2026-13' }, organization.id)
      .expect(400);
  });

  it('is closed to clients — billing is not a client action', async () => {
    const organization = await createOrganization();
    const owner = await createMember({ organizationId: organization.id, roles: ['CLIENT_OWNER'] });

    await authPost(`${API}/invoices/generate`, owner.token, {}, organization.id).expect(403);
  });
});

describe('reading invoices', () => {
  it('lists this tenant only, with a status filter', async () => {
    const admin = await createStaff('PLATFORM_ADMIN');
    const alpha = await createOrganization({ name: 'Alpha Billing' });
    const beta = await createOrganization({ name: 'Beta Billing' });
    const period = periodFor().key;

    const alphaInvoice = await authPost(
      `${API}/invoices/generate`,
      admin.token,
      { period },
      alpha.id,
    ).expect(201);

    const list = await authGet(`${API}/invoices`, admin.token, alpha.id).expect(200);
    expect(list.body.data.items).toHaveLength(1);
    expect(list.body.data.items[0].id).toBe(alphaInvoice.body.data.id);

    const betaList = await authGet(`${API}/invoices`, admin.token, beta.id).expect(200);
    expect(betaList.body.data.items).toHaveLength(0);

    const drafts = await authGet(`${API}/invoices?status=DRAFT`, admin.token, alpha.id).expect(200);
    expect(drafts.body.data.total).toBe(1);

    const paid = await authGet(`${API}/invoices?status=PAID`, admin.token, alpha.id).expect(200);
    expect(paid.body.data.total).toBe(0);
  });

  it('serves one invoice with its lines, and 404s across tenants', async () => {
    const admin = await createStaff('PLATFORM_ADMIN');
    const alpha = await createOrganization({ name: 'Detail Alpha' });
    const beta = await createOrganization({ name: 'Detail Beta' });

    const created = await authPost(
      `${API}/invoices/generate`,
      admin.token,
      { period: periodFor().key },
      alpha.id,
    ).expect(201);

    const detail = await authGet(`${API}/invoices/${created.body.data.id}`, admin.token, alpha.id)
      .expect(200);
    expect(detail.body.data.lineItems.length).toBeGreaterThan(0);

    await authGet(`${API}/invoices/${created.body.data.id}`, admin.token, beta.id).expect(404);
  });

  it('downloads a printable document', async () => {
    const admin = await createStaff('PLATFORM_ADMIN');
    const organization = await createOrganization({ name: 'Downloads Co' });

    const created = await authPost(
      `${API}/invoices/generate`,
      admin.token,
      { period: periodFor().key },
      organization.id,
    ).expect(201);

    const download = await authGet(
      `${API}/invoices/${created.body.data.id}/download`,
      admin.token,
      organization.id,
    ).expect(200);

    expect(download.headers['content-type']).toContain('text/plain');
    expect(download.headers['content-disposition']).toContain(created.body.data.number);
    expect(download.text).toContain('GC³ PORTAL — INVOICE');
    expect(download.text).toContain('Downloads Co');
    expect(download.text).toContain('TOTAL');
  });
});

describe('invoice status', () => {
  it('issues a draft and sets net-30 terms', async () => {
    const organization = await createOrganization();
    const admin = await createStaff('PLATFORM_ADMIN');

    const created = await authPost(
      `${API}/invoices/generate`,
      admin.token,
      { period: periodFor().key },
      organization.id,
    ).expect(201);

    const issued = await authPatch(
      `${API}/invoices/${created.body.data.id}/status`,
      admin.token,
      { status: 'ISSUED' },
      organization.id,
    ).expect(200);

    expect(issued.body.data.status).toBe('ISSUED');
    expect(issued.body.data.issuedAt).toBeTruthy();

    const termDays =
      (new Date(issued.body.data.dueAt).getTime() - new Date(issued.body.data.issuedAt).getTime()) /
      86_400_000;
    expect(Math.round(termDays)).toBe(30);
  });

  it('settles an issued invoice, recording which human said so', async () => {
    const organization = await createOrganization();
    const finance = await createStaff('FINANCE_MANAGER');

    const created = await authPost(
      `${API}/invoices/generate`,
      finance.token,
      { period: periodFor().key },
      organization.id,
    ).expect(201);

    await authPatch(
      `${API}/invoices/${created.body.data.id}/status`,
      finance.token,
      { status: 'ISSUED' },
      organization.id,
    ).expect(200);

    const paid = await authPatch(
      `${API}/invoices/${created.body.data.id}/status`,
      finance.token,
      { status: 'PAID', note: 'Settled by bank transfer' },
      organization.id,
    ).expect(200);

    expect(paid.body.data.status).toBe('PAID');
    expect(paid.body.data.paidAt).toBeTruthy();
    expect(paid.body.data.paidByUserId).toBe(finance.userId);
    expect(paid.body.data.notes).toContain('bank transfer');
  });

  it('refuses to void a settled invoice, and to re-issue a draft', async () => {
    const organization = await createOrganization();
    const finance = await createStaff('FINANCE_MANAGER');

    const created = await authPost(
      `${API}/invoices/generate`,
      finance.token,
      { period: periodFor().key },
      organization.id,
    ).expect(201);

    const id = created.body.data.id as string;

    // A draft cannot jump straight to paid.
    const illegal = await authPatch(
      `${API}/invoices/${id}/status`,
      finance.token,
      { status: 'PAID' },
      organization.id,
    ).expect(409);
    expect(illegal.body.error.message).toContain('Cannot move an invoice from DRAFT to PAID');

    await authPatch(`${API}/invoices/${id}/status`, finance.token, { status: 'ISSUED' }, organization.id)
      .expect(200);
    // Issuing twice is not a no-op, it is a mistake.
    await authPatch(`${API}/invoices/${id}/status`, finance.token, { status: 'ISSUED' }, organization.id)
      .expect(409);

    await authPatch(`${API}/invoices/${id}/status`, finance.token, { status: 'PAID' }, organization.id)
      .expect(200);
    await authPatch(`${API}/invoices/${id}/status`, finance.token, { status: 'VOID' }, organization.id)
      .expect(409);
  });

  it('marks an issued invoice overdue once its due date passes', async () => {
    const organization = await createOrganization();
    const admin = await createStaff('PLATFORM_ADMIN');

    const created = await authPost(
      `${API}/invoices/generate`,
      admin.token,
      { period: periodFor().key },
      organization.id,
    ).expect(201);

    const id = created.body.data.id as string;

    await authPatch(`${API}/invoices/${id}/status`, admin.token, { status: 'ISSUED' }, organization.id)
      .expect(200);

    // Wind the due date into the past, as a real month would eventually do.
    await prisma.invoice.update({
      where: { id },
      data: { dueAt: new Date(Date.now() - 86_400_000) },
    });

    const list = await authGet(`${API}/invoices`, admin.token, organization.id).expect(200);
    expect(list.body.data.items[0].status).toBe('OVERDUE');
  });

  it('is closed to clients and to staff without finance:manage', async () => {
    const organization = await createOrganization();
    const admin = await createStaff('PLATFORM_ADMIN');
    const owner = await createMember({ organizationId: organization.id, roles: ['CLIENT_OWNER'] });
    const accountManager = await createStaff('ACCOUNT_MANAGER');

    const created = await authPost(
      `${API}/invoices/generate`,
      admin.token,
      { period: periodFor().key },
      organization.id,
    ).expect(201);

    const id = created.body.data.id as string;

    await authPatch(`${API}/invoices/${id}/status`, owner.token, { status: 'ISSUED' }, organization.id)
      .expect(403);
    await authPatch(
      `${API}/invoices/${id}/status`,
      accountManager.token,
      { status: 'ISSUED' },
      organization.id,
    ).expect(403);

    // But the client owner may read its own bills.
    await authGet(`${API}/invoices`, owner.token, organization.id).expect(200);
  });
});
