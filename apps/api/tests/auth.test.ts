import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { API, app, authGet, createMember, createOrganization, createStaff, TEST_PASSWORD } from './helpers/api';
import { prisma } from '../src/db/client';
import { hashPassword } from '../src/auth/password';
import { signAccessToken } from '../src/auth/tokens';

describe('POST /api/v1/auth/login', () => {
  it('issues a bearer token and the actor for valid credentials', async () => {
    const staff = await createStaff('PLATFORM_ADMIN');

    const response = await request(app)
      .post(`${API}/auth/login`)
      .send({ email: staff.email, password: staff.password })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data).toMatchObject({
      accessToken: expect.any(String),
      tokenType: 'Bearer',
      expiresIn: expect.any(Number),
      actor: {
        userId: staff.userId,
        email: staff.email,
        kind: 'STAFF',
        platformRole: 'PLATFORM_ADMIN',
      },
    });

    // A JWT is three base64url segments.
    expect((response.body.data.accessToken as string).split('.')).toHaveLength(3);
  });

  it('rejects a wrong password with 401', async () => {
    const staff = await createStaff('PLATFORM_ADMIN');

    const response = await request(app)
      .post(`${API}/auth/login`)
      .send({ email: staff.email, password: 'definitely-not-the-password' })
      .expect(401);

    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('returns the same message for an unknown email (no account enumeration)', async () => {
    const staff = await createStaff('PLATFORM_ADMIN');

    const knownWrong = await request(app)
      .post(`${API}/auth/login`)
      .send({ email: staff.email, password: 'wrong-password' })
      .expect(401);

    const unknown = await request(app)
      .post(`${API}/auth/login`)
      .send({ email: 'nobody@nowhere.test', password: 'wrong-password' })
      .expect(401);

    expect(unknown.body.error.message).toBe(knownWrong.body.error.message);
    expect(unknown.body.error.message).toBe('Invalid email or password');
  });

  it('rejects an invited user who never set a password', async () => {
    await prisma.user.create({
      data: {
        email: 'invited@acme.test',
        fullName: 'Invited Person',
        status: 'INVITED',
        // passwordHash intentionally absent
      },
    });

    const response = await request(app)
      .post(`${API}/auth/login`)
      .send({ email: 'invited@acme.test', password: TEST_PASSWORD })
      .expect(401);

    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('rejects a suspended account even with the correct password', async () => {
    const staff = await createStaff('PLATFORM_ADMIN');

    await prisma.user.update({
      where: { id: staff.userId },
      data: { status: 'SUSPENDED' },
    });

    const response = await request(app)
      .post(`${API}/auth/login`)
      .send({ email: staff.email, password: staff.password })
      .expect(401);

    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('rejects a malformed payload with field-level detail', async () => {
    const response = await request(app)
      .post(`${API}/auth/login`)
      .send({ email: 'not-an-email', password: '' })
      .expect(400);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: 'email' })]),
    );
  });

  it('records lastSeenAt on successful login', async () => {
    const staff = await createStaff('PLATFORM_ADMIN');
    const before = await prisma.user.findUniqueOrThrow({ where: { id: staff.userId } });

    await request(app)
      .post(`${API}/auth/login`)
      .send({ email: staff.email, password: staff.password })
      .expect(200);

    const after = await prisma.user.findUniqueOrThrow({ where: { id: staff.userId } });
    expect(after.lastSeenAt).not.toBeNull();
    expect(after.lastSeenAt?.getTime() ?? 0).toBeGreaterThanOrEqual(
      before.lastSeenAt?.getTime() ?? 0,
    );
  });
});

describe('GET /api/v1/auth/me', () => {
  it('returns the actor and the permissions granted by their staff role', async () => {
    const staff = await createStaff('PLATFORM_ADMIN');

    const response = await authGet(`${API}/auth/me`, staff.token).expect(200);

    expect(response.body.data.actor).toMatchObject({
      userId: staff.userId,
      platformRole: 'PLATFORM_ADMIN',
      kind: 'STAFF',
    });
    expect(response.body.data.permissions).toEqual(
      expect.arrayContaining(['organization:create', 'membership:invite']),
    );
  });

  it('returns no staff permissions for a client-only user', async () => {
    const client = await prisma.user.create({
      data: {
        email: 'client-only@acme.test',
        fullName: 'Client Only',
        status: 'ACTIVE',
        passwordHash: await hashPassword(TEST_PASSWORD),
      },
    });

    const login = await request(app)
      .post(`${API}/auth/login`)
      .send({ email: client.email, password: TEST_PASSWORD })
      .expect(200);

    const response = await authGet(`${API}/auth/me`, login.body.data.accessToken).expect(200);

    expect(response.body.data.actor.kind).toBe('CLIENT');
    expect(response.body.data.permissions).toEqual([]);
  });

  it('rejects a request with no token', async () => {
    const response = await request(app).get(`${API}/auth/me`).expect(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('rejects a malformed authorization header', async () => {
    await request(app).get(`${API}/auth/me`).set('authorization', 'Token abc').expect(401);
    await request(app).get(`${API}/auth/me`).set('authorization', 'Bearer').expect(401);
  });

  it('rejects a tampered token', async () => {
    const staff = await createStaff('PLATFORM_ADMIN');
    const tampered = `${staff.token.slice(0, -3)}abc`;

    const response = await authGet(`${API}/auth/me`, tampered).expect(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('rejects an expired token', async () => {
    const staff = await createStaff('PLATFORM_ADMIN');
    const expired = await signAccessToken(
      { userId: staff.userId, email: staff.email, platformRole: 'PLATFORM_ADMIN' },
      -60,
    );

    const response = await authGet(`${API}/auth/me`, expired.token).expect(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('rejects a token whose user was suspended after issuance', async () => {
    const staff = await createStaff('PLATFORM_ADMIN');

    // Token is valid; the account is disabled afterwards.
    await prisma.user.update({ where: { id: staff.userId }, data: { status: 'SUSPENDED' } });

    const response = await authGet(`${API}/auth/me`, staff.token).expect(401);
    expect(response.body.error.code).toBe('UNAUTHENTICATED');
  });
});

describe('GET /api/v1/auth/organizations', () => {
  it('lists every tenant for staff, with no roles attached', async () => {
    const staff = await createStaff('PLATFORM_ADMIN');
    const first = await createOrganization({ slug: 'picker-a' });
    const second = await createOrganization({ slug: 'picker-b' });

    const response = await authGet(`${API}/auth/organizations`, staff.token).expect(200);

    const ids = (response.body.data as { id: string }[]).map((org) => org.id);
    expect(ids).toEqual(expect.arrayContaining([first.id, second.id]));
    expect(response.body.data[0].roles).toEqual([]);
  });

  it('lists only ACTIVE memberships for a client user', async () => {
    const mine = await createOrganization({ slug: 'picker-mine' });
    const theirs = await createOrganization({ slug: 'picker-theirs' });
    const member = await createMember({ organizationId: mine.id, roles: ['CLIENT_OWNER'] });

    const response = await authGet(`${API}/auth/organizations`, member.token).expect(200);

    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0]).toMatchObject({
      id: mine.id,
      roles: ['CLIENT_OWNER'],
    });
    expect(response.body.data[0].id).not.toBe(theirs.id);
  });

  it('excludes an INVITED membership until it is accepted', async () => {
    const organization = await createOrganization({ slug: 'picker-invited' });
    const invited = await createMember({
      organizationId: organization.id,
      roles: ['CLIENT_TEAM_MEMBER'],
      status: 'INVITED',
    });

    const response = await authGet(`${API}/auth/organizations`, invited.token).expect(200);
    expect(response.body.data).toHaveLength(0);
  });

  it('requires authentication', async () => {
    await request(app).get(`${API}/auth/organizations`).expect(401);
  });
});
