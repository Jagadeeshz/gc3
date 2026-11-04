# GC3 Portal

Multi-tenant operating platform for **Global Cloud Capability & Consulting (GC³)** — client portal,
delivery operations, pod workspaces, finance, and AI-augmented workflows.

Built to the **GC3 Development Brief v1.0** (`Development-Breif.md` in this folder). This repository
is at **Phase 0 — Foundation**: the environment, the package graph and the architectural guardrails
are in place; no domain persistence exists yet.

---

## Repository layout

```text
GC3/
├── apps/
│   ├── web/                  Next.js App Router + Tailwind CSS (port 3000)
│   └── api/                  Express + TypeScript REST API, /api/v1 (port 3001)
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
| Validation | Zod | 4.6.7 |
| Language | TypeScript (strict, no `any`) | 5.9.3 |
| Runtime | Node.js | ≥ 22 |
| Package manager | pnpm workspaces | 10.34.9 |

PostgreSQL + Prisma, Redis and object storage arrive with the slices that need them (Phase 1+).

---

## Commands

Run from the repository root.

```bash
pnpm install          # install the whole workspace
pnpm dev              # web + api together
pnpm dev:web          # Next.js only  → http://localhost:3000
pnpm dev:api          # API only      → http://localhost:3001/api/v1/health
pnpm typecheck        # tsc --noEmit across every package (topological order)
pnpm build            # build every package that defines a build script
pnpm clean            # clear build output
```

Copy `.env.example` to `.env` before the first run if you want to override defaults.

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
| GET | `/organizations/:organizationId` | 501 | Param + tenant validation wired; persistence lands in Phase 1 |

Response envelope (every response, success or failure):

```jsonc
{ "success": true,  "data": { /* payload */ } }
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "…", "requestId": "…" } }
```

Every response carries an `x-request-id` header; failures echo it as `error.requestId` so a client
report can be traced to a single request.

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
| Prisma schema + migrations | not started (Phase 1) |
| Authentication & membership | not started (Phase 1) |
| CI/CD, linting, test harness | not started (Phase 0 exit criteria) |

### Immediate next steps

1. Add Prisma + PostgreSQL and the identity/organization schema (Phase 1 slice 1).
2. Introduce a test harness (Vitest for units, Supertest against `createApp()`).
3. Add ESLint + Prettier and a CI workflow that runs `pnpm typecheck` and `pnpm build`.
4. Replace the `501` organization stub with a real repository-backed handler.
