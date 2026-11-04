import { describe, expect, it } from 'vitest';
import request from 'supertest';
import {
  API,
  app,
  authGet,
  authPatch,
  authPost,
  createMember,
  createOrganization,
  createStaff,
  ORG_HEADER,
} from './helpers/api';
import { prisma } from '../src/db/client';
import { serviceCategoryRepository } from '../src/repositories/service-category.repository';

/**
 * HTTP layer for Phase 2: status paths, permission boundaries and tenant
 * isolation. Everything here goes through the real app, real middleware and a
 * real database.
 */
const BASE = `${API}/service-requests`;

/** Organization slugs are globally unique, so every fixture needs its own. */
let tenantSeq = 0;
function uniqSlug(prefix: string): string {
  tenantSeq += 1;
  return `${prefix}-${tenantSeq}`;
}

const REQUEST_BODY = {
  title: 'Migrate the billing service',
  description: 'Lift the billing service into the new cluster and verify parity.',
};

/** Creates a request as the given token holder and returns its id. */
async function createRequest(token: string, organizationId: string, body: object = REQUEST_BODY) {
  const response = await authPost(BASE, token, body, organizationId).expect(201);
  return response.body.data as { id: string; reference: string; status: string };
}

describe('authentication and tenant scope', () => {
  it('rejects an unauthenticated call with 401', async () => {
    const organization = await createOrganization();

    const response = await request(app)
      .post(BASE)
      .set(ORG_HEADER, organization.id)
      .send(REQUEST_BODY)
      .expect(401);

    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('rejects an authenticated call with no tenant scope', async () => {
    const organization = await createOrganization();
    const owner = await createMember({ organizationId: organization.id, roles: ['CLIENT_OWNER'] });

    const response = await authPost(BASE, owner.token, REQUEST_BODY).expect(400);
    expect(response.body.error.code).toBe('TENANT_SCOPE_REQUIRED');

    expect(organization.id).toBeTruthy();
  });
});

describe('create and read', () => {
  it('creates a request as a client team member, owned by that user', async () => {
    const organization = await createOrganization();
    const member = await createMember({
      organizationId: organization.id,
      roles: ['CLIENT_TEAM_MEMBER'],
    });

    const response = await authPost(BASE, member.token, REQUEST_BODY, organization.id).expect(201);

    expect(response.body.data).toMatchObject({
      organizationId: organization.id,
      title: REQUEST_BODY.title,
      status: 'DRAFT',
      priority: 'NORMAL',
      requesterId: member.userId,
    });
    expect(response.body.data.reference).toMatch(/^REQ-[0-9A-F]{8}$/);
  });

  it('creates in SUBMITTED state when asked, stamping submittedAt', async () => {
    const organization = await createOrganization();
    const owner = await createMember({ organizationId: organization.id, roles: ['CLIENT_OWNER'] });

    const response = await authPost(
      BASE,
      owner.token,
      { ...REQUEST_BODY, status: 'SUBMITTED', priority: 'HIGH' },
      organization.id,
    ).expect(201);

    expect(response.body.data.status).toBe('SUBMITTED');
    expect(response.body.data.submittedAt).not.toBeNull();
  });

  it('returns a single request to its own tenant', async () => {
    const organization = await createOrganization();
    const owner = await createMember({ organizationId: organization.id, roles: ['CLIENT_OWNER'] });
    const created = await createRequest(owner.token, organization.id);

    const response = await authGet(`${BASE}/${created.id}`, owner.token, organization.id).expect(200);
    expect(response.body.data.id).toBe(created.id);
  });

  it('lists and filters within the tenant', async () => {
    const organization = await createOrganization();
    const owner = await createMember({ organizationId: organization.id, roles: ['CLIENT_OWNER'] });

    const first = await createRequest(owner.token, organization.id, {
      ...REQUEST_BODY,
      title: 'First request',
    });
    await createRequest(owner.token, organization.id, { ...REQUEST_BODY, title: 'Second request' });

    await authPost(
      `${BASE}/${first.id}/status`,
      owner.token,
      { status: 'SUBMITTED' },
      organization.id,
    ).expect(200);

    const all = await authGet(BASE, owner.token, organization.id).expect(200);
    expect(all.body.data.total).toBe(2);

    const submitted = await authGet(`${BASE}?status=SUBMITTED`, owner.token, organization.id).expect(
      200,
    );
    expect(submitted.body.data.total).toBe(1);
    expect(submitted.body.data.items[0].title).toBe('First request');
  });
});

describe('validation', () => {
  it('rejects a too-short title with field-level detail', async () => {
    const organization = await createOrganization();
    const owner = await createMember({ organizationId: organization.id, roles: ['CLIENT_OWNER'] });

    const response = await authPost(
      BASE,
      owner.token,
      { title: 'x', description: 'short' },
      organization.id,
    ).expect(400);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: 'title' })]),
    );
  });

  it('rejects an empty PATCH body', async () => {
    const organization = await createOrganization();
    const owner = await createMember({ organizationId: organization.id, roles: ['CLIENT_OWNER'] });
    const created = await createRequest(owner.token, organization.id);

    const response = await authPatch(`${BASE}/${created.id}`, owner.token, {}, organization.id).expect(
      400,
    );
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects an unknown status filter', async () => {
    const organization = await createOrganization();
    const owner = await createMember({ organizationId: organization.id, roles: ['CLIENT_OWNER'] });

    await authGet(`${BASE}?status=NONSENSE`, owner.token, organization.id).expect(400);
  });

  it('refuses a category from another tenant', async () => {
    const mine = await createOrganization({ slug: uniqSlug('cat-owner') });
    const theirs = await createOrganization({ slug: uniqSlug('cat-thief') });
    const owner = await createMember({ organizationId: mine.id, roles: ['CLIENT_OWNER'] });

    const foreignCategory = await serviceCategoryRepository.createScoped(theirs.id, {
      name: 'Their catalogue',
      slug: 'their-catalogue',
    });

    const response = await authPost(
      BASE,
      owner.token,
      { ...REQUEST_BODY, categoryId: foreignCategory.id },
      mine.id,
    ).expect(404);

    expect(response.body.error.code).toBe('NOT_FOUND');
  });
});

describe('permission boundaries', () => {
  it('lets a client owner edit but refuses an approver', async () => {
    const organization = await createOrganization();
    const owner = await createMember({ organizationId: organization.id, roles: ['CLIENT_OWNER'] });
    const approver = await createMember({
      organizationId: organization.id,
      roles: ['CLIENT_APPROVER'],
    });

    const created = await createRequest(owner.token, organization.id);

    // Approver can read...
    await authGet(`${BASE}/${created.id}`, approver.token, organization.id).expect(200);

    // ...but not update.
    const forbidden = await authPatch(
      `${BASE}/${created.id}`,
      approver.token,
      { title: 'Renamed by approver' },
      organization.id,
    ).expect(403);
    expect(forbidden.body.error.message).toContain('request:update');

    const updated = await authPatch(
      `${BASE}/${created.id}`,
      owner.token,
      { title: 'Renamed by owner', priority: 'URGENT' },
      organization.id,
    ).expect(200);
    expect(updated.body.data.title).toBe('Renamed by owner');
    expect(updated.body.data.priority).toBe('URGENT');
  });

  it('refuses a staff role without request:create', async () => {
    const organization = await createOrganization();
    const accountManager = await createStaff('ACCOUNT_MANAGER');

    const response = await authPost(
      BASE,
      accountManager.token,
      REQUEST_BODY,
      organization.id,
    ).expect(403);

    expect(response.body.error.message).toContain('request:create');
  });

  it('refuses a client owner creating a deliverable (deliverable:create is staff-only)', async () => {
    const organization = await createOrganization();
    const owner = await createMember({ organizationId: organization.id, roles: ['CLIENT_OWNER'] });
    const created = await createRequest(owner.token, organization.id);

    const response = await authPost(
      `${BASE}/${created.id}/deliverables`,
      owner.token,
      { title: 'Client-authored output' },
      organization.id,
    ).expect(403);

    expect(response.body.error.message).toContain('deliverable:create');
  });
});

describe('status transitions', () => {
  it('walks DRAFT → SUBMITTED → IN_PROGRESS and stamps timestamps', async () => {
    const organization = await createOrganization();
    const owner = await createMember({ organizationId: organization.id, roles: ['CLIENT_OWNER'] });
    const created = await createRequest(owner.token, organization.id);

    const submitted = await authPost(
      `${BASE}/${created.id}/status`,
      owner.token,
      { status: 'SUBMITTED' },
      organization.id,
    ).expect(200);
    expect(submitted.body.data.status).toBe('SUBMITTED');
    expect(submitted.body.data.submittedAt).not.toBeNull();

    const progressing = await authPost(
      `${BASE}/${created.id}/status`,
      owner.token,
      { status: 'IN_PROGRESS' },
      organization.id,
    ).expect(200);
    expect(progressing.body.data.status).toBe('IN_PROGRESS');
  });

  it('rejects an illegal transition with 409', async () => {
    const organization = await createOrganization();
    const owner = await createMember({ organizationId: organization.id, roles: ['CLIENT_OWNER'] });
    const created = await createRequest(owner.token, organization.id, {
      ...REQUEST_BODY,
      status: 'SUBMITTED',
    });

    const response = await authPost(
      `${BASE}/${created.id}/status`,
      owner.token,
      { status: 'CLOSED' },
      organization.id,
    ).expect(409);

    expect(response.body.error.code).toBe('CONFLICT');
    expect(response.body.error.message).toContain('SUBMITTED');

    const unchanged = await prisma.serviceRequest.findUniqueOrThrow({
      where: { id: created.id },
    });
    expect(unchanged.status).toBe('SUBMITTED');
  });

  it('treats a repeated status as an idempotent no-op', async () => {
    const organization = await createOrganization();
    const owner = await createMember({ organizationId: organization.id, roles: ['CLIENT_OWNER'] });
    const created = await createRequest(owner.token, organization.id, {
      ...REQUEST_BODY,
      status: 'SUBMITTED',
    });

    const again = await authPost(
      `${BASE}/${created.id}/status`,
      owner.token,
      { status: 'SUBMITTED' },
      organization.id,
    ).expect(200);

    expect(again.body.data.status).toBe('SUBMITTED');
  });
});

describe('comments', () => {
  it('stores a client comment as a public note', async () => {
    const organization = await createOrganization();
    const member = await createMember({
      organizationId: organization.id,
      roles: ['CLIENT_TEAM_MEMBER'],
    });
    const created = await createRequest(member.token, organization.id);

    // A client asking for an internal note is silently downgraded to public.
    const response = await authPost(
      `${BASE}/${created.id}/comments`,
      member.token,
      { body: 'Any update on this?', isInternal: true },
      organization.id,
    ).expect(201);

    expect(response.body.data.isInternal).toBe(false);
    expect(response.body.data.authorId).toBe(member.userId);
  });

  it('hides staff internal notes from the client but shows them to staff', async () => {
    const organization = await createOrganization();
    const owner = await createMember({ organizationId: organization.id, roles: ['CLIENT_OWNER'] });
    const podManager = await createStaff('POD_MANAGER');
    const created = await createRequest(owner.token, organization.id);

    await authPost(
      `${BASE}/${created.id}/comments`,
      owner.token,
      { body: 'Client-visible message' },
      organization.id,
    ).expect(201);

    await authPost(
      `${BASE}/${created.id}/comments`,
      podManager.token,
      { body: 'Internal: client is escalating', isInternal: true },
      organization.id,
    ).expect(201);

    const clientView = await authGet(
      `${BASE}/${created.id}/comments`,
      owner.token,
      organization.id,
    ).expect(200);
    expect(clientView.body.data).toHaveLength(1);
    expect(clientView.body.data[0].body).toBe('Client-visible message');

    const staffView = await authGet(
      `${BASE}/${created.id}/comments`,
      podManager.token,
      organization.id,
    ).expect(200);
    expect(staffView.body.data).toHaveLength(2);
  });
});

describe('deliverables and the human sign-off boundary', () => {
  async function seedDeliverable() {
    const organization = await createOrganization();
    const owner = await createMember({ organizationId: organization.id, roles: ['CLIENT_OWNER'] });
    const approver = await createMember({
      organizationId: organization.id,
      roles: ['CLIENT_APPROVER'],
    });
    const specialist = await createStaff('SPECIALIST');
    const request_ = await createRequest(owner.token, organization.id);

    const created = await authPost(
      `${BASE}/${request_.id}/deliverables`,
      specialist.token,
      { title: 'Migration report' },
      organization.id,
    ).expect(201);

    return { organization, owner, approver, specialist, request: request_, deliverable: created.body.data };
  }

  it('lets a specialist produce a deliverable and the client read it', async () => {
    const seeded = await seedDeliverable();

    const list = await authGet(
      `${BASE}/${seeded.request.id}/deliverables`,
      seeded.owner.token,
      seeded.organization.id,
    ).expect(200);

    expect(list.body.data).toHaveLength(1);
    expect(list.body.data[0].status).toBe('PENDING');
  });

  it('refuses to release before a human approves', async () => {
    const seeded = await seedDeliverable();

    const response = await authPatch(
      `${BASE}/${seeded.request.id}/deliverables/${seeded.deliverable.id}/status`,
      seeded.approver.token,
      { status: 'RELEASED' },
      seeded.organization.id,
    ).expect(403);

    expect(response.body.error.message).toContain('approved');
  });

  it('approves with a named human, then releases', async () => {
    const seeded = await seedDeliverable();
    const path = `${BASE}/${seeded.request.id}/deliverables/${seeded.deliverable.id}/status`;

    const approved = await authPatch(
      path,
      seeded.approver.token,
      { status: 'APPROVED' },
      seeded.organization.id,
    ).expect(200);

    expect(approved.body.data.status).toBe('APPROVED');
    expect(approved.body.data.approvedById).toBe(seeded.approver.userId);
    expect(approved.body.data.approvedAt).not.toBeNull();

    const released = await authPatch(
      path,
      seeded.approver.token,
      { status: 'RELEASED' },
      seeded.organization.id,
    ).expect(200);

    expect(released.body.data.status).toBe('RELEASED');
    expect(released.body.data.releasedAt).not.toBeNull();
  });

  it('blocks an AI actor from touching deliverable status at all', async () => {
    const seeded = await seedDeliverable();

    const response = await authPatch(
      `${BASE}/${seeded.request.id}/deliverables/${seeded.deliverable.id}/status`,
      seeded.approver.token,
      { status: 'APPROVED' },
      seeded.organization.id,
    )
      .set('x-actor-type', 'AI_AGENT')
      .expect(403);

    expect(response.body.error.message).toContain('human must approve');
  });

  it('refuses deliverable review to a role without deliverable:review', async () => {
    const seeded = await seedDeliverable();

    await authPatch(
      `${BASE}/${seeded.request.id}/deliverables/${seeded.deliverable.id}/status`,
      seeded.specialist.token,
      { status: 'APPROVED' },
      seeded.organization.id,
    ).expect(403);
  });
});

describe('multi-tenant isolation over HTTP', () => {
  async function twoTenants() {
    const tenantA = await createOrganization({ slug: uniqSlug('iso-a') });
    const tenantB = await createOrganization({ slug: uniqSlug('iso-b') });
    const ownerA = await createMember({ organizationId: tenantA.id, roles: ['CLIENT_OWNER'] });
    const ownerB = await createMember({ organizationId: tenantB.id, roles: ['CLIENT_OWNER'] });

    const requestB = await createRequest(ownerB.token, tenantB.id, {
      ...REQUEST_BODY,
      title: 'Tenant B only',
    });

    return { tenantA, tenantB, ownerA, ownerB, requestB };
  }

  it('returns 404 for another tenant’s request', async () => {
    const { tenantA, ownerA, requestB } = await twoTenants();

    const response = await authGet(`${BASE}/${requestB.id}`, ownerA.token, tenantA.id).expect(404);
    expect(response.body.error.code).toBe('NOT_FOUND');
  });

  it('cannot patch another tenant’s request, and leaves it untouched', async () => {
    const { tenantA, ownerA, requestB } = await twoTenants();

    await authPatch(
      `${BASE}/${requestB.id}`,
      ownerA.token,
      { title: 'Hijacked' },
      tenantA.id,
    ).expect(404);

    const row = await prisma.serviceRequest.findUniqueOrThrow({ where: { id: requestB.id } });
    expect(row.title).toBe('Tenant B only');
  });

  it('cannot comment on, or list deliverables of, another tenant’s request', async () => {
    const { tenantA, ownerA, requestB } = await twoTenants();

    await authPost(
      `${BASE}/${requestB.id}/comments`,
      ownerA.token,
      { body: 'Cross-tenant comment' },
      tenantA.id,
    ).expect(404);

    await authGet(`${BASE}/${requestB.id}/deliverables`, ownerA.token, tenantA.id).expect(404);

    const commentCount = await prisma.requestComment.count();
    expect(commentCount).toBe(0);
  });

  it('lists only its own tenant’s requests', async () => {
    const { tenantA, tenantB, ownerA, ownerB } = await twoTenants();
    await createRequest(ownerA.token, tenantA.id, { ...REQUEST_BODY, title: 'Tenant A only' });

    const listA = await authGet(BASE, ownerA.token, tenantA.id).expect(200);
    const listB = await authGet(BASE, ownerB.token, tenantB.id).expect(200);

    expect(listA.body.data.total).toBe(1);
    expect(listA.body.data.items[0].title).toBe('Tenant A only');
    expect(listB.body.data.total).toBe(1);
    expect(listB.body.data.items[0].title).toBe('Tenant B only');
  });

  it('cannot move a deliverable across tenants', async () => {
    const { tenantA, ownerA, requestB } = await twoTenants();
    const specialist = await createStaff('SPECIALIST');

    const deliverable = await authPost(
      `${BASE}/${requestB.id}/deliverables`,
      specialist.token,
      { title: 'Tenant B deliverable' },
      tenantA.id,
    );

    // The request does not exist in tenant A, so creation is refused outright.
    expect(deliverable.status).toBe(404);
  });
});
