import { SignJWT, jwtVerify } from 'jose';
import { z } from 'zod';
import type { StaffRole } from '@gc3/types';
import { env } from '../config/env';

/**
 * Stateless HS256 access tokens.
 *
 * The token carries identity and the platform role only — never a tenant scope
 * and never permissions. Tenant access is re-derived per request from the
 * membership table, so revoking a membership takes effect immediately instead
 * of at token expiry.
 */
const ALGORITHM = 'HS256';
const secret = new TextEncoder().encode(env.AUTH_SECRET);

const claimsSchema = z.object({
  sub: z.uuid(),
  email: z.email(),
  platformRole: z
    .enum([
      'PLATFORM_ADMIN',
      'OPERATIONS_MANAGER',
      'ACCOUNT_MANAGER',
      'POD_MANAGER',
      'SPECIALIST',
      'FINANCE_MANAGER',
      'SALES_MANAGER',
      'MANAGEMENT',
    ])
    .nullable(),
});

export type AccessTokenClaims = {
  readonly userId: string;
  readonly email: string;
  readonly platformRole: StaffRole | null;
};

export interface SignedAccessToken {
  readonly token: string;
  readonly expiresIn: number;
}

export async function signAccessToken(
  claims: AccessTokenClaims,
  ttlSeconds: number = env.AUTH_TOKEN_TTL_SECONDS,
): Promise<SignedAccessToken> {
  const token = await new SignJWT({ email: claims.email, platformRole: claims.platformRole })
    .setProtectedHeader({ alg: ALGORITHM, typ: 'JWT' })
    .setSubject(claims.userId)
    .setIssuedAt()
    .setIssuer(env.AUTH_ISSUER)
    .setAudience(env.AUTH_AUDIENCE)
    .setExpirationTime(Math.floor(Date.now() / 1000) + ttlSeconds)
    .sign(secret);

  return { token, expiresIn: ttlSeconds };
}

/**
 * Verifies signature, issuer, audience and expiry. Returns null for every
 * failure mode — callers must not distinguish "expired" from "forged" to the
 * client.
 */
export async function verifyAccessToken(token: string): Promise<AccessTokenClaims | null> {
  try {
    const { payload } = await jwtVerify(token, secret, {
      algorithms: [ALGORITHM],
      issuer: env.AUTH_ISSUER,
      audience: env.AUTH_AUDIENCE,
    });

    const parsed = claimsSchema.safeParse(payload);

    if (!parsed.success) {
      return null;
    }

    return {
      userId: parsed.data.sub,
      email: parsed.data.email,
      platformRole: parsed.data.platformRole,
    };
  } catch {
    return null;
  }
}
