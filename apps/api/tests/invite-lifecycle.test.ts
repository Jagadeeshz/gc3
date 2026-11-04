import { describe, expect, it } from 'vitest';
import request from 'supertest';
import {
  API,
  app,
  authPost,
  createMember,
  createOrganization,
  createStaff,
  inviteMember,
  ORG_HEADER,
} from './helpers/api';
import { prisma } from '../src/db/client';
import { getOutbox, resetNotificationService, setNotificationService } from '../src/notifications';
import { FailingNotificationService, NoopNotificationService } from '../src/notifications/drivers';

const PASSWORD = 'Harbour-Lights-42';

/** DELETE with bearer auth and tenant scope. */
function authDelete(path: string, token: string, organizationId: string) {
  return request(app)
    .delete(path)
    .set('authorization', `Bearer ${token}`)
    .set(ORG_HEADER, organizationId);
}

describe('invite resend — token rotation', () => {
  it('rotates the token: the old link dies, the new one works', async () => {
    const organization = await createOrganization();
    const admin = await createStaff('PLATFORM_ADMIN');
    const invite = await inviteMember({ organizationId: organization.id, adminToken: admin.token });

    const resend = await authPost(
      `${API}/organizations/${organization.id}/memberships/${invite.userId}/invite/resend`,
      admin.token,
      {},
      organization.id,
    ).expect(200);

    const newToken = resend.body.data.inviteToken as string;
    expect(newToken).toBeTruthy();
    expect(newToken).not.toBe(invite.inviteToken);
    expect(resend.body.data.status).toBe('INVITED');
    expect(resend.body.data.reopened).toBe(false);

    // Old link is dead, new one is live.
    await request(app).get(`${API}/auth/invite/${invite.inviteToken}`).expect(400);
    await request(app).get(`${API}/auth/invite/${newToken}`).expect(200);

    // Only the new token can activate the account.
    const accepted = await request(app)
      .post(`${API}/auth/accept-invite`)
      .send({ token: newToken, password: PASSWORD })
      .expect(200);
    expect(accepted.body.data.organizationId).toBe(organization.id);

    const revokedOld = await request(app)
      .post(`${API}/auth/accept-invite`)
      .send({ token: invite.inviteToken, password: PASSWORD })
      .expect(400);
    expect(revokedOld.body.error.code).toBe('INVITE_INVALID');
  });

  it('extends the expiry window on every rotation', async () => {
    const organization = await createOrganization();
    const admin = await createStaff('PLATFORM_ADMIN');
    const invite = await inviteMember({ organizationId: organization.id, adminToken: admin.token });

    await prisma.membership.update({
      where: { id: invite.membershipId },
      data: { inviteTokenExpiresAt: new Date(Date.now() + 60_000) },
    });

    const resend = await authPost(
      `${API}/organizations/${organization.id}/memberships/${invite.userId}/invite/resend`,
      admin.token,
      {},
      organization.id,
    ).expect(200);

    const expiresAt = new Date(resend.body.data.inviteExpiresAt as string);
    // Default TTL is 7 days — far beyond the 1 minute it had before.
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now() + 6 * 24 * 60 * 60 * 1000);
  });

  it('records a resend audit event', async () => {
    const organization = await createOrganization();
    const admin = await createStaff('PLATFORM_ADMIN');
    const invite = await inviteMember({ organizationId: organization.id, adminToken: admin.token });

    await authPost(
      `${API}/organizations/${organization.id}/memberships/${invite.userId}/invite/resend`,
      admin.token,
      {},
      organization.id,
    ).expect(200);

    const actions = await prisma.auditEvent.findMany({
      where: { organizationId: organization.id },
      select: { action: true },
    });
    expect(actions.map((event) => event.action)).toContain('membership.invite_resent');
  });

  it('re-opens a revoked invitation instead of dead-ending it', async () => {
    const organization = await createOrganization();
    const admin = await createStaff('PLATFORM_ADMIN');
    const invite = await inviteMember({ organizationId: organization.id, adminToken: admin.token });

    await authDelete(
      `${API}/organizations/${organization.id}/memberships/${invite.userId}/invite`,
      admin.token,
      organization.id,
    ).expect(200);

    const resend = await authPost(
      `${API}/organizations/${organization.id}/memberships/${invite.userId}/invite/resend`,
      admin.token,
      {},
      organization.id,
    ).expect(200);

    expect(resend.body.data.reopened).toBe(true);
    expect(resend.body.data.status).toBe('INVITED');

    await request(app)
      .post(`${API}/auth/accept-invite`)
      .send({ token: resend.body.data.inviteToken as string, password: PASSWORD })
      .expect(200);
  });

  it('refuses to resend for an already active member (409)', async () => {
    const organization = await createOrganization();
    const admin = await createStaff('PLATFORM_ADMIN');
    const member = await createMember({
      organizationId: organization.id,
      roles: ['CLIENT_OWNER'],
    });

    const response = await authPost(
      `${API}/organizations/${organization.id}/memberships/${member.userId}/invite/resend`,
      admin.token,
      {},
      organization.id,
    ).expect(409);

    expect(response.body.error.code).toBe('CONFLICT');
  });

  it('returns 404 for a user with no membership in this tenant', async () => {
    const organization = await createOrganization();
    const admin = await createStaff('PLATFORM_ADMIN');
    const ghost = '99999999-8888-4777-8666-555555555555';

    await authPost(
      `${API}/organizations/${organization.id}/memberships/${ghost}/invite/resend`,
      admin.token,
      {},
      organization.id,
    ).expect(404);
  });

  it('is forbidden for a role without membership:invite', async () => {
    const organization = await createOrganization();
    const admin = await createStaff('PLATFORM_ADMIN');
    const invite = await inviteMember({ organizationId: organization.id, adminToken: admin.token });
    const approver = await createMember({
      organizationId: organization.id,
      roles: ['CLIENT_APPROVER'],
    });

    await authPost(
      `${API}/organizations/${organization.id}/memberships/${invite.userId}/invite/resend`,
      approver.token,
      {},
      organization.id,
    ).expect(403);
  });
});

describe('invite revocation', () => {
  it('revokes a pending invitation and destroys the token', async () => {
    const organization = await createOrganization();
    const admin = await createStaff('PLATFORM_ADMIN');
    const invite = await inviteMember({ organizationId: organization.id, adminToken: admin.token });

    const response = await authDelete(
      `${API}/organizations/${organization.id}/memberships/${invite.userId}/invite`,
      admin.token,
      organization.id,
    ).expect(200);

    expect(response.body.data.membership.status).toBe('REVOKED');
    expect(response.body.data.alreadyRevoked).toBe(false);

    const row = await prisma.membership.findUniqueOrThrow({ where: { id: invite.membershipId } });
    expect(row.inviteTokenHash).toBeNull();

    // Neither the preview nor acceptance honours the dead token.
    await request(app).get(`${API}/auth/invite/${invite.inviteToken}`).expect(400);
    await request(app)
      .post(`${API}/auth/accept-invite`)
      .send({ token: invite.inviteToken, password: PASSWORD })
      .expect(400);

    const actions = await prisma.auditEvent.findMany({
      where: { organizationId: organization.id },
      select: { action: true },
    });
    expect(actions.map((event) => event.action)).toContain('membership.invite_revoked');
  });

  it('is idempotent', async () => {
    const organization = await createOrganization();
    const admin = await createStaff('PLATFORM_ADMIN');
    const invite = await inviteMember({ organizationId: organization.id, adminToken: admin.token });
    const path = `${API}/organizations/${organization.id}/memberships/${invite.userId}/invite`;

    await authDelete(path, admin.token, organization.id).expect(200);
    const second = await authDelete(path, admin.token, organization.id).expect(200);

    expect(second.body.data.alreadyRevoked).toBe(true);
    expect(second.body.data.membership.status).toBe('REVOKED');
  });

  it('refuses to revoke an active member (409)', async () => {
    const organization = await createOrganization();
    const admin = await createStaff('PLATFORM_ADMIN');
    const member = await createMember({ organizationId: organization.id, roles: ['CLIENT_OWNER'] });

    const response = await authDelete(
      `${API}/organizations/${organization.id}/memberships/${member.userId}/invite`,
      admin.token,
      organization.id,
    ).expect(409);

    expect(response.body.error.code).toBe('CONFLICT');
  });

  it('returns 404 for an unknown member', async () => {
    const organization = await createOrganization();
    const admin = await createStaff('PLATFORM_ADMIN');
    const ghost = '99999999-8888-4777-8666-555555555555';

    await authDelete(
      `${API}/organizations/${organization.id}/memberships/${ghost}/invite`,
      admin.token,
      organization.id,
    ).expect(404);
  });

  it('is forbidden for a role without membership:revoke', async () => {
    const organization = await createOrganization();
    const admin = await createStaff('PLATFORM_ADMIN');
    const invite = await inviteMember({ organizationId: organization.id, adminToken: admin.token });
    const teamMember = await createMember({
      organizationId: organization.id,
      roles: ['CLIENT_TEAM_MEMBER'],
    });

    await authDelete(
      `${API}/organizations/${organization.id}/memberships/${invite.userId}/invite`,
      teamMember.token,
      organization.id,
    ).expect(403);
  });
});

describe('notification delivery', () => {
  it('dispatches an invitation with a usable accept link', async () => {
    const organization = await createOrganization({ name: 'Delivery Co' });
    const admin = await createStaff('PLATFORM_ADMIN');
    const invite = await inviteMember({
      organizationId: organization.id,
      adminToken: admin.token,
      roles: ['CLIENT_OWNER'],
    });

    const outbox = getOutbox();
    expect(outbox).toHaveLength(1);

    const message = outbox[0];
    expect(message?.to).toBe(invite.email);
    expect(message?.organizationName).toBe('Delivery Co');
    expect(message?.roles).toEqual(['CLIENT_OWNER']);
    expect(message?.kind).toBe('invitation');
    expect(message?.inviteUrl).toBe(`http://localhost:3000/invite/${invite.inviteToken}`);

    // The link in the email is the one that actually works.
    await request(app).get(`${API}/auth/invite/${invite.inviteToken}`).expect(200);
  });

  it('dispatches again on resend, with the rotated token', async () => {
    const organization = await createOrganization();
    const admin = await createStaff('PLATFORM_ADMIN');
    const invite = await inviteMember({ organizationId: organization.id, adminToken: admin.token });

    const resend = await authPost(
      `${API}/organizations/${organization.id}/memberships/${invite.userId}/invite/resend`,
      admin.token,
      {},
      organization.id,
    ).expect(200);

    const outbox = getOutbox();
    expect(outbox).toHaveLength(2);
    expect(outbox[1]?.kind).toBe('resent');
    expect(outbox[1]?.inviteUrl).toContain(resend.body.data.inviteToken as string);
    expect(outbox[1]?.inviteUrl).not.toBe(outbox[0]?.inviteUrl);
  });

  it('reports a provider failure without losing the invitation', async () => {
    const organization = await createOrganization();
    const admin = await createStaff('PLATFORM_ADMIN');
    setNotificationService(new FailingNotificationService());

    try {
      const response = await authPost(
        `${API}/organizations/${organization.id}/memberships`,
        admin.token,
        { email: 'resilient@acme.example', fullName: 'Resilient Person', roles: ['CLIENT_TEAM_MEMBER'] },
        organization.id,
      ).expect(201);

      expect(response.body.data.delivery).toMatchObject({ status: 'failed', driver: 'failing' });

      // The invitation still exists and the token still works.
      const token = response.body.data.inviteToken as string;
      await request(app).get(`${API}/auth/invite/${token}`).expect(200);
    } finally {
      resetNotificationService();
    }
  });

  it('reports "skipped" for the noop driver instead of pretending to send', async () => {
    const organization = await createOrganization();
    const admin = await createStaff('PLATFORM_ADMIN');
    setNotificationService(new NoopNotificationService());

    try {
      const response = await authPost(
        `${API}/organizations/${organization.id}/memberships`,
        admin.token,
        { email: 'noop@acme.example', fullName: 'No-op Person', roles: ['CLIENT_TEAM_MEMBER'] },
        organization.id,
      ).expect(201);

      expect(response.body.data.delivery).toMatchObject({ status: 'skipped', driver: 'noop' });
      expect(response.body.data.delivery.auditId).toBeTruthy();
      expect(getOutbox()).toHaveLength(0);
    } finally {
      resetNotificationService();
    }
  });
});
