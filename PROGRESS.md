# GC3 Portal — Progress Log

Status of each delivered slice, with the evidence that backs it. Source of truth for requirements is
`Development-Breif.md`; this file tracks what has actually been built and verified.

---

## Slice 0 — Monorepo foundation  ✅

**Commit:** `3b19258` — chore(scaffold): initialize Phase 0 pnpm monorepo
**Brief refs:** §10.1, §10.2, §11, §19

| Item | Detail |
|---|---|
| Workspace | pnpm + strict TS; `apps/web`, `apps/api`, `packages/{ui,types,validation}` |
| Web | Next.js 16 App Router, Tailwind v4 design tokens, brand typography |
| API | Express 5, `/api/v1` versioning, request-id + error envelope + tenant-scope middleware |
| Packages | shared domain types, Zod contracts, UI primitives |

**Evidence:** `pnpm -r typecheck` clean · `next build` clean · live API returns 200/400/404 on the
seven foundation routes · page rendered and inspected in a browser.

---

## Slice 1 — Database & Identity  ✅

**Commit:** `e4d8ae7` — feat(identity): persist tenants and memberships, lock the API contract with tests
**Brief refs:** §9 (data model), §12 (security/tenant isolation), §17 Phase 1

### What shipped

| Area | Detail |
|---|---|
| Database | PostgreSQL 16.15 in Podman (`gc3-postgres`, port 5432, volume `gc3-pgdata`) |
| ORM | Prisma 7.10.1 — `prisma.config.ts`, `prisma-client` generator, `@prisma/adapter-pg` driver |
| Tables | `organizations`, `users`, `memberships`, `audit_events` |
| Migrations | `20261104073108_init_identity`, `20261104074500_audit_actor_type_snake_case` |
| API | `POST /organizations`, `GET /organizations/:id`, `GET|POST /organizations/:id/memberships` |
| Isolation | route guard (`requireTenantScope` + `requireMatchingTenant`) **and** repository scope (`findByIdScoped` / `listScoped` / `inviteScoped`) |
| Audit | `organization.created`, `membership.invited` written transactionally |
| Tests | Vitest 5.1.0 + Supertest 7.3.1 — 20 tests over a real database |

### Data model

```text
Organization 1 ──< Membership >── 1 User
                     │
                     └── roles: CLIENT_OWNER | CLIENT_TEAM_MEMBER | CLIENT_APPROVER
```

`User` is a global identity. `Membership` is the tenant-owned record: no membership, no tenant access.
`AuditEvent` is append-only and tenant-scoped where applicable.

### Evidence

- `pnpm -r typecheck` — 5/5 packages clean
- `pnpm test` — **20/20 passed** (2 files, ~4.1 s)
- `prisma migrate status` — "Database schema is up to date!" (2 migrations)
- `prisma migrate diff` — "-- This is an empty migration." (zero drift)
- Live flow against Postgres: create 201 → read 200 → invite 201 → list 200 → duplicate 409
- DB row counts after the flow: organizations=1, users=1, memberships=1, audit_events=2
- Isolation proven load-bearing: disabling the repository scope guard failed **exactly** the isolation
  assertion, then passed again on revert

### Defects caught during this slice

1. `audit_events.actorType` was the only camelCase column (missing `@map`) — found by reading the live
   DDL, not by the tests. Fixed with a hand-written `RENAME COLUMN` migration that preserved 2 live rows.
2. The API runtime did not load `.env` (only the Prisma CLI did); the test suite masked it because
   Vitest injects env. Fixed with `dotenv/config` in the entrypoint.
3. Test helper at `tests/helpers/` used `../src/app`, which resolved to `tests/src/app`.

### Known gaps carried forward

- **Authentication is absent.** `POST /organizations` is open — it must never be exposed publicly.
- Timestamps are `timestamp(3)` **without** time zone (Prisma default); audit rows therefore lose zone
  context. To be corrected with `@db.Timestamptz(3)`.
- Invited users have no credential path; there is no invite-acceptance flow.
- No RBAC: membership `roles` are stored but not yet enforced anywhere.

---

## Next up (not started)

| Step | Scope |
|---|---|
| Auth & RBAC | JWT issuance, `requireAuth`, `PLATFORM_ADMIN` gate, ClientRole → permission mapping |
| Invite acceptance | Set password, transition membership INVITED → ACTIVE |
| Token lifecycle | Refresh/revocation, rate limiting on login |
| Phase 2 | Client portal foundation reading tenant-scoped data |
| Tooling | ESLint + Prettier, CI running typecheck/test/build |
