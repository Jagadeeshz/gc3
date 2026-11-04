import { z } from 'zod';

/**
 * Environment contract. Parsed once at boot so a misconfigured deployment
 * fails immediately instead of surfacing as a runtime error mid-request.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  API_HOST: z.string().min(1).default('0.0.0.0'),
  /** Browser origin allowed to call the API (comma-separated list). */
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  /** PostgreSQL connection string. Required from Phase 1 onward. */
  DATABASE_URL: z.url(),

  /** HMAC secret for access tokens. Must be ≥ 32 chars; rotate per environment. */
  AUTH_SECRET: z.string().min(32, 'AUTH_SECRET must be at least 32 characters'),
  AUTH_ISSUER: z.string().min(1).default('gc3-portal'),
  AUTH_AUDIENCE: z.string().min(1).default('gc3-api'),
  /** Access-token lifetime in seconds (short by design; refresh lands later). */
  AUTH_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).max(86_400).default(900),

  REDIS_URL: z.url().optional(),
});

export type Env = z.infer<typeof envSchema>;

function load(): Env {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((issue) => `  ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    // Fail fast: an invalid environment must never reach a listening socket.
    throw new Error(`Invalid environment configuration:\n${detail}`);
  }

  return parsed.data;
}

export const env: Env = load();

/** Service version surfaced by `/api/v1/health` and `/api/v1/meta`. */
export const SERVICE_VERSION = '0.1.0';
export const SERVICE_NAME = 'gc3-api' as const;
