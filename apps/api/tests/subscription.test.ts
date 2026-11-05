import { describe, expect, it } from 'vitest';
import { API, authGet, authPatch, createMember, createOrganization, createStaff } from './helpers/api';
import { prisma } from '../src/db/client';
import { usageRepository } from '../src/repositories/usage.repository';
import { periodFor } from '../src/lib/period';

const TIER_CODES = ['STARTER', 'PROFESSIONAL', 'ENTERPRISE'];

describe('subscription — plan and allowances', () => {
  it('auto-provisions the entry tier on first read, and audits it', async () => {
    const organization = await createOrganization({ name: 'Fresh Plan Co' });
    const owner = await createMember({ organizationId: organization.id, roles: ['CLIENT_OWNER'] });

    const response = await authGet(`${API}/subscription`, owner.token, organization.id).expect(200);
    const overview = response.body.data;

    expect(overview.tier.code).toBe('STARTER');
    expect(overview.subscription.status).toBe('ACTIVE');
    expect(overview.subscription.organizationId).toBe(organization.id);
    expect(overview.period.label).toMatch(/^\w+ \d{4}$/);

    // Three meters, all at zero, each carrying its allowance and unit.
    expect(overview.usage).toHaveLength(3);
    expect(overview.usage.map((meter: { key: string }) => meter.key)).toEqual([
      'REQUESTS',
      'STORAGE_KB',
      'API_CALLS',
    ]);
    for (const meter of overview.usage) {
      expect(meter.quantity).toBe(0);
      expect(meter.included).toBeGreaterThan(0);
      expect(meter.state).toBe('OK');
    }

    const audit = await prisma.auditEvent.findFirst({
      where: { organizationId: organization.id, action: 'subscription.auto_provisioned' },
    });

    expect(audit).not.toBeNull();
    expect(audit?.actorType).toBe('SYSTEM');
  });

  it('is stable: a second read does not provision again', async () => {
    const organization = await createOrganization();
    const admin = await createStaff('PLATFORM_ADMIN');

    const first = await authGet(`${API}/subscription`, admin.token, organization.id).expect(200);
    const second = await authGet(`${API}/subscription`, admin.token, organization.id).expect(200);

    expect(second.body.data.subscription.id).toBe(first.body.data.subscription.id);

    const rows = await prisma.organizationSubscription.count({
      where: { organizationId: organization.id },
    });
    expect(rows).toBe(1);
  });

  it('publishes the tier catalogue', async () => {
    const organization = await createOrganization();
    const admin = await createStaff('PLATFORM_ADMIN');

    const response = await authGet(`${API}/subscription/tiers`, admin.token, organization.id).expect(200);

    const codes = (response.body.data as { code: string }[]).map((tier) => tier.code);
    expect(codes).toEqual(expect.arrayContaining(TIER_CODES));
    expect(codes).toEqual([...codes].sort((a, b) => {
      const order = TIER_CODES.indexOf(a) - TIER_CODES.indexOf(b);
      return order;
    }));
  });

  it('reports usage against allowances, with warning and exceeded states', async () => {
    const organization = await createOrganization();
    const admin = await createStaff('PLATFORM_ADMIN');

    const tiers = await authGet(`${API}/subscription/tiers`, admin.token, organization.id).expect(200);
    const starter = (tiers.body.data as { code: string; requestsIncluded: number }[]).find(
      (tier) => tier.code === 'STARTER',
    );
    const included = starter?.requestsIncluded ?? 0;

    const period = periodFor().key;

    // 90% used -> WARNING; storage over the allowance -> EXCEEDED.
    await usageRepository.set(organization.id, 'REQUESTS', Math.ceil(included * 0.9), period);
    await usageRepository.set(organization.id, 'STORAGE_KB', 10_000_000, period);

    const response = await authGet(`${API}/subscription`, admin.token, organization.id).expect(200);
    const meters = response.body.data.usage as {
      key: string;
      state: string;
      percentUsed: number;
      remaining: number;
    }[];

    const requests = meters.find((meter) => meter.key === 'REQUESTS');
    const storage = meters.find((meter) => meter.key === 'STORAGE_KB');

    expect(requests?.state).toBe('WARNING');
    expect(requests?.percentUsed).toBeGreaterThanOrEqual(80);
    expect(storage?.state).toBe('EXCEEDED');
    expect(storage?.remaining).toBe(0);
  });
});

describe('subscription — changing plan', () => {
  it('moves the tenant onto another tier and audits both codes', async () => {
    const organization = await createOrganization();
    const admin = await createStaff('PLATFORM_ADMIN');

    const response = await authPatch(
      `${API}/subscription`,
      admin.token,
      { tierCode: 'PROFESSIONAL' },
      organization.id,
    ).expect(200);

    expect(response.body.data.tier.code).toBe('PROFESSIONAL');
    expect(response.body.data.previousTierCode).toBe('STARTER');

    const audit = await prisma.auditEvent.findFirst({
      where: { organizationId: organization.id, action: 'subscription.tier_changed' },
      orderBy: { createdAt: 'desc' },
    });

    expect(audit?.metadata).toMatchObject({ from: 'STARTER', to: 'PROFESSIONAL' });
    expect(audit?.actorId).toBeTruthy();
  });

  it('is a commercial action: no client can change its own plan', async () => {
    const organization = await createOrganization();
    const owner = await createMember({ organizationId: organization.id, roles: ['CLIENT_OWNER'] });

    const response = await authPatch(
      `${API}/subscription`,
      owner.token,
      { tierCode: 'ENTERPRISE' },
      organization.id,
    ).expect(403);

    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('404s for a tier that does not exist', async () => {
    const organization = await createOrganization();
    const admin = await createStaff('PLATFORM_ADMIN');

    await authPatch(
      `${API}/subscription`,
      admin.token,
      { tierCode: 'PLATINUM' },
      organization.id,
    ).expect(404);
  });

  it('rejects a malformed payload', async () => {
    const organization = await createOrganization();
    const admin = await createStaff('PLATFORM_ADMIN');

    await authPatch(`${API}/subscription`, admin.token, {}, organization.id).expect(400);
  });

  it('keeps tenants independent', async () => {
    const admin = await createStaff('PLATFORM_ADMIN');
    const alpha = await createOrganization({ name: 'Plan Alpha' });
    const beta = await createOrganization({ name: 'Plan Beta' });

    await authGet(`${API}/subscription`, admin.token, alpha.id).expect(200);
    await authGet(`${API}/subscription`, admin.token, beta.id).expect(200);

    await authPatch(`${API}/subscription`, admin.token, { tierCode: 'ENTERPRISE' }, alpha.id).expect(200);

    const alphaPlan = await authGet(`${API}/subscription`, admin.token, alpha.id).expect(200);
    const betaPlan = await authGet(`${API}/subscription`, admin.token, beta.id).expect(200);

    expect(alphaPlan.body.data.tier.code).toBe('ENTERPRISE');
    expect(betaPlan.body.data.tier.code).toBe('STARTER');
  });
});

describe('subscription — who may look', () => {
  it('lets a client owner read, but not a team member', async () => {
    const organization = await createOrganization();
    const owner = await createMember({ organizationId: organization.id, roles: ['CLIENT_OWNER'] });
    const member = await createMember({
      organizationId: organization.id,
      roles: ['CLIENT_TEAM_MEMBER'],
    });

    await authGet(`${API}/subscription`, owner.token, organization.id).expect(200);
    await authGet(`${API}/subscription`, member.token, organization.id).expect(403);
  });

  it('lets finance and account staff read; specialists may not', async () => {
    const organization = await createOrganization();
    const finance = await createStaff('FINANCE_MANAGER');
    const account = await createStaff('ACCOUNT_MANAGER');
    const specialist = await createStaff('SPECIALIST');

    await authGet(`${API}/subscription`, finance.token, organization.id).expect(200);
    await authGet(`${API}/subscription`, account.token, organization.id).expect(200);
    await authGet(`${API}/subscription`, specialist.token, organization.id).expect(403);
  });

  it('requires a tenant header', async () => {
    const admin = await createStaff('PLATFORM_ADMIN');

    await authGet(`${API}/subscription`, admin.token).expect(400);
  });
});
