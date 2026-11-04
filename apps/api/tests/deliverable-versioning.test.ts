import { describe, expect, it } from 'vitest';
import {
  API,
  app,
  authGet,
  authPatch,
  authPost,
  createMember,
  createOrganization,
  createStaff,
} from './helpers/api';
import request from 'supertest';

interface SeededDeliverable {
  requestId: string;
  deliverableId: string;
}

async function seedDeliverable(
  organizationId: string,
  token: string,
  overrides: Partial<{ title: string; fileUrl: string }> = {},
): Promise<SeededDeliverable> {
  const created = await authPost(
    `${API}/service-requests`,
    token,
    {
      title: 'Versioning host request',
      description: 'A request that carries a versioned deliverable.',
      priority: 'NORMAL',
      status: 'SUBMITTED',
    },
    organizationId,
  ).expect(201);

  const requestId = created.body.data.id as string;

  const deliverable = await authPost(
    `${API}/service-requests/${requestId}/deliverables`,
    token,
    {
      title: overrides.title ?? 'Deployment guide',
      description: 'First cut.',
      ...(overrides.fileUrl ? { fileUrl: overrides.fileUrl } : {}),
    },
    organizationId,
  ).expect(201);

  return { requestId, deliverableId: deliverable.body.data.id as string };
}

async function approveAndRelease(
  organizationId: string,
  approverToken: string,
  seeded: SeededDeliverable,
) {
  const base = `${API}/service-requests/${seeded.requestId}/deliverables/${seeded.deliverableId}/status`;

  await authPatch(base, approverToken, { status: 'APPROVED' }, organizationId).expect(200);
  return authPatch(base, approverToken, { status: 'RELEASED' }, organizationId).expect(200);
}

describe('deliverable versioning', () => {
  it('starts at version 1 with an initial history row', async () => {
    const organization = await createOrganization();
    const staff = await createStaff('PLATFORM_ADMIN');
    const seeded = await seedDeliverable(organization.id, staff.token);

    const versions = await authGet(
      `${API}/service-requests/${seeded.requestId}/deliverables/${seeded.deliverableId}/versions`,
      staff.token,
      organization.id,
    ).expect(200);

    expect(versions.body.data).toHaveLength(1);
    expect(versions.body.data[0]).toMatchObject({
      version: 1,
      title: 'Deployment guide',
      changeNote: 'Initial version',
      createdById: staff.userId,
    });
  });

  it('bumps the version and appends a snapshot on edit', async () => {
    const organization = await createOrganization();
    const admin = await createStaff('PLATFORM_ADMIN');
    // SPECIALIST produces and edits deliverables but cannot raise requests.
    const specialist = await createStaff('SPECIALIST');
    const seeded = await seedDeliverable(organization.id, admin.token);

    const edited = await authPatch(
      `${API}/service-requests/${seeded.requestId}/deliverables/${seeded.deliverableId}`,
      specialist.token,
      { title: 'Deployment guide (rev 2)', changeNote: 'Fixed the rollback steps' },
      organization.id,
    ).expect(200);

    expect(edited.body.data.deliverable).toMatchObject({
      title: 'Deployment guide (rev 2)',
      version: 2,
      status: 'PENDING',
    });
    expect(edited.body.data.approvalReset).toBe(false);

    const versions = await authGet(
      `${API}/service-requests/${seeded.requestId}/deliverables/${seeded.deliverableId}/versions`,
      specialist.token,
      organization.id,
    ).expect(200);

    // Newest first, and the old content is still readable.
    expect(versions.body.data).toHaveLength(2);
    expect(versions.body.data[0]).toMatchObject({
      version: 2,
      title: 'Deployment guide (rev 2)',
      changeNote: 'Fixed the rollback steps',
    });
    expect(versions.body.data[1]).toMatchObject({
      version: 1,
      title: 'Deployment guide',
    });
  });

  it('replaces a released file and forces re-approval', async () => {
    const organization = await createOrganization();
    const admin = await createStaff('PLATFORM_ADMIN');
    const approver = await createMember({
      organizationId: organization.id,
      roles: ['CLIENT_OWNER'],
    });
    const seeded = await seedDeliverable(organization.id, admin.token);

    await approveAndRelease(organization.id, approver.token, seeded);

    const replaced = await authPatch(
      `${API}/service-requests/${seeded.requestId}/deliverables/${seeded.deliverableId}`,
      admin.token,
      {
        fileUrl: 'https://files.example.com/guide-v2.pdf',
        changeNote: 'Client asked for a corrected diagram',
      },
      organization.id,
    ).expect(200);

    expect(replaced.body.data.approvalReset).toBe(true);
    expect(replaced.body.data.deliverable).toMatchObject({
      status: 'PENDING',
      version: 2,
      fileUrl: 'https://files.example.com/guide-v2.pdf',
      approvedById: null,
      approvedAt: null,
      releasedAt: null,
    });

    // The old sign-off is gone, so release must be refused until a human approves again.
    await authPatch(
      `${API}/service-requests/${seeded.requestId}/deliverables/${seeded.deliverableId}/status`,
      approver.token,
      { status: 'RELEASED' },
      organization.id,
    ).expect(403);
  });

  it('keeps an approval when only an unapproved deliverable is edited', async () => {
    const organization = await createOrganization();
    const staff = await createStaff('POD_MANAGER');
    const seeded = await seedDeliverable(organization.id, staff.token);

    const edited = await authPatch(
      `${API}/service-requests/${seeded.requestId}/deliverables/${seeded.deliverableId}`,
      staff.token,
      { description: 'Clearer wording.' },
      organization.id,
    ).expect(200);

    expect(edited.body.data.approvalReset).toBe(false);
    expect(edited.body.data.deliverable.status).toBe('PENDING');
    expect(edited.body.data.deliverable.version).toBe(2);
  });

  it('rejects an empty edit body', async () => {
    const organization = await createOrganization();
    const staff = await createStaff('PLATFORM_ADMIN');
    const seeded = await seedDeliverable(organization.id, staff.token);

    await authPatch(
      `${API}/service-requests/${seeded.requestId}/deliverables/${seeded.deliverableId}`,
      staff.token,
      {},
      organization.id,
    ).expect(400);
  });

  it('refuses a client actor, who holds no deliverable:update', async () => {
    const organization = await createOrganization();
    const staff = await createStaff('PLATFORM_ADMIN');
    const seeded = await seedDeliverable(organization.id, staff.token);
    const owner = await createMember({
      organizationId: organization.id,
      roles: ['CLIENT_OWNER'],
    });

    await authPatch(
      `${API}/service-requests/${seeded.requestId}/deliverables/${seeded.deliverableId}`,
      owner.token,
      { title: 'Client rewrite' },
      organization.id,
    ).expect(403);
  });

  it('returns 404 when the deliverable is not on that request or tenant', async () => {
    const mine = await createOrganization();
    const theirs = await createOrganization();
    const staff = await createStaff('PLATFORM_ADMIN');

    const seeded = await seedDeliverable(mine.id, staff.token);
    const theirSeeded = await seedDeliverable(theirs.id, staff.token);

    // Right tenant, wrong request in the path.
    await authPatch(
      `${API}/service-requests/${theirSeeded.requestId}/deliverables/${seeded.deliverableId}`,
      staff.token,
      { title: 'Mismatched path' },
      mine.id,
    ).expect(404);

    // Right ids, wrong tenant.
    await authPatch(
      `${API}/service-requests/${seeded.requestId}/deliverables/${seeded.deliverableId}`,
      staff.token,
      { title: 'Cross-tenant edit' },
      theirs.id,
    ).expect(404);
  });

  it('lets a client read version history but not another tenant’s', async () => {
    const mine = await createOrganization();
    const theirs = await createOrganization();
    const staff = await createStaff('PLATFORM_ADMIN');
    const seeded = await seedDeliverable(mine.id, staff.token);
    const owner = await createMember({ organizationId: mine.id, roles: ['CLIENT_OWNER'] });

    const versions = await authGet(
      `${API}/service-requests/${seeded.requestId}/deliverables/${seeded.deliverableId}/versions`,
      owner.token,
      mine.id,
    ).expect(200);

    expect(versions.body.data).toHaveLength(1);

    await authGet(
      `${API}/service-requests/${seeded.requestId}/deliverables/${seeded.deliverableId}/versions`,
      staff.token,
      theirs.id,
    ).expect(404);
  });
});

describe('GET /api/v1/deliverables/history', () => {
  it('lists only released assets, with the request they fulfil', async () => {
    const organization = await createOrganization();
    const admin = await createStaff('PLATFORM_ADMIN');
    const approver = await createMember({
      organizationId: organization.id,
      roles: ['CLIENT_APPROVER'],
    });

    const released = await seedDeliverable(organization.id, admin.token, {
      title: 'Released architecture pack',
      fileUrl: 'https://files.example.com/arch.pdf',
    });
    const pending = await seedDeliverable(organization.id, admin.token, {
      title: 'Still in draft',
    });

    await approveAndRelease(organization.id, approver.token, released);

    const history = await authGet(`${API}/deliverables/history`, approver.token, organization.id)
      .expect(200);

    const titles = (history.body.data.entries as { title: string }[]).map((entry) => entry.title);

    expect(titles).toContain('Released architecture pack');
    expect(titles).not.toContain('Still in draft');
    expect(history.body.data.releasedCount).toBe(1);
    expect(history.body.data.requestCount).toBe(1);
    expect(history.body.data.latestReleasedAt).toBeTruthy();

    const entry = (history.body.data.entries as Record<string, unknown>[])[0]!;
    expect(entry.requestReference).toMatch(/^REQ-/);
    expect(entry.requestTitle).toBe('Versioning host request');
    expect(entry.version).toBe(1);
    void pending;
  });

  it('is empty for a workspace with nothing released', async () => {
    const organization = await createOrganization();
    const staff = await createStaff('PLATFORM_ADMIN');
    await seedDeliverable(organization.id, staff.token);

    const history = await authGet(`${API}/deliverables/history`, staff.token, organization.id)
      .expect(200);

    expect(history.body.data).toMatchObject({
      releasedCount: 0,
      requestCount: 0,
      latestReleasedAt: null,
      entries: [],
    });
  });

  it('never shows another tenant’s releases', async () => {
    const mine = await createOrganization();
    const theirs = await createOrganization();
    const admin = await createStaff('PLATFORM_ADMIN');
    const approver = await createMember({
      organizationId: theirs.id,
      roles: ['CLIENT_OWNER'],
    });

    const theirRelease = await seedDeliverable(theirs.id, admin.token, {
      title: 'Their released asset',
    });
    await approveAndRelease(theirs.id, approver.token, theirRelease);

    const mineHistory = await authGet(`${API}/deliverables/history`, admin.token, mine.id)
      .expect(200);

    expect(mineHistory.body.data.entries).toEqual([]);
    expect(mineHistory.body.data.releasedCount).toBe(0);
  });

  it('requires authentication and a tenant scope', async () => {
    const staff = await createStaff('PLATFORM_ADMIN');

    await request(app).get(`${API}/deliverables/history`).expect(401);
    await authGet(`${API}/deliverables/history`, staff.token).expect(400);
  });
});
