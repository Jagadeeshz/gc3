import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';

/** Header used to correlate logs and error envelopes with a single request. */
export const REQUEST_ID_HEADER = 'x-request-id';

/**
 * Accepts an inbound correlation id when present (so a browser or gateway can
 * trace a call end to end) and otherwise mints one.
 */
export function resolveRequestId(request: Request): string {
  const inbound = request.header(REQUEST_ID_HEADER);
  return inbound && /^[\w-]{8,128}$/.test(inbound) ? inbound : randomUUID();
}

/** Echoes the correlation id back so clients can quote it in support tickets. */
export function requestIdMiddleware(request: Request, response: Response, next: () => void): void {
  response.setHeader(REQUEST_ID_HEADER, request.requestId);
  next();
}
