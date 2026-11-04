import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import request from 'supertest';
import {
  API,
  app,
  authGet,
  authPatch,
  authPost,
  authPutRaw,
  createMember,
  createOrganization,
  createStaff,
} from './helpers/api';
import { resolveStoragePath } from '../src/storage/local-storage';

const PDF_BYTES = Buffer.from(
  '%PDF-1.4\n% GC3 test asset\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n',
  'utf8',
);

function digestOf(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

/**
 * Collects an arbitrary binary response body as a Buffer. Typed loosely at the
 * boundary because superagent hands us its own response object, which does not
 * structurally match Node's ReadableStream type.
 */
function binaryParser(
  response: unknown,
  callback: (error: Error | null, body: Buffer) => void,
): void {
  const stream = response as {
    setEncoding(encoding: string): void;
    on(event: string, handler: (chunk: string) => void): void;
  };

  const chunks: Buffer[] = [];
  stream.setEncoding('binary');
  stream.on('data', (chunk: string) => chunks.push(Buffer.from(chunk, 'binary')));
  stream.on('end', () => callback(null, Buffer.concat(chunks)));
}

interface Seeded {
  requestId: string;
  deliverableId: string;
}

async function seedDeliverable(
  organizationId: string,
  token: string,
  overrides: Partial<{ title: string; status: 'PENDING' }> = {},
): Promise<Seeded> {
  const created = await authPost(
    `${API}/service-requests`,
    token,
    {
      title: 'File upload host request',
      description: 'A request that will carry an uploaded asset.',
      priority: 'NORMAL',
      status: 'SUBMITTED',
    },
    organizationId,
  ).expect(201);

  const requestId = created.body.data.id as string;

  const deliverable = await authPost(
    `${API}/service-requests/${requestId}/deliverables`,
    token,
    { title: overrides.title ?? 'Uploaded asset' },
    organizationId,
  ).expect(201);

  return { requestId, deliverableId: deliverable.body.data.id as string };
}

function uploadPath(seeded: Seeded): string {
  return `${API}/service-requests/${seeded.requestId}/deliverables/${seeded.deliverableId}/file`;
}

describe('deliverable file upload', () => {
  it('stores the bytes, records the digest and bumps the version', async () => {
    const organization = await createOrganization();
    const staff = await createStaff('PLATFORM_ADMIN');
    const seeded = await seedDeliverable(organization.id, staff.token);

    const response = await authPutRaw(
      uploadPath(seeded),
      staff.token,
      PDF_BYTES,
      'application/pdf',
      organization.id,
    ).expect(200);

    const digest = digestOf(PDF_BYTES);

    expect(response.body.data.integrity).toMatchObject({
      sha256: digest,
      sizeBytes: PDF_BYTES.length,
      mimeType: 'application/pdf',
    });

    expect(response.body.data.deliverable).toMatchObject({
      version: 2,
      fileSha256: digest,
      fileSize: PDF_BYTES.length,
      fileMimeType: 'application/pdf',
      // Stored bytes supersede any external URL reference.
      fileUrl: null,
      status: 'PENDING',
    });

    expect(response.body.data.deliverable.fileKey).toMatch(
      new RegExp(`^${organization.id}/${seeded.deliverableId}/v2-`),
    );
    expect(response.body.data.approvalReset).toBe(false);
  });

  it('records the file metadata on the new version row', async () => {
    const organization = await createOrganization();
    const staff = await createStaff('POD_MANAGER');
    const seeded = await seedDeliverable(organization.id, staff.token);

    await authPutRaw(
      `${uploadPath(seeded)}?note=Client asked for the signed copy`,
      staff.token,
      PDF_BYTES,
      'application/pdf',
      organization.id,
    ).expect(200);

    const versions = await authGet(
      `${API}/service-requests/${seeded.requestId}/deliverables/${seeded.deliverableId}/versions`,
      staff.token,
      organization.id,
    ).expect(200);

    expect(versions.body.data).toHaveLength(2);
    expect(versions.body.data[0]).toMatchObject({
      version: 2,
      fileSha256: digestOf(PDF_BYTES),
      fileSize: PDF_BYTES.length,
      fileMimeType: 'application/pdf',
      changeNote: 'Client asked for the signed copy',
      createdById: staff.userId,
    });

    // v1 keeps its own (file-less) snapshot.
    expect(versions.body.data[1]).toMatchObject({ version: 1, fileSha256: null });
  });

  it('serves the exact bytes back with the digest in a header', async () => {
    const organization = await createOrganization();
    const staff = await createStaff('PLATFORM_ADMIN');
    const client = await createMember({
      organizationId: organization.id,
      roles: ['CLIENT_OWNER'],
    });
    const seeded = await seedDeliverable(organization.id, staff.token);

    await authPutRaw(uploadPath(seeded), staff.token, PDF_BYTES, 'application/pdf', organization.id)
      .expect(200);

    const download = await request(app)
      .get(`${API}/deliverables/${seeded.deliverableId}/file`)
      .set('authorization', `Bearer ${client.token}`)
      .set('x-organization-id', organization.id)
      .buffer(true)
      .parse(binaryParser)
      .expect(200);

    expect(download.headers['content-type']).toBe('application/pdf');
    expect(download.headers['x-checksum-sha256']).toBe(digestOf(PDF_BYTES));
    expect(download.headers['content-length']).toBe(String(PDF_BYTES.length));
    expect(Buffer.compare(download.body as Buffer, PDF_BYTES)).toBe(0);
  });

  it('reports a matching checksum, and detects tampering on disk', async () => {
    const organization = await createOrganization();
    const staff = await createStaff('PLATFORM_ADMIN');
    const seeded = await seedDeliverable(organization.id, staff.token);

    const upload = await authPutRaw(
      uploadPath(seeded),
      staff.token,
      PDF_BYTES,
      'application/pdf',
      organization.id,
    ).expect(200);

    const fileKey = upload.body.data.deliverable.fileKey as string;

    const clean = await authGet(
      `${API}/deliverables/${seeded.deliverableId}/file/integrity`,
      staff.token,
      organization.id,
    ).expect(200);

    expect(clean.body.data.ok).toBe(true);
    expect(clean.body.data.expectedSha256).toBe(digestOf(PDF_BYTES));
    expect(clean.body.data.sizeBytes).toBe(PDF_BYTES.length);

    // Rewrite the stored file behind the API's back, as a compromised disk would.
    await writeFile(resolveStoragePath(fileKey), Buffer.from('tampered content', 'utf8'));

    const tampered = await authGet(
      `${API}/deliverables/${seeded.deliverableId}/file/integrity`,
      staff.token,
      organization.id,
    ).expect(200);

    expect(tampered.body.data.ok).toBe(false);
    expect(tampered.body.data.expectedSha256).toBe(digestOf(PDF_BYTES));
    expect(tampered.body.data.actualSha256).toBe(digestOf(Buffer.from('tampered content', 'utf8')));
  });

  it('clears a prior approval when the file is replaced', async () => {
    const organization = await createOrganization();
    const admin = await createStaff('PLATFORM_ADMIN');
    const approver = await createMember({
      organizationId: organization.id,
      roles: ['CLIENT_OWNER'],
    });
    const seeded = await seedDeliverable(organization.id, admin.token);

    await authPutRaw(uploadPath(seeded), admin.token, PDF_BYTES, 'application/pdf', organization.id)
      .expect(200);

    const statusPath = `${API}/service-requests/${seeded.requestId}/deliverables/${seeded.deliverableId}/status`;
    await authPatch(statusPath, approver.token, { status: 'APPROVED' }, organization.id).expect(200);
    await authPatch(statusPath, approver.token, { status: 'RELEASED' }, organization.id).expect(200);

    const replaced = await authPutRaw(
      uploadPath(seeded),
      admin.token,
      Buffer.from('%PDF-1.4 replacement\n%%EOF\n', 'utf8'),
      'application/pdf',
      organization.id,
    ).expect(200);

    expect(replaced.body.data.approvalReset).toBe(true);
    expect(replaced.body.data.deliverable).toMatchObject({
      status: 'PENDING',
      version: 3,
      approvedById: null,
      approvedAt: null,
      releasedAt: null,
    });
  });

  it('rejects an unsupported media type', async () => {
    const organization = await createOrganization();
    const staff = await createStaff('PLATFORM_ADMIN');
    const seeded = await seedDeliverable(organization.id, staff.token);

    const response = await authPutRaw(
      uploadPath(seeded),
      staff.token,
      Buffer.from('#!/bin/sh\necho hi\n', 'utf8'),
      'application/x-shellscript',
      organization.id,
    ).expect(400);

    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.message).toContain('Unsupported file type');
  });

  it('rejects an empty body', async () => {
    const organization = await createOrganization();
    const staff = await createStaff('PLATFORM_ADMIN');
    const seeded = await seedDeliverable(organization.id, staff.token);

    const response = await authPutRaw(
      uploadPath(seeded),
      staff.token,
      Buffer.alloc(0),
      'application/pdf',
      organization.id,
    ).expect(400);

    expect(response.body.error.message).toMatch(/empty/i);
  });

  it('rejects a file over the size limit with 413', async () => {
    const organization = await createOrganization();
    const staff = await createStaff('PLATFORM_ADMIN');
    const seeded = await seedDeliverable(organization.id, staff.token);

    // Default cap is 10 MiB; send one byte more.
    const oversized = Buffer.alloc(10 * 1024 * 1024 + 1, 0x41);

    const response = await authPutRaw(
      uploadPath(seeded),
      staff.token,
      oversized,
      'application/pdf',
      organization.id,
    ).expect(413);

    expect(response.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('refuses a client actor', async () => {
    const organization = await createOrganization();
    const staff = await createStaff('PLATFORM_ADMIN');
    const owner = await createMember({
      organizationId: organization.id,
      roles: ['CLIENT_OWNER'],
    });
    const seeded = await seedDeliverable(organization.id, staff.token);

    await authPutRaw(
      uploadPath(seeded),
      owner.token,
      PDF_BYTES,
      'application/pdf',
      organization.id,
    ).expect(403);
  });

  it('keeps uploads inside their tenant', async () => {
    const mine = await createOrganization();
    const theirs = await createOrganization();
    const staff = await createStaff('PLATFORM_ADMIN');
    const seeded = await seedDeliverable(mine.id, staff.token);

    await authPutRaw(uploadPath(seeded), staff.token, PDF_BYTES, 'application/pdf', theirs.id)
      .expect(404);

    await authGet(`${API}/deliverables/${seeded.deliverableId}/file`, staff.token, theirs.id)
      .expect(404);
  });

  it('404s a download for a deliverable with no stored file', async () => {
    const organization = await createOrganization();
    const staff = await createStaff('PLATFORM_ADMIN');
    const seeded = await seedDeliverable(organization.id, staff.token);

    await authGet(`${API}/deliverables/${seeded.deliverableId}/file`, staff.token, organization.id)
      .expect(404);
  });

  it('requires authentication to download', async () => {
    const organization = await createOrganization();
    const staff = await createStaff('PLATFORM_ADMIN');
    const seeded = await seedDeliverable(organization.id, staff.token);

    await authPutRaw(uploadPath(seeded), staff.token, PDF_BYTES, 'application/pdf', organization.id)
      .expect(200);

    await request(app).get(`${API}/deliverables/${seeded.deliverableId}/file`).expect(401);
  });
});
