import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env';

/**
 * Security headers.
 *
 * The API serves JSON and one plain-text invoice document, never HTML, so the
 * policy can be genuinely strict: `default-src 'none'` means a compromised
 * response cannot load anything.
 *
 * HSTS is emitted only in production — sending it from a local HTTP server would
 * teach a developer's browser to force HTTPS on localhost, which is a support
 * ticket, not a hardening.
 */
export function securityHeaders(
  _request: Request,
  response: Response,
  next: NextFunction,
): void {
  response.setHeader('x-content-type-options', 'nosniff');
  response.setHeader('x-frame-options', 'DENY');
  response.setHeader('referrer-policy', 'no-referrer');
  response.setHeader('x-dns-prefetch-control', 'off');
  response.setHeader('cross-origin-opener-policy', 'same-origin');
  response.setHeader('cross-origin-resource-policy', 'same-site');
  response.setHeader(
    'permissions-policy',
    'geolocation=(), microphone=(), camera=(), payment=(), usb=()',
  );
  response.setHeader(
    'content-security-policy',
    "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
  );

  if (env.NODE_ENV === 'production') {
    response.setHeader('strict-transport-security', 'max-age=15552000; includeSubDomains');
  }

  // The framework banner is free reconnaissance; it is already off at the app
  // level, and repeated here so a header regression is caught by the header test.
  response.removeHeader('x-powered-by');

  next();
}
