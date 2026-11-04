import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { env } from '../config/env';

/**
 * Local filesystem storage for deliverable assets.
 *
 * The interface is deliberately narrow (put/get/resolve) so an S3 or GCS adapter
 * can replace this file without touching the routes. What matters to the rest of
 * the system is that a stored key is immutable and addressable.
 */
const BASE_DIR = path.resolve(process.cwd(), env.UPLOAD_DIR);

/** Keys are `<orgId>/<deliverableId>/v<n>-<uuid>.<ext>` and nothing else. */
const KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9/_.-]*$/;

const EXTENSIONS: Readonly<Record<string, string>> = {
  'application/pdf': 'pdf',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'text/plain': 'txt',
  'text/markdown': 'md',
  'text/csv': 'csv',
  'application/json': 'json',
  'application/zip': 'zip',
  'application/msword': 'doc',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
};

export const SUPPORTED_MIME_TYPES: readonly string[] = Object.keys(EXTENSIONS);

export function isSupportedMimeType(mimeType: string): boolean {
  return EXTENSIONS[mimeType] !== undefined;
}

/** Lowercase hex SHA-256 — the digest stored beside every uploaded file. */
export function sha256(buffer: Buffer): string {
  return createHash('sha256').update(buffer).digest('hex');
}

export function buildStorageKey(input: {
  organizationId: string;
  deliverableId: string;
  version: number;
  mimeType: string;
}): string {
  const extension = EXTENSIONS[input.mimeType] ?? 'bin';
  return `${input.organizationId}/${input.deliverableId}/v${input.version}-${randomUUID()}.${extension}`;
}

/**
 * Resolves a key to a path, refusing anything that could escape the upload
 * directory. Returns the path only — callers never build paths themselves.
 */
export function resolveStoragePath(key: string): string {
  if (!KEY_PATTERN.test(key) || key.includes('..')) {
    throw new Error(`Unsafe storage key: ${key}`);
  }

  const full = path.resolve(BASE_DIR, key);

  if (full !== BASE_DIR && !full.startsWith(BASE_DIR + path.sep)) {
    throw new Error('Storage key escapes the upload directory');
  }

  return full;
}

export const fileStorage = {
  async put(key: string, buffer: Buffer): Promise<void> {
    const full = resolveStoragePath(key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, buffer);
  },

  async get(key: string): Promise<Buffer> {
    return readFile(resolveStoragePath(key));
  },
};
