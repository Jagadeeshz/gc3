# GC3 Portal

Multi-tenant operating platform for **Global Cloud Capability & Consulting (GC³)** — a client
portal, a staff operations console, a published commercial catalogue and a scrollytelling
marketing site, in one pnpm monorepo.

Built to the **GC3 Development Brief v1.0** (`Development-Breif.md`). The platform is complete
through the Master Roadmap and three further phases:

- **Phases 0–1 — foundation and identity.** pnpm monorepo, PostgreSQL schema, tenancy. Every
  tenant route is authenticated and authorised through a role → permission map; clients join
  through a hashed, single-use invitation delivered over SMTP with a permanent delivery audit.
- **Phase 2 — client portal.** Service requests, catalogue, comments, deliverables with versions,
  stored files with SHA-256 integrity, and event notifications.
- **Phase 3 — operations.** Cross-tenant console, pod workspaces and staffing, task breakdown,
  SLA tracking with risk alerts, durable dispatch on Redis.
- **Phase 4 — finance.** Subscription tiers, metered usage with hard plan guards, invoice
  generation in exact integer minor units, client and platform billing screens.
- **Phase 5 — hardening.** Queue health with a worker heartbeat, executive analytics, a security
  audit trail, rate limiting, hardened headers, a production build that is served, not just compiled.
- **Phase 6 — client interfaces.** Owner and member workspaces, role-derived navigation, a shared
  portal kit, and the `(client)` route group.
- **Phase 7 — staff dashboards.** Six role-based workspaces (pod member, pod manager, sales,
  operations, management, administrator) with tab counts fixed per persona.
- **Phase 8 — commercial catalogue.** Six capability pods as first-class data, served publicly and
  rendered by every surface — marketing, pricing and the client subscription screen.
- **Marketing and acquisition.** A three-act scrollytelling home page, a pricing page with a
  comparison table, a bento grid, a pod carousel, a ⌘K command palette, and a "Book a demo" form
  that persists to the database instead of showing a toast.

**386 integration tests across 33 files**, run against a real PostgreSQL (and a real Redis for the
durability suite). Nothing in this repository is verified against a mock database.

Local: web **http://localhost:3000** · API **http://localhost:3001/api/v1**

---

## Repository layout

```text
GC3/
├── apps/
│   ├── web/                  Next.js App Router + Tailwind v4 (port 3000)
│   │   └── src/
│   │       ├── app/(auth)/   login, chrome-free layout
│   │       ├── app/(client)/ the client workspace (15 screens)
│   │       ├── app/(ops)/    the staff console
│   │       ├── app/          public marketing: /, /pricing
│   │       ├── components/   portal shell + kit, ops panels, marketing, pricing
│   │       └── lib/          api client, session, nav config per role
│   └── api/                  Express + TypeScript REST API, /api/v1 (port 3001)
│       ├── prisma/           schema.prisma + 19 migrations
│       ├── prisma.config.ts  Prisma CLI config (datasource URL lives here in v7)
│       ├── scripts/          seeds, dev fixtures, prepare-test-db.mjs
│       ├── Dockerfile        multi-stage: migrate → seed → serve
│       └── src/
│           ├── db/           Prisma client + pg driver adapter
│           ├── repositories/ tenant-scoped data access
│           ├── routes/v1/    14 route modules
│           ├── middleware/   request id, tenant scope, rate limit, CORS, headers
│           ├── auth/         tokens, permission map, scrypt digests
│           ├── metering/     allowance guards
│           ├── audit/        audit log writer
│           └── observability/ heartbeat, queue health
├── packages/
│   ├── ui/                   Shared React components (@gc3/ui)
│   ├── types/                Domain interfaces and constants (@gc3/types)
│   └── validation/           Zod schemas (@gc3/validation)
├── docs/                     Architecture, workflow and module documentation
├── DEPLOYMENT.md             Vercel (web) + a long-running API host
├── PROGRESS.md               The build log, slice by slice, with evidence
├── Development-Breif.md      Product requirements & development handoff (source of truth)
├── GC3_Portal_Interactive_UI_Prototype.html   Approved UI prototype reference
├── render.yaml / fly.toml / railway.json      API deployment blueprints
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
| Queue | BullMQ on Redis, with an in-process fallback | 6.6.0 |
| Testing | Vitest + Supertest | 5.1.0 / 7.3.1 |
| Language | TypeScript (strict, no `any`) | 5.9.3 |
| API bundler | esbuild (extensionless ESM imports need bundling) | latest |
| Runtime | Node.js | ≥ 22 |
| Package manager | pnpm workspaces | 10.34.9 |

Redis backs durable dispatch. Object storage is still local disk — see *Known limits*.

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
pnpm --filter @gc3/api start:prod        # serve the esbuild bundle
pnpm --filter @gc3/api exec tsx scripts/seed-tiers.ts   # billing tiers
pnpm --filter @gc3/api exec tsx scripts/seed-pods.ts    # the six capability pods
pnpm --filter @gc3/api exec tsx scripts/dev-ops-dashboards-fixtures.ts   # dev staff for every persona
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
| GET | `/pods/staff` | bearer + scope | `task:read` — staff accounts that can be seated or assigned, with their pod count |
| POST | `/pods/:podId/members` | bearer + scope | `pod:manage` — seat a person, 201 with the refreshed roster, 409 if already seated |
| DELETE | `/pods/:podId/members/:userId` | bearer + scope | `pod:manage` — 204, 404 when not seated |
| GET | `/service-requests/:requestId/tasks` | bearer + scope | `task:read` — the internal checklist, oldest first. No client role holds it |
| POST | `/service-requests/:requestId/tasks` | bearer + scope | `task:manage` — carve out a work item; inherits the request's pod |
| PATCH | `/tasks/:taskId` | bearer + scope | `task:manage` — status, assignee, title, description, due date |
| POST | `/ops/sla/sweep` | bearer only | `ops:read` — run the SLA risk engine now, returns scanned / at risk / breached / alerted / skipped |
| GET | `/subscription` | bearer + scope | `finance:read` — plan, allowances, period and live usage with `OK · WARNING · EXCEEDED`; provisions the entry tier on first read and audits it |
| GET | `/subscription/tiers` | bearer + scope | `finance:read` — the platform price list |
| PATCH | `/subscription` | bearer + scope | `finance:manage` — move the tenant to another tier; audited with both codes, never touches invoices |
| GET | `/invoices` | bearer + scope | `finance:read` — paged, `?status=` filter, newest period first; ISSUED past its due date reads OVERDUE |
| POST | `/invoices/generate` | bearer + scope | `finance:manage` — bill one month (defaults to the last complete month); 409 if that month is already billed |
| GET | `/invoices/:invoiceId` | bearer + scope | `finance:read` — the bill with its line items |
| PATCH | `/invoices/:invoiceId/status` | bearer + scope | `finance:manage` — `ISSUED` (net 30), `PAID` (records the actor), `VOID`; every other move is 409 |
| GET | `/invoices/:invoiceId/download` | bearer + scope | `finance:read` — printable text document as an attachment |
| GET | `/ops/billing` | bearer only | `finance:read` — MRR, tier mix, invoice counts, outstanding vs settled, recent bills and the per-tenant ledger |
| GET | `/ops/queue/stats` | bearer only | `ops:read` — queue depth, registered schedulers, worker heartbeat and alert flags; never 500s, reports an absent worker instead |
| GET | `/ops/analytics` | bearer only | `ops:read` — turnaround (avg/median/p90), eight-week throughput, pod efficiency and six-month tenant growth; `?windowDays=` 7–365 |
| GET | `/ops/audit` | bearer only | `ops:read` — the security log, newest first; `?organizationId=`, `?action=`, `?actorId=`, `?since=` |
| PATCH | `/organizations/:organizationId` | bearer + scope | `organization:update` — rename / re-slug / timezone / region; only the fields sent are touched, and every change is audited with before/after |
| PATCH | `/organizations/:organizationId/memberships/:userId/roles` | bearer + scope | `membership:manage` — client roles only; the last active owner cannot be demoted (409) |

### Later endpoints (Phases 6–8, marketing)

| Method | Path | Auth | Notes |
|---|---|---|---|
| GET | `/pricing/pods` | public | The six capability pods, ordered; nothing tenant-scoped is exposed |
| POST | `/demo-requests` | public | The "Book a demo" form. Strict schema, IP stored only as a SHA-256 hash, identical response for every accepted request, audited |
| GET | `/ops/organizations` | bearer only | `directory:read` — the client list, without their work |
| GET | `/ops/staff` | bearer only | `directory:read` — who works here, their pods and open load |
| GET | `/ops/requests` | bearer only | `ops:read` — cross-tenant request board, paged |
| GET | `/ops/deliverables` | bearer only | `ops:read` — cross-tenant deliverable board |
| GET | `/ops/tasks` | bearer only | `task:read` — scoped in SQL: specialist → own, pod manager → pod, ops → all |
| GET | `/ops/my/requests` | bearer only | The caller's own work. The id comes from the token, never the query string |
| GET | `/ops/my/deliverables` | bearer only | Same rule for deliverables |
| GET | `/ops/workload` | bearer only | `task:read` — open tasks per person, never a utilisation percentage |
| GET | `/ops/catalogue` | bearer only | `ops:read` — pod staffing against capacity |
| GET | `/ops/notifications` | bearer only | `ops:read` — the delivery audit across tenants |
| GET | `/organizations/:id` (PATCH) | bearer + scope | `organization:update` — rename, slug, timezone, region; audited with before/after |
| PATCH | `/organizations/:id/memberships/:userId/roles` | bearer + scope | `membership:manage` — client roles only; the last active owner cannot be demoted (409) |

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
| `task:read` | — | — | — | ✅ | ✅ | ✅ | ✅ | ✅ | — |
| `task:manage` | — | — | — | ✅ | ✅ | ✅ | ✅ | — | — |
| `ops:read` | — | — | — | ✅ | ✅ | — | — | — | — |
| `finance:read` | ✅ | — | — | ✅ | ✅ | — | — | ✅ | ✅ |
| `finance:manage` | — | — | — | ✅ | — | — | — | — | ✅ |
| `membership:manage` | ✅ | — | — | ✅ | — | — | — | — | — |

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

### SLA commitments and risk alerts

A request carries a materialised delivery commitment (`sla_target_at`), taken from the service
category's `sla_delivery_hours` when it has one, otherwise from the priority default:

| Priority | Default commitment |
|---|---|
| URGENT | 8 hours |
| HIGH | 24 hours |
| NORMAL | 72 hours |
| LOW | 168 hours |

`computeSlaState()` (pure, in `apps/api/src/lib/sla.ts`) reports `NONE`, `ON_TRACK`, `AT_RISK`,
`BREACHED`, `MET` or `MISSED`. The warning window is the final quarter of the contract; a closed
request is judged by when it actually closed. Changing priority or service recomputes the target
**from creation**, so an escalation cannot buy more time.

The risk sweep runs on an interval (`SLA_SWEEP_INTERVAL_SECONDS`, default 300; 0 disables) and on
demand via `POST /ops/sla/sweep`. It emails the **state** once per request: AT_RISK, then again if it
escalates to BREACHED. `sla_alerted_state` is the dedupe, so repeated sweeps are silent. The recipient
is the request's assignee, then the pod lead — nobody is invented, and a request with no owner is
reported as `skipped` rather than mailing an unrelated administrator.

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

**Background work.** In-process by default (`EVENT_QUEUE_DRIVER=memory`): the API queues a job and drains
it immediately. With `EVENT_QUEUE_DRIVER=redis` the job is written to Redis before the response leaves,
a BullMQ worker delivers it, and both sweeps run as repeatable jobs — so an API restart no longer drops
pending alerts or retries. Delivery is **at-least-once**: a crash after sending but before acknowledging
re-sends, which is the right trade against losing mail.

**Not yet implemented:** refresh tokens, revocation lists, login rate limiting/lockout, bounce handling,
queue-depth monitoring, and a read API for the delivery log.

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

### Phase 4 tables

```text
SubscriptionTier (global price list)
        │
Organization 1 ──1 OrganizationSubscription ──> 1 SubscriptionTier
             │
             ├──< Invoice ──< InvoiceLineItem
             └──< UsageMeter            (unique on organization_id + key + period)
```

`SubscriptionTier` is the one deliberately **global** table: it is the platform's price list, identical
for every tenant, so it carries no `organization_id` and is written only by `db:seed:tiers`. Everything
else in finance is tenant-owned and cascades with the organization.

Money is stored as **integer minor units (paise)** in every column — `monthly_price_cents`,
`unit_amount_cents`, `subtotal_cents`, `total_cents` — because an invoice that rounds differently on two
machines is not an invoice. There is no `numeric`, no `float`, and no string money anywhere.

`UsageMeter` is unique on `(organization_id, key, period)` and incremented through an atomic upsert, so
two concurrent requests cannot lose a count. `period` is a `YYYY-MM` string, which is what makes a month
a first-class bucket rather than a date range every caller has to reconstruct.

| Table | Notes |
|---|---|
| `service_categories` | per-tenant catalogue; slug unique **per tenant** |
| `service_requests` | `reference` unique per tenant, status/priority enums, requester + assignee, soft delete |
| `request_comments` | `is_internal` notes are excluded from client-facing reads by default |
| `deliverables` | `RELEASED` is refused by the repository until a named human has approved |
| `subscription_tiers` | global price list: monthly price, request/storage/call/seat allowances, overage unit prices |
| `organization_subscriptions` | one per tenant, unique on `organization_id`; plan changes audited |
| `invoices` | per-tenant `number` (`INV-YYYY-MM-NNNN`), status enum, integer totals, `issued_at`/`due_at`/`paid_at`/`paid_by_id` |
| `invoice_line_items` | `TIER_FEE` / `USAGE` / `ADJUSTMENT`; carries the `meter_key` that produced it |
| `usage_meters` | counters per tenant + meter + period; storage in KB, money never stored here |

---

## Design system

Tokens are defined once in `apps/web/src/app/globals.css` under Tailwind v4 `@theme`, sourced from the
approved brand definition (`01-brand-and-design-system.md`):

- Surfaces: `void #07080B`, `void-secondary #0B0D12`, `graphite #11141A`, `graphite-elevated #171B22`
- Editorial: `mineral #F2EFE7`, `stone #E8E3D8`, `editorial #FAF8F3`, `warm #F4F0E8`
- Ink: `ink #111318`, `ink-secondary #474B52`, `muted #A7A9B0`
- Emerald (primary actions, positive states, active filters): `emerald-400 #34D399` → `emerald-300 #6EE7B7`,
  with `#04140D` as the label colour on a solid emerald button. Amber (`amber-300`) marks warnings, peak
  hours and minimum terms; it is never used for a primary action.
- Gold (authority and editorial accent only): `gold #D9B65D`, `gold-light #E2C777`,
  `gold-deep #A97818` — the marketing site's display accents. The portal moved its primary actions to
  emerald in Phase 6, because a gold button on a gold-accented page has no hierarchy.
- Type: Source Serif 4 (display) · Plus Jakarta Sans (body/controls) · IBM Plex Mono (labels/metadata)

Because `packages/ui` lives outside the web app's tree, `globals.css` registers it with
`@source '../../../../packages/ui/src'` — without that line Tailwind v4 will not emit the utility
classes used by shared components.

---

## Web portal

The Next.js app is connected to the live API. Every screen below is a client component that reads
its data through `apps/web/src/lib/api-client.ts`.

**Two route groups, two layouts.** Client screens live under `src/app/(client)` and internal staff screens
under `src/app/(ops)`. The group names are parenthesised, so **no URL changed** — they exist so each side
gets its own chrome: the client nav is Dashboard · Requests · Billing and never mentions `/ops`, while the
ops layout is wider, carries Operations · Analytics · Finance, and redirects a non-staff session to
`/dashboard`. Post-login routing is one predicate (`homePathFor`): staff → `/ops`, clients → `/dashboard`.

| Route | Screen | Talks to |
|---|---|---|
| `/login` | Sign-in | `POST /auth/login`, then `GET /auth/organizations` |
| `/dashboard` | Metrics, recent requests, quick actions | `GET /service-requests?pageSize=100` |
| `/requests` | Request list with status tabs | `GET /service-requests?status=…` |
| `/requests/new` | Create form (draft or submit) | `POST /service-requests` |
| `/requests/[requestId]` | Detail: metadata, transitions, edit form, comments, deliverables | `GET /service-requests/:id` + `/comments` + `/deliverables`, `PATCH /:id`, `POST /:id/status`, `POST /:id/comments`, `PATCH …/deliverables/:did/status` |
| `/categories` | Service catalogue: create, rename, retire, delete (read-only without `category:manage`) | `GET · POST /service-categories`, `PATCH · DELETE /service-categories/:id` |
| `/ops` | Operations console: cross-tenant totals, tenant table, pod load, routing queue, create pod. Restricted panel without `ops:read` | `GET /ops/dashboard`, `GET · POST /pods`, `PATCH /service-requests/:id/assign` |
| `/billing` | Tenant billing: plan, period, three usage meters with warning/exceeded states, invoice table, expandable line items, download. Owners read it; no client can change it | `GET /subscription`, `GET /invoices`, `GET /invoices/:id`, `GET /invoices/:id/download` |
| `/ops/billing` | Finance console: MRR, tier mix, invoice counts, outstanding vs settled, tenant ledger with per-tenant billing, and issue/settle/void actions for `finance:manage` holders | `GET /ops/billing`, `POST /invoices/generate`, `PATCH /invoices/:id/status` |
| `/deliveries` | Delivery history: released assets, newest first | `GET /deliverables/history` |

### Security posture (Phase 5)

```text
x-content-type-options: nosniff
x-frame-options: DENY
referrer-policy: no-referrer
cross-origin-opener-policy: same-origin
cross-origin-resource-policy: same-site
permissions-policy: geolocation=(), microphone=(), camera=(), payment=(), usb=()
content-security-policy: default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'
strict-transport-security: max-age=15552000; includeSubDomains   (production only)
x-ratelimit-limit / x-ratelimit-remaining / retry-after
```

Every response carries those headers, including 401s and 429s, and `x-powered-by` is removed. The CSP is
`default-src 'none'` because the API only ever serves JSON and one plain-text invoice — a compromised
response has nothing it is allowed to load.

**Rate limiting** is a fixed-window counter, per process:

| Limiter | Key | Default |
|---|---|---|
| `/auth/login` | client IP **and** submitted email | 20 per 15 min |
| everything else under `/api/v1` | `x-organization-id` when present, else IP | 600 per minute |

A tenant that runs out of budget cannot spend another tenant's, and a sign-in brute force cannot spend a
tenant's budget at all. `0` disables a limiter (the test suite runs with both off and turns them down
deliberately in `security.test.ts`). The counter is in memory, so N API nodes allow N times the ceiling —
Redis-backed counters are the upgrade path and the middleware shape would not change.

**Audit log.** `audit_events` records every consequential change with the actor, the target, a
before/after payload, and the request that caused it (`ip`, `user_agent`, `request_id`). The sensitive set
is exported as data (`SENSITIVE_AUDIT_ACTIONS`) so an omission is visible:

`organization.created`, `organization.updated`, `membership.invited`, `membership.invite_resent`,
`membership.invite_revoked`, `membership.invite_accepted`, `membership.roles_changed`,
`membership.revoked`, `subscription.tier_changed`, `subscription.auto_provisioned`, `invoice.issued`,
`invoice.paid`, `invoice.void`.

Read it at `GET /api/v1/ops/audit` (`ops:read`). Rows are appended, never updated: `recordAudit` never
throws, because a failed audit write must not roll back a committed business change — but it logs loudly,
since a silent gap in an audit trail is worse than a noisy one.

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

Durable background work (same file) — event emails and both sweeps can live on Redis instead of in the
API process:

```bash
REDIS_URL=redis://localhost:6379
EVENT_QUEUE_DRIVER=memory   # memory | redis — redis makes jobs survive an API restart
QUEUE_PREFIX=gc3            # namespace, so several environments can share one Redis
```

```bash
podman run -d --name gc3-redis -p 6379:6379 docker.io/library/redis:7-alpine
```

With `EVENT_QUEUE_DRIVER=redis` the API enqueues a job before the request returns and a worker delivers
it; `retry-sweep` and `sla-sweep` become repeatable jobs whose next run is stored in Redis rather than
in a `setInterval` countdown. The default is `memory`, which is what the test suite runs on — the
durability suite flips the driver per test against a throwaway prefix.

`REPO_ROOT/apps/api/scripts/` has the probes used to prove it: `queue-probe.ts` (queue in one process,
drain in another), `enqueue-live-event.ts` (queue an event while the API is stopped) and
`enqueue-job.ts` (fire a sweep by name).

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

## The commercial catalogue (Phase 8)

Six capability pods are seeded as first-class data (`apps/api/scripts/seed-pods.ts`, idempotent) and
served publicly. **Every price on the site is read from that endpoint** — no price literal exists in
a marketing component, so a card cannot advertise something the platform does not hold.

| Pod | Price | Capacity | Team (mgr / spec / agents) | Carries |
|---|---|---|---|---|
| Creative | $3,000/mo | 120 credits | 1 / 2 / 2 | — |
| Growth (Digital) | $6,000/mo | 240 credits | 1 / 4 / 4 | Creative |
| Strategy | $9,000/mo | 360 credits | 1 / 6 / 6 | Growth + Creative |
| Automation | $25/credit | custom | custom | — |
| Interactive | $25/credit | custom | custom | — |
| REMAU | $8,000/mo | 240h (280h peak) | shared pod, 3-month minimum | — |

Three decisions worth knowing:

1. **Stacking is stored, not restated.** `includesCodes` holds the rule, the card renders it, and a
   test computes the transitive closure (Strategy reaches Growth + Creative; Creative reaches nothing).
2. **The catalogue is arithmetically coherent.** Dividing each monthly price by its credit pool
   gives $25/credit for every pod — the same rate the custom pods are sold at. The pricing page has a
   *Per month ⇄ Per credit* toggle that derives this from the data rather than claiming it.
3. **Billing has not moved onto pods.** `subscription_tiers` bills in INR against requests, storage
   and API calls; pods are sold in USD against credit pools. Encoding USD credit plans into paise
   billing rows would make every invoice ambiguous about its own currency. A credit ledger
   (draw-down, rollover, overage at $25/credit) is the missing piece, and until it exists tenants are
   not billed on pods.

---

## Client interfaces (Phase 6)

Fifteen screens under `(client)`, each reading the API directly — no mock data anywhere.

| Route | Screen |
|---|---|
| `/overview` | The workspace at a glance: open requests, deliverables in review, allowance state |
| `/requests`, `/requests/new`, `/requests/[id]` | List, create, and the detail view with comments, transitions and deliverables |
| `/projects`, `/deliverables`, `/deliveries` | Work in flight, deliverables awaiting review, released history |
| `/services` | The service catalogue with the pod price strip |
| `/subscription`, `/billing` | Plan, allowances and invoices — owner only |
| `/messages`, `/support` | Threads and tickets |
| `/team`, `/pod`, `/knowledge` | Roster, pod routing status, navigation map |
| `/settings`, `/profile` | Tenant record (owner) and the member's own record |

**Navigation is derived from the role, not merely disabled.** A client member has no billing or
subscription entry at all — the owner sees 13 entries, a member sees 9, and `My Profile` is
member-only because an owner reaches their profile from Settings. The API enforces the same boundary;
hiding a link the server would refuse is not a security control, so both layers agree.

`/pod` is worth calling out: a client owner sees **whether each open request has been routed** and to
nothing more. Pod composition, individual workloads and internal task lists are staff data
(`ops:read`, `task:read`) and no client endpoint exposes them — an unrouted request is still a fact
the client is entitled to.

---

## Staff dashboards (Phase 7)

One route (`/ops`), six workspaces, tab counts fixed per persona:

| Workspace | Tabs |
|---|---|
| Pod member | 9 |
| Pod manager | 12 |
| Sales manager | 10 |
| Operations manager | 11 |
| Management | 10 |
| Administrator | 11 |

Every tab is marked `live`, `partial` or `unbacked` in `apps/web/src/lib/ops-nav.ts` — and that third
state is the point of the file. A tab with no model behind it names the model that would back it
rather than rendering invented numbers. Sales has no pipeline, so its Leads and Opportunities tabs say
so; there is no timesheet, so Team Performance reports task load and never a utilisation percentage.

Three permission boundaries keep the personas honest:

| Permission | Question | Held by |
|---|---|---|
| `directory:read` | who our clients are, who works here | admin, ops, pod manager, sales, management, finance |
| `ops:read` | what is in flight, across every tenant | admin, ops, pod manager, management, finance |
| `security:read` | who changed what (the audit log) | admin, ops, management |

A pod manager runs delivery without reading who demoted whom; the sales desk sees the client list
without seeing a single request; `MANAGEMENT` holds no create, update or manage permission at all, so
an executive seat is read-only by construction.

---

## Marketing site

The public surface is data-driven and dependency-light. No motion library: reveals ride
`animation-timeline: view()` on the compositor, and the only scroll listener is one rAF-throttled
progress bar. The governing rule is that a narrative page which renders blank until animated is a
broken page — content is visible if the CSS never applies.

| Element | Where | What it does |
|---|---|---|
| Orbital hero | `/` | Six glass discs driven by the live catalogue, cursor parallax, hover detail drawer, GPU transforms only |
| Three acts | `/` | The bottleneck → the paradigm → the pods, anchored and keyboard-reachable |
| Bento grid | `/` | Eight cells, 6-column rhythm, hover lift + edge light + detail expansion |
| Pod carousel | `/` | Track transform, arrows, dots, autoplay that pauses on hover and focus and never starts under `prefers-reduced-motion` |
| Command palette | `/` | ⌘K / Ctrl+K over real pods and real routes: ↑↓, ↵, esc, `combobox`/`listbox` roles |
| Pricing | `/pricing` | Comparison table in tabular figures, "Most specified" on Growth, buyer FAQ with `aria-expanded`, Per month ⇄ Per credit toggle |
| Book a demo | header | The form described below |

**One CTA, not two.** The header used to offer "Client Portal" and "Portal Access", both of which
resolved to `/login` — two doors into the same room, and no way to express interest without already
having an account. It is now **Book a demo** (primary) and **Sign in** (secondary).

**The demo form persists.** `POST /api/v1/demo-requests` writes to `demo_requests` and records an audit
entry. Being public and unauthenticated, it is deliberately narrow: a strict Zod schema with bounded
strings, the caller's IP stored only as a SHA-256 hash, and an identical response for every accepted
request so it cannot be used to probe which companies already exist. It stores a *request* — it does
not create a user, a tenant or a pipeline entry, because those are human decisions.

---

## Security additions in later phases

Beyond the headers, rate limiting and audit trail described above:

- `security:read` was split out of `ops:read`, so reading the log is a separate grant.
- The audit trail now also records `demo.request.created` and `organization.updated` with
  before/after values.
- `AGENT_PROHIBITED_ACTIONS` plus `forbidAgentCommercialAction` block every non-GET request from an
  `x-actor-type: AI_AGENT` caller, so the platform's own agents cannot execute payments, change
  pricing or terms, issue refunds, or release a client deliverable.
- Public endpoints (`/pricing/pods`, `/demo-requests`) expose nothing tenant-scoped — a test asserts
  the catalogue payload carries no organization field.

---

## Deployment

`apps/web` → **Vercel** (root directory `apps/web`, framework Next.js, env
`NEXT_PUBLIC_API_BASE_URL`).

`apps/api` → a **long-running host**, because it runs interval workers (retry sweep, SLA sweep) and a
worker heartbeat that a serverless platform cannot keep alive. `apps/api/Dockerfile` is multi-stage and
runs migrate → seed → serve; `render.yaml`, `railway.json` and `fly.toml` are committed as blueprints,
and `fly.toml` sets `auto_stop_machines = false` for the same reason.

```bash
pnpm install --frozen-lockfile
pnpm --filter @gc3/api build          # esbuild → apps/api/dist/index.js
pnpm --filter @gc3/api release        # migrate deploy + seed pods + seed tiers
node apps/api/dist/index.js
```

CORS is an allow-list (`WEB_ORIGIN`), never `*` — verified by sending a preflight with a foreign
origin and asserting no `access-control-allow-origin` comes back. Full instructions: `DEPLOYMENT.md`.

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
| Integration test harness (Vitest + Supertest, 386 tests across 33 files) | done |
| Phase 3: operations console, pods, request routing | done |
| Phase 3: pod membership and staffing | done |
| Phase 3: task breakdown and work allocation | done |
| Phase 3: internal SLA monitoring and risk alerts | done |
| Phase 3 polish: durable dispatch on Redis (events, retries, SLA) | done |
| Phase 4: subscription tiers, billing data layer, tier seeds | done |
| Phase 4: invoice generation engine, line items, status lifecycle | done |
| Phase 4: usage metering and hard plan guards | done |
| Phase 4: client billing page and platform finance console | done |
| Phase 5: queue health, worker heartbeat and console alerts | done |
| Phase 5: executive analytics (turnaround, throughput, pods, growth) | done |
| Phase 5: audit trail, security headers and rate limiting | done |
| Phase 5: production build, full suite, documentation | done |
| Phase 6: client owner and member interfaces, role-derived navigation | done |
| Phase 7: six role-based staff dashboards with scoping | done |
| Phase 8: capability-pod catalogue, seeded, served publicly, on every surface | done |
| Marketing: three-act home, pricing page, bento grid, carousel, command palette | done |
| Acquisition: "Book a demo" form persisting to `demo_requests` | done |
| Deployment: esbuild bundle, Dockerfile, Render/Fly/Railway blueprints, CORS allow-list | done (not deployed) |
| Billing on pods (credit ledger, rollover, overage) | not started — tiers still bill in INR |
| CRM: pipeline, stages, owners | not started — `demo_requests` stores the request only |
| Notification for new demo requests, and an ops screen for them | not started |
| Token refresh / revocation list | not started (login rate limiting is done) |
| CI/CD, ESLint, Prettier | not started (Phase 0 exit criteria) |
| Delivery retry/backoff, bounce handling, delivery read API | retry + read API done; bounce handling not started |
| Token refresh / revocation, revocation list | not started (login rate limiting is done) |
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

### Next steps, in priority order

1. **A credit ledger**, so pods can be billed: draw-down per request, rollover, overage at
   $25/credit, and invoices that state their currency without ambiguity.
2. **Demo requests as a working inbox** — `GET /ops/demo-requests` in the administrator console, plus
   a notification to sales on submit. The table already records everything that screen needs.
3. **CI**: a workflow running `typecheck`, `test` and `build` on every push, plus ESLint and Prettier.
4. **Token lifecycle**: refresh tokens and a revocation list; session invalidation on offboarding an
   active member.
5. **Object storage** for deliverable bytes — signed URLs, retention, and virus scanning.
6. **Retire `/foundation`**, which is still publicly reachable.
