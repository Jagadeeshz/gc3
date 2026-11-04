import { describe, expect, it } from 'vitest';
import { prisma } from '../src/db/client';
import { serviceCategoryRepository } from '../src/repositories/service-category.repository';
import { serviceRequestRepository } from '../src/repositories/service-request.repository';
import { requestCommentRepository } from '../src/repositories/request-comment.repository';
import { deliverableRepository } from '../src/repositories/deliverable.repository';

/**
 * Phase 2 data layer — multi-tenant isolation.
 *
 * These tests exercise the repositories directly (no HTTP), because the rule
 * under test lives in the query layer: every method takes a tenant scope first
 * and filters on it. If a future handler forgets the scope, there is no
 * unscoped method for it to call.
 */
let seq = 0;
function next(tag: string): string {
  seq += 1;
  return `${tag}-${seq}`;
}

async function makeTenant(tag: string) {
  const slug = next(tag);
  return prisma.organization.create({ data: { name: `Tenant ${slug}`, slug } });
}

async function makeUser(tag: string) {
  const suffix = next(tag);
  return prisma.user.create({
    data: {
      email: `${suffix}@gc3.test`,
      fullName: `User ${suffix}`,
      status: 'ACTIVE',
    },
  });
}

async function seedRequest(organizationId: string, requesterId: string, title = 'A request') {
  return serviceRequestRepository.createScoped(organizationId, {
    title,
    description: 'Body copy',
    requesterId,
  });
}

describe('service categories', () => {
  it('scopes slugs per tenant: the same slug works in two organizations', async () => {
    const a = await makeTenant('cat-a');
    const b = await makeTenant('cat-b');

    await serviceCategoryRepository.createScoped(a.id, { name: 'Cloud Ops', slug: 'cloud-ops' });
    await serviceCategoryRepository.createScoped(b.id, { name: 'Cloud Ops', slug: 'cloud-ops' });

    const listA = await serviceCategoryRepository.listScoped(a.id);
    const listB = await serviceCategoryRepository.listScoped(b.id);

    expect(listA).toHaveLength(1);
    expect(listB).toHaveLength(1);
    expect(listA[0]?.organizationId).toBe(a.id);
    expect(listB[0]?.organizationId).toBe(b.id);
  });

  it('rejects a duplicate slug inside the same tenant', async () => {
    const tenant = await makeTenant('cat-dup');
    await serviceCategoryRepository.createScoped(tenant.id, { name: 'Data', slug: 'data' });

    await expect(
      serviceCategoryRepository.createScoped(tenant.id, { name: 'Data again', slug: 'data' }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('hides a soft-deleted category from reads and lists', async () => {
    const tenant = await makeTenant('cat-del');
    const category = await serviceCategoryRepository.createScoped(tenant.id, {
      name: 'Retired',
      slug: 'retired',
    });

    expect(await serviceCategoryRepository.softDeleteScoped(tenant.id, category.id)).toBe(true);
    expect(await serviceCategoryRepository.findByIdScoped(tenant.id, category.id)).toBeNull();
    expect(await serviceCategoryRepository.listScoped(tenant.id)).toHaveLength(0);

    // A foreign tenant can never delete it in the first place.
    const other = await makeTenant('cat-other');
    const fresh = await serviceCategoryRepository.createScoped(other.id, {
      name: 'Live',
      slug: 'live',
    });
    expect(await serviceCategoryRepository.softDeleteScoped(tenant.id, fresh.id)).toBe(false);
  });
});

describe('service requests — tenant isolation', () => {
  it('creates a request with a per-tenant reference and DRAFT defaults', async () => {
    const tenant = await makeTenant('req-create');
    const user = await makeUser('requester');

    const request = await serviceRequestRepository.createScoped(tenant.id, {
      title: 'Migrate the data warehouse',
      description: 'Lift and shift plus a schema review',
      requesterId: user.id,
    });

    expect(request.organizationId).toBe(tenant.id);
    expect(request.reference).toMatch(/^REQ-[0-9A-F]{8}$/);
    expect(request.status).toBe('DRAFT');
    expect(request.priority).toBe('NORMAL');
    expect(request.submittedAt).toBeNull();
    expect(request.closedAt).toBeNull();

    const persisted = await prisma.serviceRequest.findUnique({ where: { id: request.id } });
    expect(persisted?.organizationId).toBe(tenant.id);
  });

  it('stamps submittedAt when a request is created in a non-draft state', async () => {
    const tenant = await makeTenant('req-submit');
    const user = await makeUser('requester');

    const request = await serviceRequestRepository.createScoped(tenant.id, {
      title: 'Submit immediately',
      description: 'x',
      requesterId: user.id,
      status: 'SUBMITTED',
      priority: 'HIGH',
    });

    expect(request.status).toBe('SUBMITTED');
    expect(request.priority).toBe('HIGH');
    expect(request.submittedAt).not.toBeNull();
  });

  it('never returns another tenant’s request by id', async () => {
    const a = await makeTenant('req-a');
    const b = await makeTenant('req-b');
    const user = await makeUser('requester');

    const theirs = await seedRequest(b.id, user.id, 'B only');

    expect(await serviceRequestRepository.findByIdScoped(a.id, theirs.id)).toBeNull();
    expect(await serviceRequestRepository.findByIdScoped(b.id, theirs.id)).not.toBeNull();
  });

  it('lists only the calling tenant’s requests, and filters within them', async () => {
    const a = await makeTenant('req-list-a');
    const b = await makeTenant('req-list-b');
    const user = await makeUser('requester');

    await seedRequest(a.id, user.id, 'A1');
    await seedRequest(a.id, user.id, 'A2');
    const a3 = await seedRequest(a.id, user.id, 'A3');
    await seedRequest(b.id, user.id, 'B1');

    await serviceRequestRepository.updateStatusScoped(a.id, a3.id, 'IN_PROGRESS');

    const allA = await serviceRequestRepository.listScoped(a.id);
    expect(allA.total).toBe(3);
    expect(allA.items.every((item) => item.organizationId === a.id)).toBe(true);

    const inProgress = await serviceRequestRepository.listScoped(a.id, { status: 'IN_PROGRESS' });
    expect(inProgress.total).toBe(1);
    expect(inProgress.items[0]?.title).toBe('A3');

    const paged = await serviceRequestRepository.listScoped(a.id, { page: 2, pageSize: 2 });
    expect(paged.items).toHaveLength(1);
    expect(paged.total).toBe(3);

    const allB = await serviceRequestRepository.listScoped(b.id);
    expect(allB.total).toBe(1);
    expect(allB.items[0]?.title).toBe('B1');
  });

  it('refuses to attach a category belonging to another tenant', async () => {
    const a = await makeTenant('req-cat-a');
    const b = await makeTenant('req-cat-b');
    const user = await makeUser('requester');

    const foreignCategory = await serviceCategoryRepository.createScoped(b.id, {
      name: 'Foreign',
      slug: 'foreign',
    });

    await expect(
      serviceRequestRepository.createScoped(a.id, {
        title: 'Cross-tenant category',
        description: 'x',
        requesterId: user.id,
        categoryId: foreignCategory.id,
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });

    // And the legitimate case still works.
    const ownCategory = await serviceCategoryRepository.createScoped(a.id, {
      name: 'Own',
      slug: 'own',
    });
    const request = await serviceRequestRepository.createScoped(a.id, {
      title: 'Own category',
      description: 'x',
      requesterId: user.id,
      categoryId: ownCategory.id,
    });
    expect(request.categoryId).toBe(ownCategory.id);
  });

  it('cannot change the status of another tenant’s request', async () => {
    const a = await makeTenant('req-upd-a');
    const b = await makeTenant('req-upd-b');
    const user = await makeUser('requester');

    const theirs = await seedRequest(b.id, user.id, 'B request');

    const result = await serviceRequestRepository.updateStatusScoped(a.id, theirs.id, 'CLOSED');
    expect(result).toBeNull();

    const unchanged = await prisma.serviceRequest.findUniqueOrThrow({ where: { id: theirs.id } });
    expect(unchanged.status).toBe('DRAFT');
    expect(unchanged.closedAt).toBeNull();
  });

  it('stamps submittedAt and closedAt across the lifecycle', async () => {
    const tenant = await makeTenant('req-flow');
    const user = await makeUser('requester');
    const request = await seedRequest(tenant.id, user.id);

    const submitted = await serviceRequestRepository.updateStatusScoped(
      tenant.id,
      request.id,
      'SUBMITTED',
    );
    expect(submitted?.submittedAt).not.toBeNull();
    expect(submitted?.closedAt).toBeNull();

    const closed = await serviceRequestRepository.updateStatusScoped(tenant.id, request.id, 'CLOSED');
    expect(closed?.closedAt).not.toBeNull();

    // Re-opening clears closedAt rather than leaving a stale timestamp.
    const reopened = await serviceRequestRepository.updateStatusScoped(
      tenant.id,
      request.id,
      'IN_PROGRESS',
    );
    expect(reopened?.closedAt).toBeNull();
  });

  it('hides soft-deleted requests from reads and lists', async () => {
    const tenant = await makeTenant('req-del');
    const user = await makeUser('requester');
    const request = await seedRequest(tenant.id, user.id);

    expect(await serviceRequestRepository.softDeleteScoped(tenant.id, request.id)).toBe(true);
    expect(await serviceRequestRepository.findByIdScoped(tenant.id, request.id)).toBeNull();
    expect((await serviceRequestRepository.listScoped(tenant.id)).total).toBe(0);
  });
});

describe('request comments — tenant isolation', () => {
  it('rejects a comment on another tenant’s request', async () => {
    const a = await makeTenant('cmt-a');
    const b = await makeTenant('cmt-b');
    const author = await makeUser('author');

    const theirs = await seedRequest(b.id, author.id, 'B request');

    await expect(
      requestCommentRepository.createScoped(a.id, {
        requestId: theirs.id,
        authorId: author.id,
        body: 'Trying to comment across tenants',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('keeps internal notes out of the default (client-facing) list', async () => {
    const tenant = await makeTenant('cmt-int');
    const author = await makeUser('author');
    const request = await seedRequest(tenant.id, author.id);

    await requestCommentRepository.createScoped(tenant.id, {
      requestId: request.id,
      authorId: author.id,
      body: 'Visible to the client',
    });
    await requestCommentRepository.createScoped(tenant.id, {
      requestId: request.id,
      authorId: author.id,
      body: 'Internal: client is difficult',
      isInternal: true,
    });

    const clientView = await requestCommentRepository.listForRequestScoped(tenant.id, request.id);
    expect(clientView).toHaveLength(1);
    expect(clientView[0]?.isInternal).toBe(false);

    const staffView = await requestCommentRepository.listForRequestScoped(tenant.id, request.id, {
      includeInternal: true,
    });
    expect(staffView).toHaveLength(2);
  });

  it('does not list comments for a request id from another tenant', async () => {
    const a = await makeTenant('cmt-list-a');
    const b = await makeTenant('cmt-list-b');
    const author = await makeUser('author');

    const theirs = await seedRequest(b.id, author.id, 'B request');
    await requestCommentRepository.createScoped(b.id, {
      requestId: theirs.id,
      authorId: author.id,
      body: 'Tenant B only',
    });

    const leaked = await requestCommentRepository.listForRequestScoped(a.id, theirs.id, {
      includeInternal: true,
    });
    expect(leaked).toHaveLength(0);
  });
});

describe('deliverables — tenant isolation and approval rules', () => {
  it('rejects a deliverable attached to another tenant’s request', async () => {
    const a = await makeTenant('dlv-a');
    const b = await makeTenant('dlv-b');
    const user = await makeUser('requester');

    const theirs = await seedRequest(b.id, user.id, 'B request');

    await expect(
      deliverableRepository.createScoped(a.id, { title: 'Cross-tenant output', requestId: theirs.id }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('scopes deliverable lists to the tenant', async () => {
    const a = await makeTenant('dlv-list-a');
    const b = await makeTenant('dlv-list-b');
    const user = await makeUser('requester');

    const requestA = await seedRequest(a.id, user.id, 'A request');
    const requestB = await seedRequest(b.id, user.id, 'B request');

    await deliverableRepository.createScoped(a.id, { title: 'A output', requestId: requestA.id });
    await deliverableRepository.createScoped(b.id, { title: 'B output', requestId: requestB.id });

    const listA = await deliverableRepository.listForRequestScoped(a.id, requestA.id);
    expect(listA).toHaveLength(1);
    expect(listA[0]?.title).toBe('A output');

    const crossRead = await deliverableRepository.listForRequestScoped(a.id, requestB.id);
    expect(crossRead).toHaveLength(0);
  });

  it('requires a named human to approve', async () => {
    const tenant = await makeTenant('dlv-approve');
    const user = await makeUser('approver');
    const deliverable = await deliverableRepository.createScoped(tenant.id, { title: 'Report' });

    await expect(
      deliverableRepository.setStatusScoped(tenant.id, deliverable.id, 'APPROVED'),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    const approved = await deliverableRepository.setStatusScoped(
      tenant.id,
      deliverable.id,
      'APPROVED',
      user.id,
    );
    expect(approved?.status).toBe('APPROVED');
    expect(approved?.approvedById).toBe(user.id);
    expect(approved?.approvedAt).not.toBeNull();
  });

  it('refuses to release a deliverable that has no human approval', async () => {
    const tenant = await makeTenant('dlv-release');
    const user = await makeUser('approver');
    const deliverable = await deliverableRepository.createScoped(tenant.id, { title: 'Deck' });

    await expect(
      deliverableRepository.setStatusScoped(tenant.id, deliverable.id, 'RELEASED'),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });

    const approved = await deliverableRepository.setStatusScoped(
      tenant.id,
      deliverable.id,
      'APPROVED',
      user.id,
    );
    const released = await deliverableRepository.setStatusScoped(
      tenant.id,
      deliverable.id,
      'RELEASED',
    );

    expect(released?.status).toBe('RELEASED');
    expect(released?.releasedAt).not.toBeNull();
    expect(released?.approvedById).toBe(approved?.approvedById);
  });

  it('cannot touch a deliverable belonging to another tenant', async () => {
    const a = await makeTenant('dlv-x-a');
    const b = await makeTenant('dlv-x-b');

    const theirs = await deliverableRepository.createScoped(b.id, { title: 'B only' });

    expect(await deliverableRepository.findByIdScoped(a.id, theirs.id)).toBeNull();
    expect(
      await deliverableRepository.setStatusScoped(a.id, theirs.id, 'IN_PROGRESS'),
    ).toBeNull();

    const unchanged = await prisma.deliverable.findUniqueOrThrow({ where: { id: theirs.id } });
    expect(unchanged.status).toBe('PENDING');
  });
});
