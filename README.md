# GC3 Portal

Multi-tenant operating platform for **Global Cloud Capability & Consulting (GC³)** — client portal,
delivery operations, pod workspaces, finance, and AI-augmented workflows.

Built to the **GC3 Development Brief v1.0** (`Development-Breif.md` in this folder). The repository is
at **Phase 2** (Phase 1 complete): identity and tenancy persist in PostgreSQL, every tenant route is
authenticated and authorized through a role → permission map, client users join through a hashed,
single-use invitation that can be rotated or revoked, invitations are delivered over SMTP with a
permanent delivery audit, and Phase 2 now spans both the data layer and the HTTP API for service
requests, comments and deliverables — tenant-scoped end to end and permission-guarded per role.

---

## Repository layout

```text
GC3/
├── apps/
│   ├── web/                  Next.js App Router + Tailwind CSS (port 3000)
│   │   └── src/
│   │       ├── app/          (portal) group: dashboard, requests; /login
│   │       ├── components/   portal shell, status mapping
│   │       └── lib/          api client, session store, session context
│   └── api/                  Express + TypeScript REST API, /api/v1 (port 3001)
│       ├── prisma/           schema.prisma + migrations
│       ├── prisma.config.ts  Prisma CLI config (datasource URL lives here in v7)
│       ├── scripts/          prepare-test-db.mjs (creates + migrates the test DB)
│       ├── src/
│       │   ├── db/           Prisma client + adapter
│       │   ├── repositories/ tenant-scoped data access
│       │   ├── routes/v1/    versioned route modules
│       │   └── middleware/   request id, tenant scope, error envelope
│       └── tests/            Vitest + Supertest integration suites
├── packages/
│   ├── ui/                   Shared React components (@gc3/ui)
│   ├── types/                Domain interfaces and constants (@gc3/types)
│   └── validation/           Zod schemas (@gc3/validation)
├── docs/                     Architecture, workflow and module documentation
├── Development-Breif.md      Product requirements & development handoff (source of truth)
├── GC3_Portal_Interactive_UI_Prototype.html   Approved UI prototype reference
├── pnpm-workspace.yaml       Workspace glob: apps/*, packages/*
├── tsconfig.json             Shared strict TypeScript baseline
└── package.json              Root scripts (private, not published)
```

The Brief's Section 19 also anticipates `apps/worker`, `packages/shared`, `packages/config`,
`services/*` and `infrastructure/*`. Those are added when the slice that needs them lands — an empty
folder is not architecture.

---

## Stack

| Layer | Choice | Version |
|---|---|---|
| Frontend | Next.js (App Router) + React | 16.4.5 / 19.3.1 |
| Styling | Tailwind CSS v4 (CSS-first `@theme`) | 4.3.4 |
| API | Express | 5.3.0 |
| ORM | Prisma (Rust-free client + `pg` driver adapter) | 7.10.1 |
| Database | PostgreSQL | 16.15 |
| Validation | Zod | 4.6.7 |
| Auth | HS256 JWT (jose) + scrypt password digests | 6.2.15 |
| Email | nodemailer (SMTP), driver-swappable notification seam | 10.3.1 |
| Testing | Vitest + Supertest | 5.1.0 / 7.3.1 |
| Language | TypeScript (strict, no `any`) | 5.9.3 |
| Runtime | Node.js | ≥ 22 |
| Package manager | pnpm workspaces | 10.34.9 |

Redis and object storage arrive with the slices that need them.

---

## Commands

Run from the repository root.

```bash
pnpm install          # install the whole workspace
pnpm dev              # web + api together
pnpm dev:web          # Next.js only  → http://localhost:3000
pnpm dev:api          # API only      → http://localhost:3001/api/v1/health
pnpm typecheck        # tsc --noEmit across every package (topological order)
pnpm test             # creates/migrates the test DB, then runs Vitest + Supertest
pnpm build            # build every package that defines a build script
pnpm db:generate      # prisma generate (after a schema change)
pnpm db:migrate       # prisma migrate dev (new migration)
pnpm auth:bootstrap   # provision the first PLATFORM_ADMIN (needs ADMIN_EMAIL / ADMIN_PASSWORD)
pnpm clean            # clear build output
```

Environment: the API reads `apps/api/.env` — copy `apps/api/.env.example` to `apps/api/.env`.

---

## Architectural rules

These are not stylistic preferences; they are enforced contracts.

**1. Tenant isolation is a backend concern.**
Every tenant-owned record carries an explicit `organizationId`. Tenant scope arrives in the
`x-organization-id` header, is validated once by `requireTenantScope`, and is copied onto the request
as `request.organizationId`. Handlers filter on it. The client never decides which tenant it is, and
a route param that disagrees with the scope is rejected (`requireMatchingTenant`).

**2. One contract per request.**
Zod schemas live in `packages/validation` and are imported by both the API and the web app. No route
handler defines its own inline shape.

**3. Types are shared, not duplicated.**
`packages/types` owns the domain interfaces (`Organization`, `Membership`, `Role`, `ApiResponse`,
`HealthReport`, …). A type that only one app understands is a smell.

**4. AI agents are scoped service actors.**
Agents may draft, propose and summarise. They may **not** execute payments, change contract terms or
pricing, issue refunds, or release client deliverables without human sign-off. The prohibited set is
declared in `AGENT_PROHIBITED_ACTIONS` and `forbidAgentCommercialAction` blocks non-GET requests from
an `x-actor-type: AI_AGENT` caller.

**5. Version the surface.**
All endpoints live under `/api/v1/...`. Route modules never hardcode the prefix — it is applied once
when the router is mounted.

**6. No fabricated success.**
Unbuilt endpoints return `501 NOT_IMPLEMENTED` with a reason. A stub that returns invented data is
worse than an honest refusal.

---

## API

Base URL: `http://localhost:3001/api/v1`

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/health` | public | Liveness + version |
| GET | `/meta` | public | Implemented vs planned endpoint inventory |
| POST | `/auth/login` | public | Issues a bearer token; uniform 401 on failure |
| POST | `/auth/accept-invite` | public | Consumes an invite token: sets password, activates, returns a session |
| GET | `/auth/invite/:token` | public | Invitation preview (org, roles, masked email); 410 when expired |
| GET | `/auth/me` | bearer | Actor + the permissions their staff role grants |
| GET | `/auth/config` | public | Token type, TTL, issuer, audience |
| GET | `/tenant-context` | bearer + scope | Echoes the resolved tenant scope |
| POST | `/organizations` | bearer | Requires `organization:create` (PLATFORM_ADMIN / OPERATIONS_MANAGER) |
| GET | `/organizations/:organizationId` | bearer + scope | `organization:read`; 403 if path ≠ scope, 404 if absent |
| GET | `/organizations/:organizationId/memberships` | bearer + scope | `membership:read` (CLIENT_OWNER or staff) |
| POST | `/organizations/:organizationId/memberships` | bearer + scope | `membership:invite` (CLIENT_OWNER or staff) |
| POST | `/organizations/:organizationId/memberships/:userId/invite/resend` | bearer + scope | `membership:invite` — rotates the token, 409 if the member is ACTIVE |
| DELETE | `/organizations/:organizationId/memberships/:userId/invite` | bearer + scope | `membership:revoke` — revokes a pending invite, idempotent, 409 if ACTIVE |
| POST | `/service-requests` | bearer + scope | `request:create` — requester is the caller |
| GET | `/service-requests` | bearer + scope | `request:read` — filters `status`, `priority`, `categoryId`, `requesterId`, `page`, `pageSize` |
| GET | `/service-requests/:requestId` | bearer + scope | `request:read` — 404 for another tenant's id |
| PATCH | `/service-requests/:requestId` | bearer + scope | `request:update` — title, description, category, assignee, priority, dueAt |
| POST | `/service-requests/:requestId/status` | bearer + scope | `request:update` — workflow transition, 409 when illegal, idempotent when repeated |
| GET | `/service-requests/:requestId/comments` | bearer + scope | `request:read` — internal notes returned to staff only |
| POST | `/service-requests/:requestId/comments` | bearer + scope | `request:comment` — `isInternal` honoured for staff only; a client's flag is downgraded to `false` |
| GET | `/service-requests/:requestId/deliverables` | bearer + scope | `deliverable:read` |
| POST | `/service-requests/:requestId/deliverables` | bearer + scope | `deliverable:create` — optional `fileUrl`; `createdById` is stamped from the actor |
| PATCH | `/service-requests/:requestId/deliverables/:deliverableId` | bearer + scope | `deliverable:update` — always writes a new version; replacing approved/released content clears the approval (`approvalReset: true`) |
| GET | `/service-requests/:requestId/deliverables/:deliverableId/versions` | bearer + scope | `deliverable:read` — newest version first |
| PATCH | `/service-requests/:requestId/deliverables/:deliverableId/status` | bearer + scope | `deliverable:review` — release requires a prior human approval; AI actors blocked |
| GET | `/deliverables/history` | bearer + scope | `deliverable:read` — released assets across the workspace with counts, `?limit=` |
| PUT | `/service-requests/:requestId/deliverables/:deliverableId/file` | bearer + scope | `deliverable:update` — raw bytes as the body; SHA-256 recorded; always a new version |
| GET | `/deliverables/:deliverableId/file` | bearer + scope | `deliverable:read` — the stored bytes, with `x-checksum-sha256` |
| GET | `/deliverables/:deliverableId/file/integrity` | bearer + scope | `deliverable:read` — re-reads the file and reports `ok` / expected / actual digest |
| GET | `/notifications/deliveries` | bearer + scope | `notification:read` — delivery audit with `status` / `kind` / `recipient` filters, pagination and a status summary |
| POST | `/notifications/retry` | bearer + scope | `notification:manage` — one retry sweep over the caller's tenant, returns the counts |
| GET | `/service-categories` | bearer + scope | `category:read` — active only, `?includeInactive=true` for the full catalogue |
| POST | `/service-categories` | bearer + scope | `category:manage` — slug derived from the name when omitted, 409 on duplicate |
| PATCH | `/service-categories/:categoryId` | bearer + scope | `category:manage` — rename, re-slug, re-describe, retire/reactivate |
| DELETE | `/service-categories/:categoryId` | bearer + scope | `category:manage` — soft delete, 204; later calls 404 |
| GET | `/ops/dashboard` | bearer only | `ops:read` — cross-tenant totals, per-tenant rows, pod load and the routing queue; `?organizationId=` narrows, `?queueLimit=` 1–100 (default 20). No tenant header: the permission is the boundary |
| GET | `/pods` | bearer + scope | `request:assign` — live pods in the tenant with member and open-request counts |
| POST | `/pods` | bearer + scope | `pod:manage` — slug derived from the name, 409 on duplicate, 400 for an unknown member id |
| PATCH | `/service-requests/:requestId/assign` | bearer + scope | `request:assign` — `podId` and/or `assigneeId`; `null` clears; a pod from another tenant is 404 |

`bearer + scope` means: `Authorization: Bearer <token>` **and** `x-organization-id: <uuid>`.

Response envelope (every response, success or failure):

```jsonc
{ "success": true,  "data": { /* payload */ } }
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "…", "requestId": "…" } }
```

Every response carries an `x-request-id` header; failures echo it as `error.requestId` so a client
report can be traced to a single request.

---

## Auth & RBAC

**Credentials.** Passwords are hashed with scrypt (`N=2^14, r=8, p=1`, 16-byte salt, 64-byte key) using
`node:crypto` — no native build step. The digest is self-describing
(`scrypt$N$r$p$salt$hash`) so parameters can be raised later without a flag day.

**Tokens.** HS256 JWTs signed with `AUTH_SECRET` (≥ 32 chars, required at boot), carrying only
`sub`, `email` and `platformRole`. **No tenant scope and no permissions in the token** — both are
re-derived per request, so revoking a membership or suspending an account takes effect immediately
rather than at expiry. `requireAuth` re-reads the user row on every request for exactly this reason.

**Roles → permissions.** Routes declare a permission, never a role
(`apps/api/src/auth/permissions.ts`):

| Permission | Client owner | Team member | Approver | Platform admin | Ops manager | Account mgr |
|---|:--:|:--:|:--:|:--:|:--:|:--:|
| `organization:read` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `organization:create` | — | — | — | ✅ | ✅ | — |
| `organization:update` | — | — | — | ✅ | ✅ | — |
| `membership:read` | ✅ | — | — | ✅ | ✅ | ✅ |
| `membership:invite` | ✅ | — | — | ✅ | ✅ | — |
| `membership:revoke` | ✅ | — | — | ✅ | — | — |
| `tenant:context` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

A tenant-scoped request combines the caller's **ACTIVE** membership permissions with their staff
permissions. `INVITED` and `REVOKED` memberships contribute nothing.

**Phase 2 permissions** (service requests and deliverables):

| Permission | Client owner | Team member | Approver | Platform admin | Ops mgr | Pod mgr | Specialist | Account mgr | Finance |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| `request:read` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `request:create` | ✅ | ✅ | — | ✅ | ✅ | ✅ | — | — | — |
| `request:update` | ✅ | — | — | ✅ | ✅ | ✅ | — | — | — |
| `request:comment` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| `deliverable:read` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `deliverable:create` | — | — | — | ✅ | ✅ | ✅ | ✅ | — | — |
| `deliverable:update` | — | — | — | ✅ | ✅ | ✅ | ✅ | — | — |
| `deliverable:review` | ✅ | — | ✅ | ✅ | ✅ | ✅ | — | — | — |
| `category:read` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `category:manage` | — | — | — | ✅ | ✅ | — | — | — | — |
| `notification:read` | — | — | — | ✅ | ✅ | — | — | ✅ | — |
| `notification:manage` | — | — | — | ✅ | ✅ | — | — | — | — |
| `request:assign` | — | — | — | ✅ | ✅ | ✅ | — | — | — |
| `pod:manage` | — | — | — | ✅ | ✅ | — | — | — | — |
| `ops:read` | — | — | — | ✅ | ✅ | — | — | — | — |

**Bootstrapping.** There is no public registration. Provision staff out of band:

```bash
ADMIN_EMAIL=admin@gc3.local ADMIN_PASSWORD='…' pnpm auth:bootstrap
# optional: ADMIN_NAME, ADMIN_ROLE (defaults to PLATFORM_ADMIN)
```

**Invite acceptance.** Client users join through an invitation, not sign-up:

```text
POST /organizations/:id/memberships   → 201 + inviteToken (dev only) + inviteExpiresAt
GET  /auth/invite/:token              → preview: org, roles, masked email, expiry
POST /auth/accept-invite              → { token, password } → session, user + membership ACTIVE
```

- The token is 32 random bytes; only its SHA-256 is persisted, so a database leak yields no working
  invites. It is burned on first use — the claim is an atomic `updateMany` guarded on the live hash and
  `INVITED` status, so two concurrent acceptances cannot both succeed.
- TTL is `INVITE_TTL_HOURS` (default 168 = 7 days); an expired token returns **410 `INVITE_EXPIRED`**,
  an unknown or already-used one returns **400 `INVITE_INVALID`**.
- Acceptance issues a session, so the invitee is signed in without a second login.
- Password policy at creation: ≥ 12 characters with a letter and a digit. Login itself stays
  permissive so a policy change can never lock an existing user out.
- In production the plaintext token is **not** returned by the API — it must travel over the
  notification channel (not yet built).

**Invitation lifecycle.**

```text
POST   /organizations/:id/memberships/:userId/invite/resend   → rotate + re-deliver
DELETE /organizations/:id/memberships/:userId/invite          → revoke (idempotent)
```

- **Resend rotates** the token: the previously mailed link stops working in the same write, so a
  mis-sent or leaked invite cannot be replayed after a resend.
- **Revoke** destroys the token and marks the membership `REVOKED`; repeating the call is a no-op
  (`alreadyRevoked: true`).
- Both refuse an **ACTIVE** member with 409 — resending must never become a credential reset, and
  cancelling an active member is offboarding, not invitation management.
- Resending a **REVOKED** invitation re-opens it (`reopened: true`) instead of dead-ending the user.

### Event notifications

Two events email the client automatically, both dispatched after the response is sent:

| Event | Trigger | Who receives it |
|---|---|---|
| `DELIVERABLE_RELEASED` | a deliverable moves to `RELEASED` (approval alone sends nothing) | ACTIVE members holding `CLIENT_OWNER` or `CLIENT_APPROVER` |
| `REQUEST_STATUS_UPDATED` | a legal request transition actually changes the status | the request's requester |

Each send is written to `notification_deliveries` with `kind`, the recipient, the provider `messageId`
and `subject_request_id` / `subject_deliverable_id`. A failure joins the same retry queue as an invite —
and because the subject is recorded, a retry **rebuilds** the email from the current data instead of
replaying a stored string.

The dispatcher is in-process (`enqueueEvent` / `drainEventQueue`). That suits a single-node deploy; a
durable queue (BullMQ on the configured Redis) is the next step if jobs must survive a restart.

### Notification retries

A failed delivery is not a dead end. It enters a retry queue with an exponential schedule
(`60s → 5m → 15m → 1h → 6h`), capped by `NOTIFICATION_MAX_ATTEMPTS` (default 5):

- a background worker sweeps every `NOTIFICATION_RETRY_INTERVAL_SECONDS` (default 300, `0` disables it)
- `POST /api/v1/notifications/retry` runs one sweep immediately, scoped to the caller's tenant
- `GET /api/v1/notifications/deliveries` is the audit: every attempt, with `attempt`, `nextAttemptAt`,
  the driver, the provider `messageId` and the truncated error

Each retry **rotates the invite token**, because only the hash is stored — there is no link to replay.
That is safe when the previous attempt failed, but it does invalidate links from earlier attempts, so a
deliberate resend remains the right tool after an ambiguous SMTP timeout.

### Notification delivery

The API never talks to a mail provider directly. It builds a typed payload
(`apps/api/src/notifications/types.ts`) and hands it to the driver chosen by `NOTIFICATION_DRIVER`:

| Driver | Behaviour | Allowed |
|---|---|---|
| `smtp` | real delivery via nodemailer (TLS / STARTTLS / auth) | production — requires `SMTP_HOST` |
| `console` | prints the accept URL to stdout | dev/test only |
| `memory` | captures messages in an outbox for assertions | any |
| `noop` | sends nothing; the receipt says `skipped` | any (production default when unset) |
| `failing` | always fails — error injection for tests | dev/test only |

**Security boundary:** `console` (would put tokens in container logs) and `failing` are refused at
boot in production, and `smtp` without `SMTP_HOST` throws rather than starting — the process fails
loudly instead of accepting invitations nobody can receive. Every invite/resend response carries
`delivery: { status: "sent" | "failed" | "skipped", driver, messageId?, auditId }`. Delivery happens
*outside* the database transaction, so a provider outage is reported in the response rather than
rolling back a committed invitation.

**Delivery audit.** Every attempt — sent, failed or skipped — is written to `notification_deliveries`
with the driver, the provider's message id, the error text, and foreign keys to the organization,
membership and user. The `auditId` in the response points at that row, so "did this client actually
get the email?" is a query, not an archaeology exercise in rotated logs.

Local relay for development and tests:

```bash
podman run -d --name gc3-mailpit -p 1025:1025 -p 8025:8025 docker.io/axllent/mailpit:latest
# SMTP on 1025, web UI + HTTP API on http://localhost:8025
```

`email-smtp.test.ts` drives a real relay and asserts what the server received; if Mailpit is not
running that block skips itself instead of failing.

**Not yet implemented:** refresh tokens, revocation lists, login rate limiting/lockout, delivery
retry/backoff, bounce handling, and a read API for the delivery log.

---

## Database

Local PostgreSQL runs in Podman (no host install required):

```bash
podman run -d --name gc3-postgres \
  -e POSTGRES_USER=gc3 -e POSTGRES_PASSWORD=gc3 -e POSTGRES_DB=gc3_portal \
  -p 5432:5432 -v gc3-pgdata:/var/lib/postgresql/data docker.io/library/postgres:16
```

| Database | URL | Used by |
|---|---|---|
| `gc3_portal` | `postgresql://gc3:gc3@localhost:5432/gc3_portal?schema=public` | development |
| `gc3_portal_test` | `postgresql://gc3:gc3@localhost:5432/gc3_portal_test?schema=public` | `pnpm test` only |

Migrations live in `apps/api/prisma/migrations`. Prisma 7 notes that shaped this setup:

- the datasource URL is configured in `apps/api/prisma.config.ts`, not in `schema.prisma`;
- the `prisma-client` generator writes the client to `apps/api/src/generated/prisma` (git-ignored —
  run `pnpm db:generate` after cloning or changing the schema);
- the client requires a driver adapter (`@prisma/adapter-pg`), and env vars are no longer auto-loaded,
  so the API entrypoint imports `dotenv/config` before reading `process.env`.

### Tenancy model

```text
Organization 1 ──< Membership >── 1 User
                     │
                     └── roles: CLIENT_OWNER | CLIENT_TEAM_MEMBER | CLIENT_APPROVER
```

`User` is a global identity; `Membership` is the tenant-owned record binding a user to one
organization, and it is the only path to access. Isolation is enforced twice:

1. **Route layer** — `requireTenantScope` parses `x-organization-id`; `requireMatchingTenant` rejects a
   route param that differs from the scope (403).
2. **Repository layer** — every method takes the scope as its first argument (`findByIdScoped`,
   `listScoped`, `inviteScoped`). There is no unscoped read to call by accident, and a foreign id
   returns `null`, so tenants cannot probe for each other's existence.

`AuditEvent` records consequential writes (`organization.created`, `membership.invited`); it is
append-only by convention and scoped to the tenant where applicable.

### Phase 2 tables

```text
Organization 1 ──< ServiceCategory ──< ServiceRequest ──< RequestComment
                                            │
                                            └──< Deliverable
```

All four tables carry a **required, indexed `organization_id`**, and are only reachable through
scope-first repository methods. There is no global row for a tenant query to blend in, and no unscoped
read method exists — a handler cannot forget the tenant because it must supply one.

| Table | Notes |
|---|---|
| `service_categories` | per-tenant catalogue; slug unique **per tenant** |
| `service_requests` | `reference` unique per tenant, status/priority enums, requester + assignee, soft delete |
| `request_comments` | `is_internal` notes are excluded from client-facing reads by default |
| `deliverables` | `RELEASED` is refused by the repository until a named human has approved |

---

## Design system

Tokens are defined once in `apps/web/src/app/globals.css` under Tailwind v4 `@theme`, sourced from the
approved brand definition (`01-brand-and-design-system.md`):

- Surfaces: `void #07080B`, `void-secondary #0B0D12`, `graphite #11141A`, `graphite-elevated #171B22`
- Editorial: `mineral #F2EFE7`, `stone #E8E3D8`, `editorial #FAF8F3`, `warm #F4F0E8`
- Ink: `ink #111318`, `ink-secondary #474B52`, `muted #A7A9B0`
- Gold (authority, primary actions, selected states only): `gold #D9B65D`, `gold-light #E2C777`,
  `gold-deep #A97818`
- Type: Source Serif 4 (display) · Plus Jakarta Sans (body/controls) · IBM Plex Mono (labels/metadata)

Because `packages/ui` lives outside the web app's tree, `globals.css` registers it with
`@source '../../../../packages/ui/src'` — without that line Tailwind v4 will not emit the utility
classes used by shared components.

---

## Web portal

The Next.js app is connected to the live API. Every screen below is a client component that reads
its data through `apps/web/src/lib/api-client.ts`.

| Route | Screen | Talks to |
|---|---|---|
| `/login` | Sign-in | `POST /auth/login`, then `GET /auth/organizations` |
| `/dashboard` | Metrics, recent requests, quick actions | `GET /service-requests?pageSize=100` |
| `/requests` | Request list with status tabs | `GET /service-requests?status=…` |
| `/requests/new` | Create form (draft or submit) | `POST /service-requests` |
| `/requests/[requestId]` | Detail: metadata, transitions, edit form, comments, deliverables | `GET /service-requests/:id` + `/comments` + `/deliverables`, `PATCH /:id`, `POST /:id/status`, `POST /:id/comments`, `PATCH …/deliverables/:did/status` |
| `/categories` | Service catalogue: create, rename, retire, delete (read-only without `category:manage`) | `GET · POST /service-categories`, `PATCH · DELETE /service-categories/:id` |
| `/ops` | Operations console: cross-tenant totals, tenant table, pod load, routing queue, create pod. Restricted panel without `ops:read` | `GET /ops/dashboard`, `GET · POST /pods`, `PATCH /service-requests/:id/assign` |
| `/deliveries` | Delivery history: released assets, newest first | `GET /deliverables/history` |

### Session and headers

`src/lib/session.ts` holds the browser session; `src/lib/api-client.ts` is the only module that
calls `fetch`. It attaches both headers on every tenant-scoped call:

```text
authorization: Bearer <jwt>        — identity, 15-minute lifetime
x-organization-id: <org uuid>      — tenant scope
```

Omitting them fails loudly at the API, which is the point:

| Headers sent | Response |
|---|---|
| none | `401 UNAUTHENTICATED` |
| `authorization` only | `400 TENANT_SCOPE_REQUIRED` |
| both | `200` with that tenant's rows |

The session lives in `localStorage` (`gc3.portal.session`), not a cookie: the API is a separate
origin and expects a bearer token, so a cookie would buy nothing here. The cost is that
`httpOnly` protection is unavailable — which is why the token is short-lived, why an expired
session is dropped on read and the guard redirects to `/login`, and why every request is
re-authorised server-side regardless of what the UI shows.

### Environment

```bash
# apps/web/.env.local  (see .env.example)
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001/api/v1   # inlined into the client bundle
API_INTERNAL_BASE_URL=http://localhost:3001/api/v1      # server-side health probe
```

`NEXT_PUBLIC_*` is baked in at build time — rebuild after changing it.

API-side upload settings (`apps/api/.env`):

```bash
UPLOAD_DIR=storage        # relative to apps/api; where deliverable bytes are written
FILE_MAX_BYTES=10485760   # 10 MiB per file; larger uploads get 413 PAYLOAD_TOO_LARGE
```

Notification retry settings (same file):

```bash
NOTIFICATION_MAX_ATTEMPTS=5              # attempts per delivery before giving up
NOTIFICATION_RETRY_INTERVAL_SECONDS=300  # worker cadence; 0 disables the worker
```

### Known limits

- The organization switcher lists what `GET /auth/organizations` returns; staff see all tenants,
  clients see only their ACTIVE memberships.
- Deliverable Approve/Release buttons are shown from the caller's roles/client, which is a UI
  affordance only — `deliverable:review` is enforced by the API and an attempt without it fails 403.
- Staff can mark a comment as an internal note and it is filtered out of every client response; the
  form shows the toggle only to staff, and the API downgrades the flag if a client sends it.
- Deliverables carry `createdById` (stamped from the actor) alongside `approvedById`; the create form
  is staff-only and offers an optional file URL.
- Deliverable files can be **uploaded** (bytes stored by the API, SHA-256 recorded, verifiable) or left
  as an external URL. Uploading always appends a version and clears a prior approval.
- Files are stored on local disk (`UPLOAD_DIR`, default `apps/api/storage`) with no virus scanning,
  signed-URL expiry or retention job yet; a failed DB write after the bytes land leaves an orphan file.
- A mismatch under **Verify checksum** means the bytes on disk no longer match what was approved.
- Dashboard metrics are computed over the first 100 requests of the active tenant, not a SQL
  aggregate.
- Request editing is refused once a request is `CLOSED` or `CANCELLED` — the record is history by
  then (`409`).
- Category management is staff-only (`category:manage`); clients see the catalogue read-only, and the
  picker offers active categories only.

---

## Status

| Area | State |
|---|---|
| Workspace graph, strict TS baseline | done |
| Web app shell + brand tokens | done |
| API app shell, versioning, error envelope, tenant middleware | done |
| Shared types, validation, UI primitives | done |
| Prisma schema + migrations (organizations, users, memberships, audit) | done |
| Tenant-scoped repository layer | done |
| Auth: JWT issuance, `requireAuth`, scrypt credentials, bootstrap script | done |
| RBAC: ClientRole/StaffRole → permission map, platform-admin gate | done |
| Invite acceptance: hashed one-time token, password setup, activation | done |
| Invite lifecycle: resend/rotation, revocation, re-open | done |
| Notification seam with driver factory + production guards | done |
| SMTP driver (nodemailer) with HTML/text templates + escaping | done |
| Delivery audit table (`notification_deliveries`) with SENT/FAILED/SKIPPED | done |
| Phase 2 data layer: categories, requests, comments, deliverables (tenant-scoped) | done |
| Phase 2 API: Zod contracts + `/service-requests` routes with RBAC guards | done |
| Phase 2 UI: login, dashboard, request list/create/detail with live API | done |
| Phase 2 catalogue: `/service-categories` CRUD + category picker, request edit form | done |
| Phase 2 delivery: staff deliverable form with file refs, internal-note toggle | done |
| Phase 2 versioning: deliverable versions, re-approval on replace, `/deliveries` history | done |
| Phase 2 files: stored uploads with SHA-256, download, integrity check | done |
| Notifications: retry/backoff worker, manual sweep, delivery read API | done |
| Notifications: deliverable-released and status-updated event emails | done |
| Integration test harness (Vitest + Supertest, 241 tests) | done |
| Phase 3: operations console, pods, request routing | done |
| Delivery retry/backoff, bounce handling, delivery read API | retry + read API done; bounce handling not started |
| Token refresh / revocation, login rate limiting | not started |
| CI/CD, linting | not started (Phase 0 exit criteria) |

### Test coverage

| File | Covers |
|---|---|
| `foundation.test.ts` | the 8 foundation behaviours (health, missing/malformed scope, valid scope, in-scope read, cross-tenant 403, unknown route 404, unauthenticated 401) + correlation-id echo |
| `identity.test.ts` | persistence, validation detail, duplicate slug/membership, audit attribution, tenant isolation (HTTP and repository level) |
| `auth.test.ts` | login success/failure, no account enumeration, invited-without-password, suspended account, `/auth/me`, tampered/expired tokens, `lastSeenAt` |
| `rbac.test.ts` | route-level permission matrix, `PLATFORM_ADMIN` gate, INVITED/REVOKED membership denial, post-issuance suspension and revocation |
| `invite.test.ts` | invite → preview → activate → login, single-use token, concurrent double-accept, expired/revoked/unknown tokens, password policy, no half-activated account |
| `invite-lifecycle.test.ts` | resend rotation (old link dies, new one works), expiry extension, re-open after revoke, 409 on ACTIVE, RBAC denials, idempotent revoke, delivery dispatch, provider-failure resilience, noop honesty |
| `delivery-audit.test.ts` | audit rows for SENT/RESENT/FAILED/SKIPPED, `auditId` ↔ row identity, tenant scoping |
| `email-smtp.test.ts` | real SMTP relay round-trip, API→relay→accept-link, HTML escaping, unreachable relay recorded as FAILED |
| `service-requests.test.ts` | Phase 2 data layer: per-tenant categories, request CRUD + lifecycle timestamps, cross-tenant read/write refusal, internal-note filtering, deliverable approval/release rules |
| `service-request-api.test.ts` | HTTP layer: auth/scope gates, permission boundaries per role, transition rules (409 + idempotency), comment visibility, deliverable approval/release, AI-actor block, cross-tenant 404s |

All suites run against a real PostgreSQL database (never a mock) with `TRUNCATE ... CASCADE` between
cases. The permission guard was verified load-bearing: disabling `requirePermission` failed exactly
the seven negative-authorization tests and nothing else.

### Immediate next steps

1. Phase 2 step 7: stored file uploads (bytes + checksum) so a released asset is verifiable.
2. Delivery retry/backoff for FAILED rows, plus a `GET /organizations/:id/notifications` read API.
3. Token lifecycle: refresh tokens, revocation, login rate limiting.
4. Offboarding an ACTIVE member (session invalidation, retention rules).
5. ESLint + Prettier and a CI workflow running `typecheck`, `test` and `build`.
