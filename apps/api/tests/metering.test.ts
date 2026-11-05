import { describe, expect, it } from 'vitest';
import {
  API,
  authGet,
  authPatch,
  authPost,
  authPutRaw,
  createMember,
  createOrganization,
  createStaff,
} from './helpers/api';
import { prisma } from '../src/db/client';
import { periodFor } from '../src/lib/period';
import { usageRepository } from '../src/repositories/usage.repository';
import { bytesToKb } from '../src/metering/limits';

const STARTER_REQUESTS = 20;
const STARTER_STORAGE_MB = 5_120;
const STARTER_STORAGE_KB = STARTER_STORAGE_MB * 1_024;
const STARTER_API_CALLS = 50_000;

/** Waits for a meter write that happens after the response, then returns it. */
async function meterAfter(organizationId: string, key: 'REQUESTS' | 'STORAGE_KB' | 'API_CALLS') {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const value = await usageRepository.get(organizationId, key);
    if (value !== null && value > 0) {
      return value;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }

  return (await usageRepository.get(organizationId, key)) ?? 0;
}

async function seedRequest(
  token: string,
  organizationId: string,
): Promise<{ id: string }> {
  const response = await authPost(
    `${API}/service-requests`,
    token,
    { title: 'Metered request', description: 'Created to exercise the plan guard' },
    organizationId,
  ).expect(201);

  return response.body.data;
}

async function seedDeliverable(
  token: string,
  organizationId: string,
  requestId: string,
): Promise<{ id: string }> {
  const response = await authPost(
    `${API}/service-requests/${requestId}/deliverables`,
    token,
    { title: 'Sized asset' },
    organizationId,
  ).expect(201);

  return response.body.data;
}

describe('request metering', () => {
  it('counts each created request against the plan', async () => {
    const organization = await createOrganization();
    const staff = await createStaff('PLATFORM_ADMIN');
    const period = periodFor().key;

    await seedRequest(staff.token, organization.id);
    await seedRequest(staff.token, organization.id);

    const used = await usageRepository.get(organization.id, 'REQUESTS', period);
    expect(used).toBe(2);
  });

  it('blocks the request that would exceed the allowance, naming the plan', async () => {
    const organization = await createOrganization();
    const staff = await createStaff('PLATFORM_ADMIN');

    // One short of the allowance: the next create is the last one possible.
    await usageRepository.set(organization.id, 'REQUESTS', STARTER_REQUESTS, periodFor().key);

    const blocked = await authPost(
      `${API}/service-requests`,
      staff.token,
      { title: 'One too many', description: 'Should not be created' },
      organization.id,
    ).expect(403);

    expect(blocked.body.error.code).toBe('LIMIT_EXCEEDED');
    expect(blocked.body.error.message).toContain('STARTER');
    expect(blocked.body.error.message).toContain('20 service requests');
    expect(blocked.body.error.details).toEqual(
      expect.arrayContaining([{ path: 'meter', message: 'REQUESTS' }]),
    );

    // Nothing was created, and the meter did not move for a refused call.
    const count = await prisma.serviceRequest.count({ where: { organizationId: organization.id } });
    expect(count).toBe(0);
    expect(await usageRepository.get(organization.id, 'REQUESTS')).toBe(STARTER_REQUESTS);
  });

  it('applies to clients as well — the plan belongs to the tenant', async () => {
    const organization = await createOrganization();
    const owner = await createMember({ organizationId: organization.id, roles: ['CLIENT_OWNER'] });

    await usageRepository.set(organization.id, 'REQUESTS', STARTER_REQUESTS, periodFor().key);

    const blocked = await authPost(
      `${API}/service-requests`,
      owner.token,
      { title: 'Client over limit', description: 'Should be refused on plan limits' },
      organization.id,
    ).expect(403);

    expect(blocked.body.error.code).toBe('LIMIT_EXCEEDED');
  });

  it('lets a tenant that upgraded go past the old limit', async () => {
    const organization = await createOrganization();
    const admin = await createStaff('PLATFORM_ADMIN');

    await usageRepository.set(organization.id, 'REQUESTS', STARTER_REQUESTS, periodFor().key);
    await authPost(
      `${API}/service-requests`,
      admin.token,
      { title: 'Blocked on Starter', description: 'Never created' },
      organization.id,
    ).expect(403);

    // Professional includes more requests; the meter is unchanged by the upgrade.
    await authPatch(
      `${API}/subscription`,
      admin.token,
      { tierCode: 'PROFESSIONAL' },
      organization.id,
    ).expect(200);

    await authPost(
      `${API}/service-requests`,
      admin.token,
      { title: 'Allowed on Professional', description: 'Now inside the allowance' },
      organization.id,
    ).expect(201);
  });
});

describe('storage metering', () => {
  it('blocks an upload that would exceed the storage allowance', async () => {
    const organization = await createOrganization();
    const staff = await createStaff('PLATFORM_ADMIN');

    const request = await seedRequest(staff.token, organization.id);
    const deliverable = await seedDeliverable(staff.token, organization.id, request.id);

    // Allowance all but used up: 2 KB left, uploading 4 KB.
    await usageRepository.set(
      organization.id,
      'STORAGE_KB',
      STARTER_STORAGE_KB - 2,
      periodFor().key,
    );

    const bytes = Buffer.from('x'.repeat(4 * 1_024));

    const blocked = await authPutRaw(
      `${API}/service-requests/${request.id}/deliverables/${deliverable.id}/file`,
      staff.token,
      bytes,
      'text/plain',
      organization.id,
    ).expect(403);

    expect(blocked.body.error.code).toBe('LIMIT_EXCEEDED');
    expect(blocked.body.error.details).toEqual(
      expect.arrayContaining([{ path: 'meter', message: 'STORAGE_KB' }]),
    );

    // The file was never attached, so it must not be charged for either.
    const stored = await prisma.deliverable.findUnique({ where: { id: deliverable.id } });
    expect(stored?.fileKey).toBeNull();
    expect(await usageRepository.get(organization.id, 'STORAGE_KB')).toBe(STARTER_STORAGE_KB - 2);
  });

  it('counts a stored file in whole KB, rounded up', async () => {
    const organization = await createOrganization();
    const staff = await createStaff('PLATFORM_ADMIN');

    const request = await seedRequest(staff.token, organization.id);
    const deliverable = await seedDeliverable(staff.token, organization.id, request.id);

    const bytes = Buffer.from('y'.repeat(2_500));

    await authPutRaw(
      `${API}/service-requests/${request.id}/deliverables/${deliverable.id}/file`,
      staff.token,
      bytes,
      'text/plain',
      organization.id,
    ).expect(200);

    expect(await usageRepository.get(organization.id, 'STORAGE_KB')).toBe(bytesToKb(bytes.length));
    expect(bytesToKb(2_500)).toBe(3);
  });

  it('lets an upload through that exactly fills the allowance', async () => {
    const organization = await createOrganization();
    const staff = await createStaff('PLATFORM_ADMIN');

    const request = await seedRequest(staff.token, organization.id);
    const deliverable = await seedDeliverable(staff.token, organization.id, request.id);

    const bytes = Buffer.from('z'.repeat(1_024));
    await usageRepository.set(
      organization.id,
      'STORAGE_KB',
      STARTER_STORAGE_KB - 1,
      periodFor().key,
    );

    await authPutRaw(
      `${API}/service-requests/${request.id}/deliverables/${deliverable.id}/file`,
      staff.token,
      bytes,
      'text/plain',
      organization.id,
    ).expect(200);

    expect(await usageRepository.get(organization.id, 'STORAGE_KB')).toBe(STARTER_STORAGE_KB);
  });
});

describe('api call metering', () => {
  it('counts authenticated tenant requests', async () => {
    const organization = await createOrganization();
    const staff = await createStaff('PLATFORM_ADMIN');

    await usageRepository.set(organization.id, 'API_CALLS', 0, periodFor().key);

    await authGet(`${API}/service-requests`, staff.token, organization.id).expect(200);

    expect(await meterAfter(organization.id, 'API_CALLS')).toBeGreaterThanOrEqual(1);
  });

  it('does not count anonymous calls', async () => {
    const organization = await createOrganization();
    const staff = await createStaff('PLATFORM_ADMIN');

    await usageRepository.set(organization.id, 'API_CALLS', 0, periodFor().key);

    // No token: a 401 that must not move a tenant's meter.
    await authGet(`${API}/service-requests`, 'not-a-token', organization.id).expect(401);

    const used = await usageRepository.get(organization.id, 'API_CALLS');
    expect(used).toBe(0);
  });

  it('blocks work when the call allowance is spent, but keeps billing readable', async () => {
    const organization = await createOrganization();
    const staff = await createStaff('PLATFORM_ADMIN');

    await authGet(`${API}/subscription`, staff.token, organization.id).expect(200);
    await usageRepository.set(organization.id, 'API_CALLS', STARTER_API_CALLS, periodFor().key);

    const blocked = await authPost(
      `${API}/service-requests`,
      staff.token,
      { title: 'No calls left', description: 'Blocked by the API call allowance' },
      organization.id,
    ).expect(403);

    expect(blocked.body.error.code).toBe('LIMIT_EXCEEDED');
    expect(blocked.body.error.details).toEqual(
      expect.arrayContaining([{ path: 'meter', message: 'API_CALLS' }]),
    );

    // The plan page still answers: otherwise the block hides its own cause.
    const plan = await authGet(`${API}/subscription`, staff.token, organization.id).expect(200);
    expect(plan.body.data.tier.code).toBe('STARTER');

    await authGet(`${API}/invoices`, staff.token, organization.id).expect(200);
  });
});
