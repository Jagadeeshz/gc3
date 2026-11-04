# GC3 Portal

Multi-tenant operating platform for **Global Cloud Capability & Consulting (GC³)** — client portal,
delivery operations, pod workspaces, finance, and AI-augmented workflows.

Built to the **GC3 Development Brief v1.0** (`Development-Breif.md` in this folder). The repository is
at **Phase 1, slice 1**: identity and tenancy are persisted in PostgreSQL behind a repository layer,
with integration tests that pin the API contract and the isolation rules.

---

## Repository layout

```text
GC3/
├── apps/
│   ├── web/                  Next.js App Router + Tailwind CSS (port 3000)
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

| Method | Path | Status | Notes |
|---|---|---|---|
| GET | `/health` | implemented | Liveness + version, no tenant scope required |
| GET | `/meta` | implemented | Implemented vs planned endpoint inventory |
| GET | `/tenant-context` | implemented | Echoes the resolved tenant scope; proves the isolation chain |
| POST | `/organizations` | implemented | Creates a tenant (platform-level, **unauthenticated — do not expose**) |
| GET | `/organizations/:organizationId` | implemented | Tenant scope required; 403 if the path id ≠ scope, 404 if absent |
| GET | `/organizations/:organizationId/memberships` | implemented | Tenant-scoped membership list |
| POST | `/organizations/:organizationId/memberships` | implemented | Invites a member (upserts the global user, creates the membership) |

Response envelope (every response, success or failure):

```jsonc
{ "success": true,  "data": { /* payload */ } }
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "…", "requestId": "…" } }
```

Every response carries an `x-request-id` header; failures echo it as `error.requestId` so a client
report can be traced to a single request.

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

## Status

| Area | State |
|---|---|
| Workspace graph, strict TS baseline | done |
| Web app shell + brand tokens | done |
| API app shell, versioning, error envelope, tenant middleware | done |
| Shared types, validation, UI primitives | done |
| Prisma schema + migrations (organizations, users, memberships, audit) | done |
| Tenant-scoped repository layer | done |
| Integration test harness (Vitest + Supertest, 20 tests) | done |
| Authentication & session handling | not started — next |
| Role/permission enforcement beyond membership | not started |
| CI/CD, linting | not started (Phase 0 exit criteria) |

### Test coverage

`apps/api/tests/foundation.test.ts` pins the seven Phase 0 API behaviours (health, missing scope,
malformed scope, valid scope, in-scope read, cross-tenant 403, unknown route 404) plus correlation-id
echo. `apps/api/tests/identity.test.ts` covers persistence, validation detail, duplicate-slug 409,
audit writes, membership invite/list, and four isolation cases — including a repository-level assertion
that a foreign tenant id returns `null`.

The suite runs against a real PostgreSQL database (never a mock), with `TRUNCATE ... CASCADE` between
tests.

### Immediate next steps

1. Authentication: session issuance, password/OAuth provider, `requireAuth` middleware.
2. Permission enforcement: map `Role` → allowed actions; gate `POST /organizations` behind
   `PLATFORM_ADMIN`.
3. Expand the identity slice: membership status transitions (invite → active → revoked), soft deletes.
4. ESLint + Prettier and a CI workflow running `typecheck`, `test` and `build`.
5. Client portal foundation (Phase 2): first authenticated dashboard reading tenant-scoped data.
