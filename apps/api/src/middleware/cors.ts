import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env';

/**
 * CORS for a separately hosted portal.
 *
 * An allow-list, never `*`: this API carries bearer tokens and tenant data, and a
 * wildcard would let any page in the world read a logged-in user's responses the
 * moment a token leaked into one.
 *
 * Preflight is answered here and terminates — an OPTIONS request that reaches the
 * routers would trip the auth and rate-limit middleware and fail as a 401, which
 * looks like a CORS bug to whoever debugs it at 2am.
 */
const ALLOWED_HEADERS = [
  'authorization',
  'content-type',
  'x-organization-id',
  'x-actor-type',
  'x-request-id',
].join(', ');

function allowedOrigins(): readonly string[] {
  return (env.WEB_ORIGIN ?? '')
    .split(',')
    .map((origin) => origin.trim().replace(/\/$/, ''))
    .filter((origin) => origin.length > 0);
}

export function cors(request: Request, response: Response, next: NextFunction): void {
  const origin = request.headers.origin;
  const list = allowedOrigins();

  if (origin && list.includes(origin)) {
    response.setHeader('access-control-allow-origin', origin);
    response.setHeader('vary', 'Origin');
    response.setHeader('access-control-allow-credentials', 'true');
    // Exposed so the web client can read the checksum on a file download and the
    // correlation id on any error.
    response.setHeader('access-control-expose-headers', 'x-checksum-sha256, x-request-id, retry-after');
  }

  if (request.method === 'OPTIONS') {
    if (origin && list.includes(origin)) {
      response.setHeader('access-control-allow-methods', 'GET,POST,PATCH,PUT,DELETE,OPTIONS');
      response.setHeader('access-control-allow-headers', ALLOWED_HEADERS);
      response.setHeader('access-control-max-age', '600');
    }

    response.status(204).send();
    return;
  }

  next();
}
