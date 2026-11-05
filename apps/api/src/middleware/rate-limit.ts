import type { NextFunction, Request, Response } from 'express';
import { env } from '../config/env';
import { ApiError } from '../lib/api-error';

/**
 * Rate limiting.
 *
 * A fixed-window counter per key, held in memory. That is the honest description:
 * per-process, so N API nodes allow N times the limit. It is enough to stop the
 * failures that actually happen here — a stolen token hammering an endpoint, a
 * login brute force, a runaway client loop — and it costs no dependency. A shared
 * Redis counter is the upgrade path, and the shape below would not change.
 *
 * Two keys matter:
 *  - **by IP** for unauthenticated routes (login, invite preview), where there is
 *    no identity to attribute traffic to yet;
 *  - **by actor + tenant** for authenticated ones, so one noisy tenant cannot
 *    exhaust a shared office IP and lock out its colleagues.
 */
export interface LimitConfig {
  readonly windowMs: number;
  readonly max: number;
}

interface Window {
  count: number;
  resetAt: number;
}

export interface Limiter {
  readonly name: string;
  /** Replaces the configured ceiling; used by tests and by ops tuning. */
  configure(config: Partial<LimitConfig>): void;
  readonly config: LimitConfig;
  /** True when the caller is over the line; increments otherwise. */
  hit(key: string, now?: number): { allowed: boolean; remaining: number; retryAfterSeconds: number };
  reset(): void;
}

export function createLimiter(name: string, initial: LimitConfig): Limiter {
  let config = initial;
  const windows = new Map<string, Window>();

  return {
    name,

    configure(next) {
      config = { ...config, ...next };
      windows.clear();
    },

    get config() {
      return config;
    },

    hit(key, now = Date.now()) {
      // A disabled limiter must not pay for the bookkeeping either.
      if (config.max <= 0) {
        return { allowed: true, remaining: Number.POSITIVE_INFINITY, retryAfterSeconds: 0 };
      }

      const existing = windows.get(key);

      if (!existing || existing.resetAt <= now) {
        windows.set(key, { count: 1, resetAt: now + config.windowMs });
        return { allowed: true, remaining: config.max - 1, retryAfterSeconds: 0 };
      }

      existing.count += 1;

      if (existing.count > config.max) {
        return {
          allowed: false,
          remaining: 0,
          retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1_000)),
        };
      }

      return { allowed: true, remaining: config.max - existing.count, retryAfterSeconds: 0 };
    },

    reset() {
      windows.clear();
    },
  };
}

/**
 * Login is limited per IP *and* per submitted email, because the two attacks
 * differ: spraying one password across many accounts is one IP against many
 * emails, and hammering one account from a botnet is many IPs against one email.
 */
export const rateLimiters = {
  auth: createLimiter('auth', {
    windowMs: env.AUTH_RATE_LIMIT_WINDOW_SECONDS * 1_000,
    max: env.AUTH_RATE_LIMIT_MAX,
  }),
  api: createLimiter('api', {
    windowMs: env.RATE_LIMIT_WINDOW_SECONDS * 1_000,
    max: env.RATE_LIMIT_MAX,
  }),
};

export function clientIp(request: Request): string {
  // `trust proxy` is on, so express has already resolved X-Forwarded-For here.
  return request.ip || request.socket.remoteAddress || 'unknown';
}

function applyLimits(
  response: Response,
  limiter: Limiter,
  result: { allowed: boolean; remaining: number; retryAfterSeconds: number },
): void {
  response.setHeader('x-ratelimit-limit', String(limiter.config.max));
  response.setHeader(
    'x-ratelimit-remaining',
    Number.isFinite(result.remaining) ? String(result.remaining) : 'unlimited',
  );
}

/** Ceiling for `/auth/login`: IP and email, whichever trips first. */
export function authRateLimit(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  const ipResult = rateLimiters.auth.hit(`ip:${clientIp(request)}`);
  applyLimits(response, rateLimiters.auth, ipResult);

  if (!ipResult.allowed) {
    response.setHeader('retry-after', String(ipResult.retryAfterSeconds));
    next(
      ApiError.tooManyRequests(
        `Too many sign-in attempts from this address. Try again in ${ipResult.retryAfterSeconds}s.`,
        ipResult.retryAfterSeconds,
      ),
    );
    return;
  }

  const email = typeof request.body?.email === 'string' ? request.body.email.toLowerCase() : null;

  if (email) {
    const emailResult = rateLimiters.auth.hit(`email:${email}`);

    if (!emailResult.allowed) {
      response.setHeader('retry-after', String(emailResult.retryAfterSeconds));
      next(
        ApiError.tooManyRequests(
          `Too many sign-in attempts for this account. Try again in ${emailResult.retryAfterSeconds}s.`,
          emailResult.retryAfterSeconds,
        ),
      );
      return;
    }
  }

  next();
}

/**
 * Ceiling for the rest of the API.
 *
 * Runs before authentication, so it keys on the tenant header when present and the
 * IP otherwise: an unauthenticated flood is still a flood.
 */
export function apiRateLimit(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  const organizationId = request.header('x-organization-id');
  const key = organizationId ? `org:${organizationId}` : `ip:${clientIp(request)}`;
  const result = rateLimiters.api.hit(key);

  applyLimits(response, rateLimiters.api, result);

  if (!result.allowed) {
    response.setHeader('retry-after', String(result.retryAfterSeconds));
    next(
      ApiError.tooManyRequests(
        `Rate limit exceeded (${rateLimiters.api.config.max} requests per ${Math.round(
          rateLimiters.api.config.windowMs / 1_000,
        )}s). Try again in ${result.retryAfterSeconds}s.`,
        result.retryAfterSeconds,
      ),
    );
    return;
  }

  next();
}
