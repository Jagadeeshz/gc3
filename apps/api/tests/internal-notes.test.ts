import { describe, expect, it } from 'vitest';
import {
  API,
  authGet,
  authPost,
  createMember,
  createOrganization,
  createStaff,
} from './helpers/api';

interface CommentShape {
  id: string;
  body: string;
  isInternal: boolean;
}

async function seedRequest(organizationId: string, token: string) {
  const response = await authPost(
    `${API}/service-requests`,
    token,
    {
      title: 'Request with a comment thread',
      description: 'Enough description to satisfy the request contract.',
      priority: 'NORMAL',
      status: 'SUBMITTED',
    },
    organizationId,
  ).expect(201);

  return response.body.data as { id: string };
}

function postComment(
  organizationId: string,
  token: string,
  requestId: string,
  body: string,
  isInternal: boolean,
) {
  // Returns the supertest request itself (not a promise) so callers can chain
  // `.expect(...)`.
  return authPost(
    `${API}/service-requests/${requestId}/comments`,
    token,
    { body, isInternal },
    organizationId,
  );
}

describe('internal note privacy', () => {
  it('stores an internal note for staff and hides it from the client', async () => {
    const organization = await createOrganization();
    const staff = await createStaff('POD_MANAGER');
    const client = await createMember({
      organizationId: organization.id,
      roles: ['CLIENT_OWNER'],
    });
    const request = await seedRequest(organization.id, staff.token);

    await postComment(
      organization.id,
      staff.token,
      request.id,
      'Margin on this account is thin — do not promise extra scope.',
      true,
    ).expect(201);

    await postComment(
      organization.id,
      client.token,
      request.id,
      'When can we expect the first draft?',
      false,
    ).expect(201);

    const staffView = await authGet(
      `${API}/service-requests/${request.id}/comments`,
      staff.token,
      organization.id,
    ).expect(200);

    const staffComments = staffView.body.data as CommentShape[];
    expect(staffComments).toHaveLength(2);
    expect(staffComments.filter((comment) => comment.isInternal)).toHaveLength(1);

    const clientView = await authGet(
      `${API}/service-requests/${request.id}/comments`,
      client.token,
      organization.id,
    ).expect(200);

    const clientComments = clientView.body.data as CommentShape[];
    expect(clientComments).toHaveLength(1);
    expect(clientComments[0]?.body).toBe('When can we expect the first draft?');

    // The note must not survive anywhere in the client's payload — not the list,
    // not a hidden field.
    expect(JSON.stringify(clientView.body)).not.toContain('Margin on this account');
  });

  it('downgrades an internal flag sent by a client instead of rejecting it', async () => {
    const organization = await createOrganization();
    const staff = await createStaff('PLATFORM_ADMIN');
    const client = await createMember({
      organizationId: organization.id,
      roles: ['CLIENT_TEAM_MEMBER'],
    });
    const request = await seedRequest(organization.id, staff.token);

    const response = await postComment(
      organization.id,
      client.token,
      request.id,
      'Trying to write a private note as a client.',
      true,
    ).expect(201);

    // Accepted, but not stored as internal: a client cannot author staff-only text.
    expect(response.body.data.isInternal).toBe(false);

    const staffView = await authGet(
      `${API}/service-requests/${request.id}/comments`,
      staff.token,
      organization.id,
    ).expect(200);

    const stored = (staffView.body.data as CommentShape[]).find((comment) =>
      comment.body.startsWith('Trying to write a private note'),
    );

    expect(stored?.isInternal).toBe(false);
  });

  it('marks a staff comment as client-visible unless the flag is set', async () => {
    const organization = await createOrganization();
    const admin = await createStaff('PLATFORM_ADMIN');
    // ACCOUNT_MANAGER can comment but cannot raise requests, so an admin seeds one.
    const accountManager = await createStaff('ACCOUNT_MANAGER');
    const request = await seedRequest(organization.id, admin.token);

    const response = await authPost(
      `${API}/service-requests/${request.id}/comments`,
      accountManager.token,
      { body: 'Kickoff scheduled for Monday.' },
      organization.id,
    ).expect(201);

    expect(response.body.data.isInternal).toBe(false);
  });

  it('never leaks another tenant’s internal notes', async () => {
    const mine = await createOrganization();
    const theirs = await createOrganization();
    const staff = await createStaff('PLATFORM_ADMIN');

    const theirRequest = await seedRequest(theirs.id, staff.token);

    await postComment(
      theirs.id,
      staff.token,
      theirRequest.id,
      'Tenant B private remark.',
      true,
    ).expect(201);

    await authGet(
      `${API}/service-requests/${theirRequest.id}/comments`,
      staff.token,
      mine.id,
    ).expect(404);
  });
});
