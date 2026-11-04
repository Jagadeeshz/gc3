import { describe, expect, it } from 'vitest';
import {
  API,
  authPost,
  createOrganization,
  createStaff,
  inviteMember,
} from './helpers/api';
import { prisma } from '../src/db/client';
import { notificationRepository } from '../src/repositories/notification.repository';
import { resetNotificationService, setNotificationService } from '../src/notifications';
import { FailingNotificationService, NoopNotificationService } from '../src/notifications/drivers';

/**
 * Delivery audit: every dispatch attempt is recorded, including the ones that
 * fail. These assertions read the database, not the API response, because the
 * point of the table is that it survives after the request is gone.
 */
describe('delivery audit rows', () => {
  it('records a successful invitation with full tenant context', async () => {
    const organization = await createOrganization({ name: 'Audit Co' });
    const admin = await createStaff('PLATFORM_ADMIN');
    const invite = await inviteMember({ organizationId: organization.id, adminToken: admin.token });

    const rows = await notificationRepository.listScoped(organization.id);
    expect(rows).toHaveLength(1);

    const row = rows[0];
    expect(row).toMatchObject({
      organizationId: organization.id,
      membershipId: invite.membershipId,
      userId: invite.userId,
      kind: 'INVITATION',
      channel: 'email',
      driver: 'memory',
      status: 'SENT',
      recipient: invite.email,
    });
    expect(row?.messageId).toBeTruthy();
    expect(row?.error).toBeNull();

    // The response points at the same row the audit table holds.
    const response = await authPost(
      `${API}/organizations/${organization.id}/memberships`,
      admin.token,
      { email: 'second@audit.example', fullName: 'Second Person', roles: ['CLIENT_TEAM_MEMBER'] },
      organization.id,
    ).expect(201);

    expect(response.body.data.delivery.auditId).toMatch(/^[0-9a-f-]{36}$/);
    const recorded = await prisma.notificationDelivery.findUniqueOrThrow({
      where: { id: response.body.data.delivery.auditId as string },
    });
    expect(recorded.recipient).toBe('second@audit.example');
  });

  it('records a resend as its own RESENT row', async () => {
    const organization = await createOrganization();
    const admin = await createStaff('PLATFORM_ADMIN');
    const invite = await inviteMember({ organizationId: organization.id, adminToken: admin.token });

    await authPost(
      `${API}/organizations/${organization.id}/memberships/${invite.userId}/invite/resend`,
      admin.token,
      {},
      organization.id,
    ).expect(200);

    const rows = await notificationRepository.listScoped(organization.id);
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.kind).sort()).toEqual(['INVITATION', 'RESENT']);
    expect(rows.every((row) => row.status === 'SENT')).toBe(true);
  });

  it('records a provider failure, and the invitation still works', async () => {
    const organization = await createOrganization();
    const admin = await createStaff('PLATFORM_ADMIN');
    setNotificationService(new FailingNotificationService());

    try {
      const response = await authPost(
        `${API}/organizations/${organization.id}/memberships`,
        admin.token,
        { email: 'unlucky@audit.example', fullName: 'Unlucky Person', roles: ['CLIENT_TEAM_MEMBER'] },
        organization.id,
      ).expect(201);

      expect(response.body.data.delivery).toMatchObject({
        status: 'failed',
        driver: 'failing',
        error: 'simulated provider failure',
      });

      const rows = await notificationRepository.listScoped(organization.id);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ status: 'FAILED', driver: 'failing' });
      expect(rows[0]?.error).toContain('simulated provider failure');
      expect(rows[0]?.messageId).toBeNull();

      // The membership and token survive a delivery failure.
      const token = response.body.data.inviteToken as string;
      const membership = await prisma.membership.findUniqueOrThrow({
        where: { id: response.body.data.id as string },
      });
      expect(membership.status).toBe('INVITED');
      expect(membership.inviteTokenHash).not.toBeNull();
      await authPost(`${API}/auth/accept-invite`, '', { token, password: 'Audit-Survives-1' }).expect(
        200,
      );
    } finally {
      resetNotificationService();
    }
  });

  it('records a skip honestly when the driver sends nothing', async () => {
    const organization = await createOrganization();
    const admin = await createStaff('PLATFORM_ADMIN');
    setNotificationService(new NoopNotificationService());

    try {
      await authPost(
        `${API}/organizations/${organization.id}/memberships`,
        admin.token,
        { email: 'skipped@audit.example', fullName: 'Skipped Person', roles: ['CLIENT_TEAM_MEMBER'] },
        organization.id,
      ).expect(201);

      const rows = await notificationRepository.listScoped(organization.id);
      expect(rows[0]).toMatchObject({ status: 'SKIPPED', driver: 'noop' });
      expect(rows[0]?.messageId).toBeNull();
    } finally {
      resetNotificationService();
    }
  });

  it('keeps delivery rows tenant-scoped', async () => {
    const tenantA = await createOrganization({ slug: 'audit-a' });
    const tenantB = await createOrganization({ slug: 'audit-b' });
    const admin = await createStaff('PLATFORM_ADMIN');

    await inviteMember({ organizationId: tenantA.id, adminToken: admin.token });
    await inviteMember({ organizationId: tenantB.id, adminToken: admin.token });

    const rowsA = await notificationRepository.listScoped(tenantA.id);
    const rowsB = await notificationRepository.listScoped(tenantB.id);

    expect(rowsA).toHaveLength(1);
    expect(rowsB).toHaveLength(1);
    expect(rowsA[0]?.organizationId).toBe(tenantA.id);
    expect(rowsB[0]?.organizationId).toBe(tenantB.id);
    expect(rowsA[0]?.recipient).not.toBe(rowsB[0]?.recipient);
  });
});
