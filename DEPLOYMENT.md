# Deployment

The portal is two applications, and they deploy differently. This is the shortest
path that actually works.

```
apps/web   Next.js  →  Vercel            (static + server rendering; no database)
apps/api   Express  →  a long-running host (Render / Railway / Fly / a VM)
                       + PostgreSQL 16   (Neon, Supabase, RDS, or the host's own)
                       + Redis (optional) durable queue; in-memory timers without it
```

Vercel is an excellent home for `apps/web` and a poor one for `apps/api`: the API runs
BullMQ workers and an SLA sweep on an interval. Serverless functions sleep, so those
timers would fire late or not at all, and every cold start would reconnect Prisma.

---

## 1. Deploy the API first

Vercel needs `NEXT_PUBLIC_API_BASE_URL`, so the API must exist before the frontend.

**Build and start**

```
Build:   pnpm install --frozen-lockfile && pnpm --filter @gc3/api build
Start:   node apps/api/dist/index.js
```

**Required environment**

| Variable | Notes |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string. Run `pnpm --filter @gc3/api exec prisma migrate deploy` on release. |
| `AUTH_SECRET` | ≥ 32 characters. `openssl rand -base64 48`. |
| `WEB_ORIGIN` | The Vercel URL, e.g. `https://gc3.vercel.app`. Comma-separate for previews. |
| `PORT` | Most hosts inject this; the API reads it. |
| `REDIS_URL` | Optional. Without it the queue falls back to in-process timers. |
| `SMTP_HOST` / `SMTP_PORT` | Optional. Without them invitations are recorded as `SKIPPED`, never faked as sent. |

**Seed the commercial catalogue** (one off, against the production database):

```
pnpm --filter @gc3/api exec tsx scripts/seed-pods.ts
pnpm --filter @gc3/api exec tsx scripts/seed-tiers.ts
```

**Create the first administrator** (staff accounts have no self-registration):

```
ADMIN_EMAIL=you@company.com ADMIN_PASSWORD='…' pnpm --filter @gc3/api auth:bootstrap
```

---

## 2. Deploy the web app on Vercel

Import `https://github.com/Jagadeeshz/gc3`, then set exactly this:

| Setting | Value |
|---|---|
| Framework preset | **Next.js** |
| Root directory | **`apps/web`** |
| Install command | leave default — Vercel detects `pnpm-lock.yaml` at the repo root |
| Build command | leave default (`next build`) |
| Output directory | leave default |
| Node version | 22.x |

The root directory matters: the workspace packages (`@gc3/types`, `@gc3/ui`,
`@gc3/validation`) are consumed as source through `transpilePackages`, so the build must
run with the repo root visible. Vercel handles this when the lockfile is at the root.

**Environment variables**

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_API_BASE_URL` | `https://<your-api-host>/api/v1` — must include `/api/v1` |

Set it for **Production, Preview and Development**. It is baked in at build time, so
changing it later requires a redeploy.

---

## 3. What works on a fresh deployment

Sign-in, the client portal, the staff console, pods, requests, deliverables and the
catalogue all read live data from the API. The marketing pages (`/`, `/pricing`) need the
API for the pod catalogue; if it is unreachable they degrade to a link rather than an
empty section.

## 4. Nothing here is seeded with fake data

A production database starts empty: no tenants, no pods beyond the two catalogue seeds,
no requests. Create the first organization through the API or the ops console before
expecting the dashboards to show anything.
