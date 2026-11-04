import { describe, expect, it } from 'vitest';
import request from 'supertest';
import {
  API,
  app,
  authGet,
  createOrganization,
  createStaff,
  inviteMember,
  login,
} from './helpers/api';
import { prisma } from '../src/db/client';

/**
 * Invite acceptance: an invited user receives a one-time token, sets a password,
 * activates their account and is logged in — then the token is dead.
 *
 * The token is the only credential on these routes, so the negative cases matter
 * at least as much as the happy path.
 */
const NEW_PASSWORD = 'Sunrise-Over-Chennai-7';

describe('invite → activation → login', () => {
  it('completes the whole flow and leaves the user able to log in', async () => {
    const organization = await createOrganization({ name: 'Helios Cloud', slug: 'helios-cloud' });
    const admin = await createStaff('PLATFORM_ADMIN');
    const invite = await inviteMember({
      organizationId: organization.id,
      adminToken: admin.token,
      roles: ['CLIENT_OWNER'],
    });

    // 1. The invited user cannot log in yet — no password exists.
    await request(app)
      .post(`${API}/auth/login`)
      .send({ email: invite.email, password: NEW_PASSWORD })
      .expect(401);

    // 2. Token preview works before authentication, with the email masked.
    const preview = await request(app).get(`${API}/auth/invite/${invite.inviteToken}`).expect(200);

    expect(preview.body.data).toMatchObject({
      organizationName: 'Helios Cloud',
      roles: ['CLIENT_OWNER'],
      fullName: 'Invited Person',
    });
    expect(preview.body.data.email).not.toBe(invite.email);
    expect(preview.body.data.email).toContain('@');
    expect(preview.body.data.email).toContain('•');

    // 3. Accept the invitation: sets the password and issues a session.
    const accepted = await request(app)
      .post(`${API}/auth/accept-invite`)
      .send({ token: invite.inviteToken, password: NEW_PASSWORD })
      .expect(200);

    expect(accepted.body.data).toMatchObject({
      tokenType: 'Bearer',
      accessToken: expect.any(String),
      organizationId: organization.id,
      organizationName: 'Helios Cloud',
      roles: ['CLIENT_OWNER'],
      actor: {
        email: invite.email,
        kind: 'CLIENT',
        platformRole: null,
      },
    });

    // 4. The session issued by acceptance already works against a tenant route.
    await authGet(
      `${API}/organizations/${organization.id}`,
      accepted.body.data.accessToken as string,
      organization.id,
    ).expect(200);

    // 5. The credentials now work directly.
    const token = await login(invite.email, NEW_PASSWORD);
    expect(token.split('.')).toHaveLength(3);

    // 6. Password is stored as a scrypt digest, never in plain text.
    const user = await prisma.user.findUniqueOrThrow({ where: { id: invite.userId } });
    expect(user.passwordHash).not.toBe(NEW_PASSWORD);
    expect(user.passwordHash?.startsWith('scrypt$')).toBe(true);
    expect(user.status).toBe('ACTIVE');

    // 7. The membership is active and the token has been burned.
    const membership = await prisma.membership.findUniqueOrThrow({
      where: { id: invite.membershipId },
    });
    expect(membership.status).toBe('ACTIVE');
    expect(membership.inviteTokenHash).toBeNull();
    expect(membership.inviteAcceptedAt).not.toBeNull();

    // 8. Both audit events exist.
    const actions = await prisma.auditEvent.findMany({
      where: { organizationId: organization.id },
      select: { action: true },
    });
    expect(actions.map((event) => event.action).sort()).toEqual([
      'membership.invite_accepted',
      'membership.invited',
      'organization.created',
    ]);
  });
});

describe('invite token is single-use', () => {
  it('rejects a second acceptance of the same token', async () => {
    const organization = await createOrganization();
    const admin = await createStaff('PLATFORM_ADMIN');
    const invite = await inviteMember({ organizationId: organization.id, adminToken: admin.token });

    await request(app)
      .post(`${API}/auth/accept-invite`)
      .send({ token: invite.inviteToken, password: NEW_PASSWORD })
      .expect(200);

    const replay = await request(app)
      .post(`${API}/auth/accept-invite`)
      .send({ token: invite.inviteToken, password: 'Another-Password-9' })
      .expect(400);

    expect(replay.body.error.code).toBe('INVITE_INVALID');
  });

  it('hides the preview after acceptance', async () => {
    const organization = await createOrganization();
    const admin = await createStaff('PLATFORM_ADMIN');
    const invite = await inviteMember({ organizationId: organization.id, adminToken: admin.token });

    await request(app)
      .post(`${API}/auth/accept-invite`)
      .send({ token: invite.inviteToken, password: NEW_PASSWORD })
      .expect(200);

    const preview = await request(app).get(`${API}/auth/invite/${invite.inviteToken}`).expect(400);
    expect(preview.body.error.code).toBe('INVITE_INVALID');
  });

  it('lets exactly one of two concurrent acceptances win', async () => {
    const organization = await createOrganization();
    const admin = await createStaff('PLATFORM_ADMIN');
    const invite = await inviteMember({ organizationId: organization.id, adminToken: admin.token });

    const attempt = (password: string) =>
      request(app)
        .post(`${API}/auth/accept-invite`)
        .send({ token: invite.inviteToken, password });

    const [first, second] = await Promise.all([attempt('Parallel-Password-1'), attempt('Parallel-Password-2')]);

    const codes = [first.status, second.status].sort();
    expect(codes).toEqual([200, 400]);
  });
});

describe('invite rejection paths', () => {
  it('rejects an expired invitation with 410', async () => {
    const organization = await createOrganization();
    const admin = await createStaff('PLATFORM_ADMIN');
    const invite = await inviteMember({ organizationId: organization.id, adminToken: admin.token });

    await prisma.membership.update({
      where: { id: invite.membershipId },
      data: { inviteTokenExpiresAt: new Date(Date.now() - 60_000) },
    });

    const preview = await request(app).get(`${API}/auth/invite/${invite.inviteToken}`).expect(410);
    expect(preview.body.error.code).toBe('INVITE_EXPIRED');

    const accepted = await request(app)
      .post(`${API}/auth/accept-invite`)
      .send({ token: invite.inviteToken, password: NEW_PASSWORD })
      .expect(410);
    expect(accepted.body.error.code).toBe('INVITE_EXPIRED');
  });

  it('rejects an invitation whose membership was revoked', async () => {
    const organization = await createOrganization();
    const admin = await createStaff('PLATFORM_ADMIN');
    const invite = await inviteMember({ organizationId: organization.id, adminToken: admin.token });

    await prisma.membership.update({
      where: { id: invite.membershipId },
      data: { status: 'REVOKED' },
    });

    const response = await request(app)
      .post(`${API}/auth/accept-invite`)
      .send({ token: invite.inviteToken, password: NEW_PASSWORD })
      .expect(400);

    expect(response.body.error.code).toBe('INVITE_INVALID');
    expect(response.body.error.message).toContain('revoked');
  });

  it('rejects an unknown token with a valid shape', async () => {
    const fabricated = 'A'.repeat(43);

    const response = await request(app).get(`${API}/auth/invite/${fabricated}`).expect(400);
    expect(response.body.error.code).toBe('INVITE_INVALID');
  });

  it('rejects a malformed token', async () => {
    const response = await request(app).get(`${API}/auth/invite/not..a..token`).expect(400);
    expect(response.body.error.code).toBe('INVITE_INVALID');
  });

  it('enforces the password policy and reports the failing rule', async () => {
    const organization = await createOrganization();
    const admin = await createStaff('PLATFORM_ADMIN');
    const invite = await inviteMember({ organizationId: organization.id, adminToken: admin.token });

    const tooShort = await request(app)
      .post(`${API}/auth/accept-invite`)
      .send({ token: invite.inviteToken, password: 'short1' })
      .expect(400);

    expect(tooShort.body.error.code).toBe('VALIDATION_ERROR');
    expect(tooShort.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: 'password' })]),
    );

    const noDigit = await request(app)
      .post(`${API}/auth/accept-invite`)
      .send({ token: invite.inviteToken, password: 'onlylettershere' })
      .expect(400);

    expect(noDigit.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: 'password' })]),
    );

    // The invitation is still usable after a rejected attempt.
    await request(app)
      .post(`${API}/auth/accept-invite`)
      .send({ token: invite.inviteToken, password: NEW_PASSWORD })
      .expect(200);
  });

  it('does not leave a half-activated account when the password is rejected', async () => {
    const organization = await createOrganization();
    const admin = await createStaff('PLATFORM_ADMIN');
    const invite = await inviteMember({ organizationId: organization.id, adminToken: admin.token });

    await request(app)
      .post(`${API}/auth/accept-invite`)
      .send({ token: invite.inviteToken, password: 'short1' })
      .expect(400);

    const user = await prisma.user.findUniqueOrThrow({ where: { id: invite.userId } });
    const membership = await prisma.membership.findUniqueOrThrow({
      where: { id: invite.membershipId },
    });

    expect(user.status).toBe('INVITED');
    expect(user.passwordHash).toBeNull();
    expect(membership.status).toBe('INVITED');
    expect(membership.inviteTokenHash).not.toBeNull();
  });
});
