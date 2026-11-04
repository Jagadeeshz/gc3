import type { Express } from 'express';
import request from 'supertest';
import type { Organization } from '@gc3/types';
import { createApp } from '../../src/app';

export const app: Express = createApp();

/** The header that scopes a request to a tenant. */
export const ORG_HEADER = 'x-organization-id';

let counter = 0;

/**
 * Creates a tenant through the public API (not by inserting rows directly), so
 * the fixtures exercise the same path the product will.
 */
export async function createOrganization(
  overrides: Partial<{ name: string; slug: string }> = {},
): Promise<Organization> {
  counter += 1;
  const slug = overrides.slug ?? `tenant-${counter}-${Date.now().toString(36)}`;

  const response = await request(app)
    .post('/api/v1/organizations')
    .send({ name: overrides.name ?? `Tenant ${counter}`, slug })
    .expect(201);

  return response.body.data as Organization;
}

/** GET with a tenant scope header. */
export function getScoped(path: string, organizationId: string) {
  return request(app).get(path).set(ORG_HEADER, organizationId);
}
