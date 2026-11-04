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

  /** How long an invitation remains acceptable. Default 7 days. */
  INVITE_TTL_HOURS: z.coerce.number().int().min(1).max(720).default(168),

  /** Base URL used to build the invite accept link. */
  WEB_APP_URL: z.url().default('http://localhost:3000'),

  /**
   * Delivery driver for invitations. `console` and `failing` are rejected in
   * production by the notification factory; default is `console` outside
   * production and `noop` inside it.
   */
  NOTIFICATION_DRIVER: z.enum(['console', 'memory', 'noop', 'failing', 'smtp']).optional(),

  /** SMTP transport. Required when NOTIFICATION_DRIVER=smtp. */
  SMTP_HOST: z.string().min(1).optional(),
  SMTP_PORT: z.coerce.number().int().min(1).max(65_535).default(1025),
  /** Implicit TLS (465). Leave false for STARTTLS on 25/587/1025. */
  SMTP_SECURE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  /** Envelope sender. */
  MAIL_FROM: z.string().min(3).default('GC3 Portal <no-reply@gc3.local>'),

  REDIS_URL: z.url().optional(),

  /** Directory for uploaded deliverable files. Relative paths resolve from cwd. */
  UPLOAD_DIR: z.string().min(1).default('storage'),
  /** Hard cap on a single uploaded file, in bytes. Default 10 MiB. */
  FILE_MAX_BYTES: z.coerce.number().int().min(1).max(104_857_600).default(10_485_760),
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
