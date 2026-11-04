# GC3 Portal — Progress Log

Status of each delivered slice, with the evidence that backs it. Source of truth for requirements is
`Development-Breif.md`; this file tracks what has actually been built and verified.

| Slice | Scope | Commit | State |
|---|---|---|---|
| 0 | Monorepo foundation | `3b19258` | ✅ delivered |
| 1 | Database & Identity | `e4d8ae7` | ✅ delivered |
| 2 | Auth & RBAC | `26f8a93` | ✅ delivered |
| 3 | Invite acceptance | — | in progress |

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

- ~~**Authentication is absent.**~~ Closed in slice 2 — all tenant routes require a bearer token and
  `POST /organizations` requires `organization:create`.
- ~~Timestamps without time zone.~~ Closed in slice 2 — migrated to `timestamptz(3)`.
- Invited users have no credential path; there is no invite-acceptance flow. **Still open.**
- No refresh tokens, no revocation list, no login rate limiting. **Still open.**

---

## Slice 2 — Auth & RBAC  ✅

**Commit:** `26f8a93` — feat(auth): JWT sessions, requireAuth and role->permission RBAC
**Brief refs:** §3 (roles & access), §12 (security), §8.3 (agent guardrails)

### What shipped

| Area | Detail |
|---|---|
| Credentials | scrypt (N=2^14, r=8, p=1) via `node:crypto` — no native dependency; self-describing digest `scrypt$N$r$p$salt$hash` |
| Tokens | HS256 JWT (jose), 15-min default TTL, issuer + audience checked, `sub`/`email`/`platformRole` claims |
| Login | `POST /auth/login` — uniform 401 for unknown email, wrong password, and invited-without-password; unknown email burns a dummy scrypt so timing does not enumerate accounts |
| Session introspection | `GET /auth/me` (actor + permissions), `GET /auth/config` (token TTL) |
| Middleware | `requireAuth` verifies the token **and re-reads the user**, so suspension/revocation takes effect immediately |
| Authorization | `requirePermission(...)` — routes declare a permission, never a role |
| Role mapping | `ClientRole`/`StaffRole` → 7 granular permissions in `src/auth/permissions.ts` |
| Tenant creation | `POST /organizations` gated behind `organization:create` (PLATFORM_ADMIN, OPERATIONS_MANAGER) |
| Bootstrap | `pnpm auth:bootstrap` provisions the first staff account (no public registration exists) |
| Schema | `users.password_hash`, `users.platform_role`; all timestamps → `timestamptz(3)` |
| Migration | `20261104080000_auth_rbac_timestamptz` |
| Tests | 56 total across 4 files (was 20) |

### Permission matrix

| Permission | Client owner | Team member | Approver | Platform admin | Ops manager | Account mgr |
|---|:--:|:--:|:--:|:--:|:--:|:--:|
| `organization:read` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `organization:create` | — | — | — | ✅ | ✅ | — |
| `membership:read` | ✅ | — | — | ✅ | ✅ | ✅ |
| `membership:invite` | ✅ | — | — | ✅ | ✅ | — |
| `tenant:context` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

A tenant-scoped request resolves permissions from the caller's **ACTIVE** membership; staff roles add
theirs on top. `INVITED` and `REVOKED` memberships grant nothing.

### Evidence

- `pnpm -r typecheck` — 5/5 clean
- `pnpm test` — **56/56 passed** (4 files, ~16 s)
- `prisma migrate status` up to date · `migrate diff` empty · DDL confirmed `timestamptz`
- Live flow: no token → 401 · wrong password → 401 · login → 200 + 3-segment JWT · create tenant
  with token → 201 · scoped read → 200 · wrong scope → 403 · `/auth/me` → permissions list
- **Mutation check:** disabling `requirePermission` failed **exactly the 7 negative-authorization
  tests** (client-cannot-create-tenant, specialist-cannot-create, INVITED membership, REVOKED
  membership, team-member-cannot-list, approver-cannot-list, approver-cannot-invite) while every
  positive path stayed green. Reverted and re-ran 56/56.

### Contract changes to note

- Every tenant route now requires `Authorization: Bearer <token>`; unauthenticated calls return 401
  (this is the 8th foundation behaviour, added deliberately).
- The seven Phase 0 behaviours are otherwise unchanged.

---

## Next up (not started)

| Step | Scope |
|---|---|
| Invite acceptance | Set password, transition membership INVITED → ACTIVE (closes the "invited user can never log in" gap) |
| Token lifecycle | Refresh tokens, revocation list, rate limiting / lockout on login |
| Phase 2 | Client portal foundation: authenticated dashboard reading tenant-scoped data |
| Tooling | ESLint + Prettier, CI running typecheck/test/build |
| Hardening | Password policy on set, audit events for login success/failure |
