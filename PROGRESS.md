# GC3 Portal — Progress Log

Status of each delivered slice, with the evidence that backs it. Source of truth for requirements is
`Development-Breif.md`; this file tracks what has actually been built and verified.

## Phase status

| Phase | Scope | State |
|---|---|---|
| 0 — Foundation | monorepo, design system, API shell | ✅ complete |
| 1 — Identity & Onboarding | identity, tenancy, auth, RBAC, invites, email delivery | ✅ **COMPLETE** |
| 2 — Client Portal & Service Requests | service catalogue, requests, comments, deliverables | 🚧 in progress (step 1) |

| Slice | Scope | Commit | State |
|---|---|---|---|
| 0 | Monorepo foundation | `3b19258` | ✅ delivered |
| 1 | Database & Identity | `e4d8ae7` | ✅ delivered |
| 2 | Auth & RBAC | `26f8a93` | ✅ delivered |
| 3 | Invite acceptance | `1aba41a`, `74d0853` | ✅ delivered |
| 4 | Invite lifecycle & email stub | `7348d0f`, `65c2aff` | ✅ delivered |
| 5 | Real email provider & delivery audit | `7a9c745`, `ff82ac4` | ✅ delivered |
| 6 | Phase 2 · Service request data layer | `8fa7acc`, `bdc98ca` | ✅ delivered |
| 7 | Phase 2 · Service request API | `eb3d433`, `41a1264` | ✅ delivered |
| 8 | Phase 2 · Service request UI | `0bb6e7e` | ✅ delivered |
| 9 | Phase 2 · Categories & request editing | `a119478`, `7a94ef8` | ✅ delivered |
| 10 | Phase 2 · Staff deliverables & internal notes | `68ac590`, `1e5d813` | ✅ delivered |
| 11 | Phase 2 · Deliverable versioning & delivery history | `351e1d4`, `be00a48` | ✅ delivered |
| 12 | Phase 2 · Stored file uploads & checksums | `f02c970`, `040eb38` | ✅ delivered |
| 13 | Notifications · retry/backoff & delivery read API | `bf229cd`, `7b8f5ad` | ✅ delivered |
| 14 | Notifications · deliverable-released & status-updated events | `b368a91`, `f3f99d1` | ✅ delivered |
| 15 | Phase 3 · Operations console, pods & request routing | `9474ff4` | ✅ delivered |
| 16 | Phase 3 · Pod membership & staffing management | `e62198f` | ✅ delivered |
| 17 | Phase 3 · Task breakdown & work allocation | `ed56399` | ✅ delivered |
| 18 | Phase 3 · Internal SLA monitoring & risk alerts | `e4b5847` | ✅ delivered |
| 19 | Phase 3 polish · Durable dispatch on Redis (events, retries, SLA) | `3666e2d` | ✅ delivered |

**Phase 3 — Delivery Operations, Pod Workspaces & SLA Tracking — is complete** (slices 15–19).

| 20 | Phase 4 · Subscription tiers & billing data layer | `d2ada56` | ✅ delivered |
| 21 | Phase 4 · Invoicing & line-item generation engine | `a4f816f` | ✅ delivered |
| 22 | Phase 4 · Usage tracking & subscription metering | `e3174a1` | ✅ delivered |
| 23 | Phase 4 · Client & admin financial dashboards | `e4fc68b` | ✅ delivered |

**Phase 4 — Finance, Invoicing & Subscription Billing — is complete** (slices 20–23). 328 tests across
28 files, migrations through `20261105000000_phase4_finance`, live-verified in the browser with a client
owner, a platform admin, an operations manager and a finance manager.

| 24 | Phase 5 · Queue & system observability | `d93c948` | ✅ delivered |
| 25 | Phase 5 · Platform executive analytics & usage reporting | `f9acf97` | ✅ delivered |
| 26 | Phase 5 · Audit logging, security hardening & rate limiting | `1ce7d1a` | ✅ delivered |
| 27 | Phase 5 · Production build, verification & documentation | `b2fab9e` | ✅ delivered |

**Phase 5 — System Hardening, Analytics & Production Readiness — is complete** (slices 24–27).

**The GC³ Portal Master Roadmap is closed.** Phases 0–5 are delivered: 52 commits, **362 tests across 31
files**, 16 migrations, 12 web routes and 31 API route groups. Everything below is verified against a real
Postgres, a real Redis and a real browser — nothing in this log is a mock or a projection.

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

## Slice 3 — Invite acceptance  ✅

**Commits:** `1aba41a` — feat(invite): token-based invite acceptance with password setup and activation
· `74d0853` — docs(progress): pin slice 3 to 1aba41a
**Brief refs:** §5.1 (client onboarding), §3 (roles), §12 (security)

### What shipped

| Area | Detail |
|---|---|
| Invite token | 32 random bytes (256-bit) base64url; only the SHA-256 is stored; 7-day TTL (`INVITE_TTL_HOURS`) |
| Issue | `POST /organizations/:id/memberships` mints the token; plaintext returned outside production, emailed in production |
| Preview | `GET /auth/invite/:token` — org name, roles, full name, **masked** email, expiry; 410 when expired |
| Acceptance | `POST /auth/accept-invite` — sets the scrypt password, INVITED→ACTIVE on both user and membership, burns the token, issues a session |
| Single use | Atomic claim: `updateMany` filtered on the live hash **and** INVITED status, so concurrent double-accept has exactly one winner |
| Password policy | ≥ 12 chars with a letter and a digit (creation only — login stays permissive so policy changes never lock anyone out) |
| Audit | `membership.invited`, `membership.invite_accepted` |
| Tests | 66 total across 5 files (was 56) |

### Evidence

- `pnpm -r typecheck` 5/5 clean · `pnpm test` **66/66 passed** (5 files, ~19 s)
- `prisma migrate status` up to date (4 migrations) · `migrate diff` empty
- Live flow: invite → 201 with a 43-char token · preview → 200 with `k••••@inviteflow.example` ·
  invited login → 401 · weak password → 400 (field-level detail) · accept → 200 + session ·
  tenant route with that session → 200 · direct login → 200 · token replay → 400 INVITE_INVALID ·
  preview after acceptance → 400
- `psql`: user `ACTIVE` with `scrypt$16384…` digest, membership `ACTIVE`, `invite_token_hash` NULL,
  `invite_accepted_at` stamped, audit rows show `membership.invited` + `membership.invite_accepted`
- **Mutation check:** removing the token burn and the claim-count check failed exactly the three
  single-use assertions (full-flow token-null, replay rejection, concurrent single-winner) while the
  other seven invite tests stayed green. Reverted → 66/66.

### Notes / limits

- The plaintext token is only exposed by the membership endpoint when `NODE_ENV !== production`.
  Production delivery needs the notification service, which is not built.
- No resend/rotate-invite endpoint yet, and re-inviting an existing member still returns 409.

---

## Slice 4 — Invite lifecycle & email delivery stub  ✅

**Commits:** `7348d0f` — feat(invite): resend/rotation, revocation and a pluggable notification seam
· `65c2aff` — docs(progress): pin slice 4 to 7348d0f
**Brief refs:** §5.1 (client onboarding), §11.1 (integration adapters), §12 (security)

### What shipped

| Area | Detail |
|---|---|
| Resend / rotation | `POST /organizations/:id/memberships/:userId/invite/resend` — new token, old link dies in the same write, expiry extended, 409 if the member is ACTIVE |
| Revocation | `DELETE /organizations/:id/memberships/:userId/invite` — token destroyed, membership REVOKED, **idempotent**, 409 if ACTIVE |
| Re-open | Resending a REVOKED invitation re-opens it (`reopened: true`) instead of dead-ending the user |
| Notification seam | `NotificationService` interface + driver factory: `console` \| `memory` \| `noop` \| `failing` |
| Delivery receipt | Invite and resend responses carry `delivery: { status, driver, messageId? }` |
| Security boundary | `console` and `failing` drivers are **refused at boot in production**; production default is `noop` |
| Resilience | Delivery runs outside the transaction — a provider failure is reported, never rolls back the invitation |
| Tests | 82 across 6 files (was 66) |

### Evidence

- `pnpm -r typecheck` 5/5 clean · `pnpm test` **82/82 passed** (6 files, ~29 s)
- No migration required — rotation and revocation reuse the slice-3 columns
- Live flow: invite → `delivery {status:"sent",driver:"console"}` · resend → `reopened:false`, 43-char
  token, `rotated=yes` · old link 400 · new link 200 · revoke → `status:"REVOKED"` · link 400 ·
  revoke again → `alreadyRevoked:true` · resend after revoke → `status:"INVITED", reopened:true`
- Access control live: resend without a token 401 · revoke without tenant scope 400
- Server log confirms the delivery path actually fired:
  `[gc3-api][email:console] to=rahul@lifecycle.example kind=resent org=Lifecycle Co 2 … url=http://localhost:3000/invite/<token>`
- Audit rows for the run: `membership.invited` ×2, `membership.invite_resent` ×2,
  `membership.invite_revoked` ×1
- **Mutation check:** stopping the rotation from storing the new hash, and stopping revoke from
  clearing the hash, failed **exactly 3** tests — rotation (old link dies / new works), revoke
  (token destroyed), and re-open-after-revoke — with the other 13 lifecycle tests green. Reverted → 82/82.

### Notes / limits

- `console` prints the full accept URL, which is fine for a developer terminal and unacceptable in
  production logs — hence the boot-time refusal rather than a documentation note.
- `noop` reports `skipped`, never `sent`; a green 201 must not imply an email left the building.
- A real provider (SMTP/SES/Postmark) only needs to implement `NotificationService`.

---

## Slice 5 — Real email provider & delivery audit  ✅

**Commits:** `7a9c745` — feat(email): SMTP driver and a permanent delivery audit
· `ff82ac4` — docs(progress): pin slice 5 to 7a9c745
**Brief refs:** §11.1 (integration adapters), §12 (auditability), §14 (notifications)

### What shipped

| Area | Detail |
|---|---|
| SMTP driver | `SmtpNotificationService` (nodemailer): implicit TLS or STARTTLS, optional auth, explicit connect/greeting/socket timeouts |
| Templating | plain-text + brand-consistent HTML; every tenant-supplied string HTML-escaped |
| Failure semantics | transport errors become `status: "failed"` receipts — never thrown, never swallowed |
| Delivery audit | new `notification_deliveries` table: one row per attempt (SENT / FAILED / SKIPPED) with driver, provider message id, error, and FKs to organization, membership and user |
| API surface | invite/resend responses now return `delivery: { status, driver, messageId?, auditId }` |
| Boot guards | `NOTIFICATION_DRIVER=smtp` without `SMTP_HOST` throws at startup; `console`/`failing` still refused in production |
| Tests | 91 across 8 files (was 82) |

### Evidence

- `pnpm -r typecheck` 5/5 clean · `pnpm test` **91/91 passed** (8 files, ~35 s)
- `prisma migrate status` 5 migrations up to date · `migrate diff` empty · `\d notification_deliveries`
  confirms enums, three FKs and the three indexes
- `email-smtp.test.ts` — **4/4 executed, none skipped**, against a real Mailpit relay:
  relay-level receipt, API→relay→accept-link end to end, HTML escaping of a `<script>` org name,
  and an unreachable relay recorded as FAILED
- Live (dev API on the `smtp` driver):
  invite → `delivery {status:"sent", driver:"smtp", messageId:"<e2bc795f…@gc3.local>", auditId:"38e6a85b…"}`
  · resend → second mail, `RESENT` row · Mailpit `total: 2` with subjects
  "You have been invited to Smtp Verify Co…" and "Reminder: your invitation to Smtp Verify Co…"
  · message body contains `http://localhost:3000/invite/<token>` and the expiry line; HTML CTA present
  · `psql`: 2 rows, both `SENT`, driver `smtp`, provider message ids stored
- **Mutation check:** forcing the audit status to `SENT` regardless of the receipt failed **exactly 3**
  tests — provider-failure audit, skip audit, and unreachable-relay audit — with the other 88 green.
  Reverted → 91/91.

### Notes / limits

- Local relay: `podman run -d --name gc3-mailpit -p 1025:1025 -p 8025:8025 axllent/mailpit`
  (SMTP 1025, HTTP API/UI 8025). The suite skips the relay block if it is not running.
- No retry/backoff on a failed dispatch, no bounce/complaint handling, and no read endpoint for the
  delivery log yet — the rows exist and are queryable, but only via SQL/tests.
- The audit row is intentionally outside the invite transaction: losing an audit row is bad, but
  failing a committed invitation because of it is worse.

---

## Slice 6 — Phase 2 · Service request data layer  ✅

**Commits:** `8fa7acc` — feat(requests): tenant-scoped service request data layer
· `bdc98ca` — docs(progress): pin slice 6 to 8fa7acc
**Brief refs:** §5.2 (request lifecycle), §6.2 (service catalogue), §9 (data model), §12 (tenancy)

### What shipped

| Area | Detail |
|---|---|
| Schema | four new tables + three enums; **every** table carries a required indexed `organization_id` |
| ServiceRequest | `reference` (`REQ-XXXXXXXX`) unique per tenant, status + priority enums, requester/assignee FKs, due/submitted/closed timestamps, soft delete |
| ServiceCategory | per-tenant catalogue, slug unique **per tenant** (same slug allowed across tenants), isActive + soft delete |
| RequestComment | `is_internal` flag; the client-facing list excludes internal notes by default rather than by call-site filter |
| Deliverable | approval/release rules encoded in the repository — `RELEASED` is refused until a named human has approved |
| Repositories | scope-first methods only (`createScoped`, `findByIdScoped`, `listScoped`, `updateStatusScoped`); no unscoped read exists to call by accident |
| Migration | `20261104110000_phase2_service_requests` (Prisma-generated, renamed to keep history monotonic) |
| Tests | 110 across 9 files (was 91) |

### Evidence

- `pnpm -r typecheck` 5/5 clean · `pnpm test` **110/110 passed** (9 files, ~39 s)
- `prisma migrate status` 6 migrations up to date · `migrate diff` empty
- `psql`: `service_requests`, `request_comments`, `deliverables`, `service_categories` all carry
  `organization_id`; 11 foreign keys across the four tables
- 19 new tests, all isolation-focused: cross-tenant read returns null, cross-tenant write changes
  nothing, cross-tenant category attachment is refused, comment/deliverable lists never leak
- **Mutation check:** removing `organizationId` from `findByIdScoped` and from the `listScoped` where
  clause failed **exactly 2** tests — "never returns another tenant's request by id" and "lists only
  the calling tenant's requests" — with the other 17 green. Reverted → 110/110.

### Notes / limits

- `ServiceCategory` is tenant-owned here. The Brief's platform-wide catalogue (§6.2) will be a
  *seeding* concern layered on top when that slice lands, not global rows that tenant queries must
  special-case.
- **No HTTP routes yet** — this step is schema + data layer only, as scoped. `POST /requests` etc. and
  their Zod contracts are the next step.
- The deliverable release guard lives in the repository and must be mirrored (not replaced) at the API
  layer, together with the `AGENT_PROHIBITED_ACTIONS` check for AI actors.

---

## Slice 7 — Phase 2 · Service request API  ✅

**Commits:** `eb3d433` — feat(requests): service request API with RBAC and workflow guards
· `41a1264` — docs(progress): pin slice 7 to eb3d433
**Brief refs:** §5.2 (request lifecycle), §5.4 (deliverable approval), §11 (API), §12 (tenancy), §8.3 (agent boundary)

### What shipped

| Area | Detail |
|---|---|
| Zod contracts | create / update / status-change / comment / deliverable schemas, plus param and list-query schemas in `@gc3/validation` |
| Routes | `POST · GET /service-requests`, `GET · PATCH /:id`, `POST /:id/status`, `GET · POST /:id/comments`, `GET · POST /:id/deliverables`, `PATCH /:id/deliverables/:deliverableId/status` |
| Permissions | seven new: `request:read`, `request:create`, `request:update`, `request:comment`, `deliverable:read`, `deliverable:create`, `deliverable:review` — mapped across 3 client and 6 staff roles |
| Workflow | transition table lives in `@gc3/types` and is enforced at the API (409 on illegal); repeating the current status is an idempotent no-op |
| Governance | release requires a prior human approval (repository + route); an `AI_AGENT` actor is blocked before the permission check even runs |
| Comments | a client can never author an internal note — the flag is downgraded, not rejected |
| Tests | 138 across 10 files (was 110) |

### Evidence

- `pnpm -r typecheck` 5/5 clean · `pnpm test` **138/138 passed** (10 files, ~55 s)
- 28 new HTTP tests: auth/scope gates, permission boundaries, transitions, comments, deliverables,
  isolation, validation
- Live run against the dev API:
  create → `201` `REQ-7A77D2A5` · list+filter → `total: 1` · `SUBMITTED → IN_PROGRESS` → `200` ·
  `IN_PROGRESS → CLOSED` → `409 CONFLICT` · comment → `201` · deliverable → `201 PENDING` ·
  release before approval → `403` · approve → `200` (approvedById set) · release → `200 RELEASED` ·
  own scope `200` / foreign scope `404` / no token `401` / no scope `400`
- `psql`: request `IN_PROGRESS` with `submitted_at` stamped; deliverable `RELEASED` with
  `approved_by_id` and `released_at` set; two internal comments
- **Mutation check:** disabling `requirePermission` failed **exactly 4** tests — the three
  permission-boundary denials and the deliverable-review denial — while all 24 others (isolation,
  validation, transitions, AI guard) stayed green. Reverted → 138/138.

### Notes / limits

- `priority` is filtered in memory over the returned page rather than in SQL; correct but it means a
  priority filter applies after pagination. Documented in the route.
- Service **categories** still have no HTTP surface — requests accept a `categoryId`, but catalogue
  management is the next step.
- No pagination-link headers; clients get `page` / `pageSize` / `total` and must build links.

---

## Slice 8 — Phase 2 · Service request UI  ✅

**Commit:** `0bb6e7e` — feat(portal): connect the Next.js UI to the live service request API
**Brief refs:** §5.2, §5.4, §11, §12 · layout structure from
`GC3_Portal_Interactive_UI_Prototype.html`

### What shipped

| Area | Detail |
|---|---|
| Screens | `/login`, `/dashboard`, `/requests`, `/requests/new`, `/requests/[requestId]` |
| Shell | Persistent sidebar (brand, org switcher, workspace nav, identity) + topbar, matching the prototype's structure |
| API client | `src/lib/api-client.ts` — the only module that calls `fetch`; attaches `authorization` and `x-organization-id` on every tenant call and surfaces the API's error envelope |
| Session | `src/lib/session.ts` + React context; localStorage, 15-minute expiry, expired session dropped on read and redirected |
| New endpoint | `GET /api/v1/auth/organizations` — the tenants the caller may act in (needed to choose `x-organization-id`) |
| Enforcement | transitions offered from `SERVICE_REQUEST_TRANSITIONS`, so illegal moves never render |
| Build | `next build` clean, 6 routes, strict TypeScript |

### Evidence

- `pnpm test` **142/142** across 10 files (was 138; +4 for `/auth/organizations`: staff sees all
  tenants, client sees only ACTIVE, INVITED excluded, 401 without a token)
- `pnpm -r typecheck` 5/5 · `pnpm --filter @gc3/web build` clean
- Browser, real server, real Postgres:
  - login `portal.verify@gc3.local` → `/dashboard`, session stored, tenant resolved to
    *Helios Cloud* from the picker
  - create via form → `201`, redirected to `/requests/ea763d6b…` showing `REQ-EA763D6B`,
    `SUBMITTED`, priority High
  - `→ Triage` → status `TRIAGE`, and the offered moves became *In progress · Blocked · Cancelled*
    (the transition table, not a hardcoded list)
  - comment posted → rendered as CLIENT VISIBLE
  - deliverable created → `PENDING` → **Approve** → `APPROVED` with approval date → **Release to
    client** → `RELEASED`
  - release attempted before approval → `403` "A deliverable cannot be released before a human has
    approved it"
  - tenant switch to *Invite Flow Co* → 0 requests; back to *Helios Cloud* → 1
  - header proof from inside the page: no headers `401 UNAUTHENTICATED`, auth only
    `400 TENANT_SCOPE_REQUIRED`, both `200`
  - session allowed to expire (15 min TTL) → guard redirected to `/login`

### Notes / limits

- Buttons are affordances; every action is re-authorised server-side. Deliverable Approve/Release
  is hidden below `CLIENT_OWNER`/`CLIENT_APPROVER`/staff, but a crafted request still gets 403.
- Comments from the form are client-visible; there is no internal-note toggle yet.
- Dashboard figures are counted over the first 100 requests, not a SQL aggregate.
- No request-edit form yet, though `PATCH /service-requests/:id` is implemented and tested.
- Brand palette (void/graphite/gold) applied to the prototype's *structure*; the prototype's own
  light placeholder colours were not carried over.

---

## Slice 9 — Phase 2 · Category management & request editing  ✅

**Commits:** `a119478` — feat(catalogue): service category CRUD and request editing UI
· `7a94ef8` — docs(progress): pin slice 9 to a119478
**Brief refs:** §5.2 (request edits), §6.2 (service catalogue), §11 (API), §12 (tenancy, RBAC)

Slice 8 was already recorded against `0bb6e7e` in the index above; no re-statement needed.

### What shipped

| Area | Detail |
|---|---|
| Category API | `GET · POST /service-categories`, `PATCH · DELETE /service-categories/:categoryId` — tenant-scoped, soft delete, slug derived from the name when omitted, `?includeInactive=true` to see retired ones |
| New permissions | `category:read` (every role), `category:manage` (PLATFORM_ADMIN, OPERATIONS_MANAGER) — routes declare permissions, never roles |
| Request editing | `PATCH /service-requests/:id` was delivered in slice 7; this slice adds the policy that a CLOSED/CANCELLED request can no longer be edited (409) and the form that drives it |
| Category UI | `/categories`: create, rename, re-slug, retire/reactivate, delete — with the catalogue rendered read-only for anyone without `category:manage` |
| Request UI | Edit form on the detail screen (title, description, priority, category) and a category picker on the create form |
| Regression test | A create with `description: null` now succeeds — the bug this slice found |

### Evidence

- `pnpm test` **162/162** across 12 files (was 142): +13 category tests, +7 request-editing tests
- `pnpm -r typecheck` 5/5 · `pnpm --filter @gc3/web build` clean, 8 routes
- Browser against the live API:
  - created *Cloud Migration* through the form → `201`, slug derived as `cloud-migration`
  - renamed it to *Cloud Migration & Modernisation* → row updated, slug deliberately unchanged
  - retired it → `RETIRED` badge, action flipped to Reactivate, and it disappeared from the
    create-request picker
  - duplicate name → `409` "A category with that slug already exists in this organization", surfaced
    in the UI
  - created *FinOps* with **no description** → `201` (this failed before the fix below)
  - edited a live request: title → "Provision the staging cluster (revised)", priority → Urgent,
    category → FinOps; header and metadata cards updated, editor closed
  - created *Quarterly FinOps review* with category FinOps → `REQ-4746CD7A`, `SUBMITTED`, with a
    `CATEGORY FinOps` card on the detail screen

### Bug found and fixed

The categories form sent `description: null` when the field was empty, and
`createServiceCategorySchema` accepted only `string | undefined` — so **creating a category with no
description failed with 400 "Invalid category payload"**. Caught in the browser, not by the tests
that existed at the time. Fixed on both sides: the schema now accepts `null` on create (normalised to
omitted), the form omits an empty description on create, and a test locks the behaviour.

### Notes / limits

- Deleting a category is a soft delete; historical requests keep their reference and simply show `—`
  for the name once the category is gone from the catalogue fetch.
- The category picker lists active categories only; a request pointing at a retired category keeps it.
- `category:manage` is staff-only by design — clients read the catalogue, they do not curate it.
- No bulk import or default catalogue seeding yet (§6.2's platform defaults are still a seeding task).

---

## Slice 10 — Phase 2 · Staff deliverables & internal notes  ✅

**Commits:** `68ac590` — feat(delivery): staff deliverable authoring and internal notes
· `1e5d813` — docs(progress): pin slice 10 to 68ac590
**Brief refs:** §5.4 (deliverables), §8.3 (human sign-off), §11 (API), §12 (tenancy, RBAC)

### What shipped

| Area | Detail |
|---|---|
| Deliverable authorship | `deliverables.created_by_id` (nullable, FK → users, `ON DELETE SET NULL`, indexed) with migration `20261104120000_deliverable_created_by`; the route stamps it from the actor, so delivery history has an author as well as an approver |
| Staff deliverable form | Collapsible panel on the request detail screen: title, description, optional file URL (validated as a URL); renders the file as an "Open attached file" link |
| Internal-note toggle | Checkbox on the comment form, staff only, sending `isInternal: true`; the note is tagged `INTERNAL NOTE` in the thread |
| Client-side hint | Without the toggle, clients are told their comments are visible to the GC3 delivery team |
| Tests | 11 new: 7 for staff deliverable creation, 4 for internal-note privacy |

### Evidence

- `pnpm test` **173/173** across 14 files (was 162)
- Migration applied and verified in Postgres:
  `deliverables_created_by_id_fkey` + `deliverables_created_by_id_idx` present, `prisma migrate status`
  reports "Database schema is up to date!"
- Browser, two real sessions against the live API:
  - **staff** (`portal.verify@gc3.local`): internal toggle present → posted "Margin on this account is
    thin…" → thread shows `INTERNAL NOTE`; added *Staging access runbook* with
    `https://files.example.com/staging-runbook.pdf` → row shows `Open attached file ↗`, status `PENDING`
  - **client** (`client.owner@helios.test`, CLIENT_OWNER in the same tenant): the internal note's text
    is **absent**, no `INTERNAL NOTE` tag, the client-visible comment is present, no "Add deliverable"
    button, no internal checkbox, and the hint "Your comments are visible to the GC3 delivery team."
    is shown instead
  - API-level proof of the same: the client's comment payload contains no trace of the note text
    (asserted against the whole serialised response, not just the list)

### Notes / limits

- Internal notes are filtered in the repository query (`includeInternal: isStaff`), not after the fact,
  so they never enter a client response at all.
- A client sending `isInternal: true` is accepted and stored as `false` rather than rejected — a 400
  would confirm the existence of staff-only notes.
- Deliverables remain staff-produced; `deliverable:create` is held by PLATFORM_ADMIN,
  OPERATIONS_MANAGER, POD_MANAGER and SPECIALIST only. ACCOUNT_MANAGER can read and comment but not
  produce.
- The client still sees Move-this-request and Edit, which is correct per the matrix (CLIENT_OWNER
  holds `request:update`); the closed/cancelled guard applies to them too.
- No deliverable edit/replace or versioning yet — a deliverable is currently created once.

### Test-fixture lesson

Three tests failed initially because they seeded a request while authenticated as SPECIALIST or
ACCOUNT_MANAGER, and neither holds `request:create`. The fixtures now seed with a PLATFORM_ADMIN and
perform the action as the role under test — which is the correct shape anyway: the actor being tested
is not necessarily the actor who raised the request.

---

## Slice 11 — Phase 2 · Deliverable versioning & delivery history  ✅

**Commits:** `351e1d4` — feat(delivery): deliverable versioning and client delivery history
· `be00a48` — docs(progress): pin slice 11 to 351e1d4
**Brief refs:** §5.4 (deliverables), §8.3 (human sign-off survives content changes), §11 (API), §12 (tenancy)

### What shipped

| Area | Detail |
|---|---|
| Version model | `deliverables.version` counter plus an append-only `deliverable_versions` table (title, description, fileUrl, author, change note, timestamp). Migration `20261104130000_deliverable_versioning` **backfills v1 for every existing deliverable** |
| Edit/replace API | `PATCH /service-requests/:requestId/deliverables/:deliverableId` — `deliverable:update`, always writes a new version, rejects a deliverable that does not belong to the request in the path |
| Re-approval rule | Replacing content on an APPROVED or RELEASED deliverable clears `approvedById`/`approvedAt`/`releasedAt` and returns it to PENDING; the response carries `approvalReset: true` |
| Version history API | `GET /service-requests/:requestId/deliverables/:deliverableId/versions` — newest first, `deliverable:read` |
| Delivery history API | `GET /deliverables/history?limit=` — released assets across the workspace with the request each fulfils, plus `releasedCount`, `requestCount`, `latestReleasedAt` |
| New permission | `deliverable:update` (PLATFORM_ADMIN, OPERATIONS_MANAGER, POD_MANAGER, SPECIALIST) |
| UI | Version chip on each deliverable, "Edit content" form with a change note and an in-form warning when approval will be cleared, collapsible version list, and a new `/deliveries` page (nav: Deliveries) |
| Tests | 12 new across versioning and history |

### Evidence

- `pnpm test` **185/185** across 15 files (was 173)
- `pnpm -r typecheck` 5/5 · `next build` clean, 9 routes (`/deliveries` added)
- Migration verified in Postgres: backfill produced **3 deliverables → 3 v1 rows**, each with
  `change_note = 'Initial version'`
- Browser, staff session:
  - opened *Staging cluster runbook* history → `v1 · 04 Nov 2026 · Initial version`
  - "Edit content" on that **released** deliverable showed the in-form warning ("Saving will clear the
    approval and return it to Pending")
  - saved a replacement file with the note "Corrected cluster sizing after review" → notice
    *"Saved as version 2. The previous approval was cleared…"*, row became `v2 · PENDING ·
    Awaiting approval`
  - re-approved and released v2 → `APPROVED` → `RELEASED`
  - `/deliveries` → *Released assets 1 · Requests covered 1 · Latest release 04 Nov 2026*, entry
    `Staging cluster runbook v2`, `REQ-EA763D6B · released 04 Nov 2026`, with "View request →" and
    "Open file ↗"
- Browser, client session (`client.owner@helios.test`): the same history page shows the released v2
  with no "Edit content" control anywhere; the still-pending deliverable is absent from the page

### Notes / limits

- Release is the only thing that counts as delivery: APPROVED-but-unreleased assets never appear in
  the history, which is why the second deliverable (`PENDING`) is missing from it.
- `approvalReset` is returned so the UI can explain itself rather than silently dropping a sign-off.
- A deliverable edit is refused when the id does not belong to the requestId in the path — the same
  404 as a wrong tenant, so nothing leaks.
- Versions are immutable and never deleted individually; they follow the deliverable (cascade).
- File content is still a URL reference: the versions record *which* URL was current, not the bytes,
  so swapping the file behind an unchanged URL is invisible to this audit trail.

---

## Slice 12 — Phase 2 · Stored file uploads & checksums  ✅

**Commits:** `f02c970` — feat(delivery): stored file uploads with SHA-256 integrity
· `040eb38` — docs(progress): pin slice 12 to f02c970
**Brief refs:** §5.4 (deliverables), §8.3 (the sign-off must apply to the actual asset), §11 (API), §12 (tenancy)

### What shipped

| Area | Detail |
|---|---|
| Storage adapter | `src/storage/local-storage.ts` — `put`/`get`/`resolveStoragePath`, keys are `<orgId>/<deliverableId>/v<n>-<uuid>.<ext>`, traversal rejected, swappable for S3 without touching routes |
| Schema | `deliverables` **and** `deliverable_versions` gain `file_key`, `file_sha256`, `file_size`, `file_mime_type` (migration `20261104140000_deliverable_files`, all nullable) |
| Upload | `PUT /service-requests/:requestId/deliverables/:deliverableId/file` — raw bytes as the body, caller's `Content-Type` is the MIME type, SHA-256 computed on arrival. Always a new version; clears a prior approval like any content change |
| Download | `GET /deliverables/:deliverableId/file` — auth-gated, tenant-scoped, returns the exact bytes with `x-checksum-sha256` |
| Integrity | `GET /deliverables/:deliverableId/file/integrity` — re-reads the bytes and compares digests, returning `ok`, expected and actual |
| Contracts | MIME allow-list (PDF, images, text, CSV, JSON, ZIP, Office), 10 MiB cap, empty body rejected, `413 PAYLOAD_TOO_LARGE` for oversize |
| UI | "Attach file" / "Replace file" with a file picker and change note, a metadata line (`APPLICATION/PDF · 277 B · SHA256 CAC7D814122A`), **Download** and **Verify checksum** buttons with an inline OK / MISMATCH result |
| Tests | 12 new (upload contract, digest match, download bytes, tamper detection, approval reset, MIME/empty/oversize rejection, permissions, tenancy) |

### Evidence

- `pnpm test` **197/197** across 16 files (was 185)
- `pnpm -r typecheck` 5/5 · `next build` clean
- Migration applied; columns present on both tables
- Browser, real file (`gc3-demo-runbook.pdf`, 277 B):
  - uploaded through the file picker → notice *"Uploaded 277 B as version 3. The previous approval was
    cleared — it is back to Pending…"*
  - metadata line rendered `APPLICATION/PDF · 277 B · SHA256 CAC7D814122A`
  - **Verify checksum** → *"Checksum OK — stored bytes match the record"*
  - **Download** → no error surfaced
  - file rewritten on disk (277 B → 52 B, `cac7d814…` → `d8799cb5…`) → **Verify checksum** →
    *"Checksum MISMATCH — expected cac7d814122a…, found d8799cb5e171…"*
  - original bytes restored → **Verify checksum** → OK again
- `sha256sum` of the source file matched the digest the API recorded, byte for byte

### Bug found and fixed

The test suite was writing uploads into `apps/api/storage/` — **the same directory the dev server
uses**. My first tamper-test run proved it by accident: `find storage -type f | head -1` returned a
test-org file, not the demo file. Tests now run with `UPLOAD_DIR=storage/test` (set in
`vitest.config.ts` so it applies before any module reads env), and the stale test artifacts were
cleared. Verified: `storage/test` holds 7 test uploads, the dev org holds the single demo file.

### Notes / limits

- The upload contract is **raw body**, not multipart: the file's bytes are the request body and its
  `Content-Type` header is the type. Simpler for scripts and browsers alike, and it means the global
  JSON parser had to skip that path so the body survives as a Buffer.
- An upload is a content change, so it always appends a version and clears a prior approval — a
  released asset is never silently swapped.
- Files are local-disk only. There is no virus scanning, no signed-URL expiry, and no retention job.
- Orphan risk: if the DB write fails after the bytes land, the file is left unreferenced (no GC yet).
- External `fileUrl` still works for deliverables whose asset lives elsewhere; uploading replaces it
  with stored bytes.

---

## Slice 13 — Notifications · retry/backoff & delivery read API  ✅

**Commits:** `bf229cd` — feat(notifications): retry with backoff and a delivery read API
· `7b8f5ad` — docs(progress): pin slice 13 to bf229cd
**Brief refs:** §7 (notifications), §11 (API), §12 (tenancy, RBAC)

### What shipped

| Area | Detail |
|---|---|
| Schema | `notification_deliveries` gains `attempt`, `next_attempt_at`, `last_attempt_at` + an index on `(status, next_attempt_at)` (migration `20261104150000_notification_retry`). Existing rows default to `attempt = 1` with no schedule, so deploying it cannot re-send historical failures |
| Schedule | `60s → 5m → 15m → 1h → 6h`, capped by `NOTIFICATION_MAX_ATTEMPTS` (default 5) |
| Sweep | `runRetrySweep()` claims each due row by clearing its schedule (so two workers cannot double-send), skips memberships that are no longer `INVITED`, rotates the invite token, re-sends, and records a new attempt row with its own schedule |
| Worker | Started from the server bootstrap (`startRetryWorker`), every `NOTIFICATION_RETRY_INTERVAL_SECONDS` (default 300, `0` disables); skipped entirely under `NODE_ENV=test` |
| Manual control | `POST /notifications/retry` — one sweep on demand, **scoped to the caller's tenant**, `notification:manage` |
| Read API | `GET /notifications/deliveries` — filters (`status`, `kind`, `recipient`), pagination, and a status summary including `pendingRetry`; `notification:read` |
| New permissions | `notification:read` (PLATFORM_ADMIN, OPERATIONS_MANAGER, ACCOUNT_MANAGER), `notification:manage` (PLATFORM_ADMIN, OPERATIONS_MANAGER) |
| Tests | 11 new: queueing, no-op when not due, successful retry with token rotation, growing backoff, exhaustion, accepted-invite skip, permissions, read API filters/pagination/summary, tenant isolation |

### Evidence

- `pnpm test` **208/208** across 17 files (was 197)
- `pnpm -r typecheck` 5/5
- Migration applied; `attempt=1`, `next_attempt_at` null, `last_attempt_at` null on existing rows
- Live run against real SMTP, with the relay deliberately taken down:
  - `podman stop gc3-mailpit`, invite → `201` with `delivery.status = "failed"`,
    `error: connect ECONNREFUSED 127.0.0.1:1025`
  - `GET /notifications/deliveries?status=FAILED` → `total 1`,
    `summary {sent:1, failed:1, skipped:0, pendingRetry:1}`, entry `attempt=1, nextRetryIn=60s`
  - `podman start gc3-mailpit`, wait for the window, `POST /notifications/retry` →
    `{processed:1, sent:1, failed:0, exhausted:0, skipped:0}`
  - re-read → `summary {sent:2, failed:1, pendingRetry:0}`, rows `attempt=2 SENT` (with a real
    `messageId`) **and** `attempt=1 FAILED` still present — the failed attempt is not erased
  - Mailpit holds the message: `retry.demo…@helios.test | You have been invited to Helios Cloud on
    GC³ Portal`
- Boot log confirms the worker: `[gc3-api] notification retry worker every 300s (max 5 attempts)`

### Bug found and fixed

The sweep sent *before* checking the attempt budget, so a stale or hand-edited schedule could push a
chain past the cap. It now checks `attempt >= NOTIFICATION_MAX_ATTEMPTS` immediately after claiming and
abandons the chain with a note instead of sending. My own test for the exhausted case is what exposed
it — the first version expected one row and got two.

### Notes / limits

- Retries **rotate the invite token** and resend, because only the token hash is stored — there is no
  link to replay. Safe for the case this exists for (the previous attempt failed), but it does mean a
  retry invalidates links from earlier attempts, including the ambiguous case where SMTP timed out
  after accepting the message. A deliberate resend is the answer there, not this worker.
- The manual endpoint sweeps only the caller's tenant; the background worker sweeps every tenant.
- Only invitations exist today, so retry logic is written against that one payload shape. A second
  notification kind will need its own rebuild path.
- No bounce/complaint handling, no suppression list, no dead-letter queue — an exhausted chain leaves a
  terminal `FAILED` row for an operator to read.

---

## Slice 14 — Notifications · event dispatch (deliverable released, status updated)  ✅

**Commits:** `b368a91` — feat(notifications): deliverable-released and status-updated event emails
· `f3f99d1` — docs(progress): pin slice 14 to b368a91
**Brief refs:** §7 (notifications), §5.4 (delivery), §12 (tenancy)

### What shipped

| Area | Detail |
|---|---|
| Templates | `src/notifications/templates.ts` — one shared dark card shell, plain-text alternative for every email, invite + both event kinds. Every tenant-supplied string escaped |
| Drivers | `sendEvent()` added to all five drivers (console, memory, noop, failing, smtp); memory captures events in a **separate** outbox so invite assertions stay untouched |
| Schema | `NotificationKind` += `DELIVERABLE_RELEASED`, `REQUEST_STATUS_UPDATED`; `membership_id` now nullable (events target a person); `subject_request_id` / `subject_deliverable_id` record what the email was about (migration `20261104160000_notification_events`) |
| Dispatcher | `src/notifications/events.ts` — in-process queue with `enqueueEvent()` / `drainEventQueue()`, payload built from committed state, one audit row per recipient |
| Triggers | `POST /service-requests/:id/status` enqueues on a real change (not on a refused or no-op transition); `PATCH …/deliverables/:did/status` enqueues when the new status is `RELEASED`. Approval alone sends nothing |
| Recipients | Release → ACTIVE members holding `CLIENT_OWNER` or `CLIENT_APPROVER`; status change → the request's requester |
| Retry | Failed event emails join the same queue; `retryEventDelivery()` **rebuilds** the message from the request/deliverable instead of replaying a captured string, and abandons when the subject or recipient is gone |
| Refactor | Backoff moved to `src/notifications/schedule.ts` so the dispatcher and the sweep share it without a circular import |
| Tests | 7 new: release fan-out + audit rows, no email on approval, status email with from/to, no email on a refused transition, failure → retry queue → rebuilt retry, abandon when the subject is deleted, audit filter by kind |

### Evidence

- `pnpm test` **215/215** across 18 files (was 208)
- `pnpm -r typecheck` 5/5
- Live against Mailpit, one session each:
  - moved `REQ-EA763D6B` `TRIAGE → IN_PROGRESS` → Mailpit received
    *"Request REQ-EA763D6B is now IN PROGRESS"* to `portal.verify@gc3.local` (the requester), body:
    *"…moved from TRIAGE to IN PROGRESS. Follow it in the portal: http://localhost:3000/requests/ea763d6b…"*
  - approved then released *Staging cluster runbook* (v3) → Mailpit received
    *"Deliverable released: Staging cluster runbook (REQ-EA763D6B)"* to `client.owner@helios.test`, body:
    *"Helios Cloud has released a deliverable for request REQ-EA763D6B — Provision the staging cluster
    (revised). Deliverable: Staging cluster runbook (v3). Open it in the portal: …"*
  - `GET /notifications/deliveries` → `{sent:4, failed:1, skipped:0, pendingRetry:0}`, rows
    `DELIVERABLE_RELEASED SENT attempt=1` and `REQUEST_STATUS_UPDATED SENT attempt=1` alongside the
    earlier invitation attempts

### Bugs found and fixed

1. The audit query rejected `?kind=DELIVERABLE_RELEASED` with 400 — the validation enum still listed only
   the two invite kinds. Extended, with a test that filters by the new kind.
2. My "subject deleted" test asserted the wrong message: `ON DELETE SET NULL` clears
   `subject_deliverable_id` before the sweep runs, so the abandon reason is "no subject deliverable"
   rather than "no longer exists". The behaviour was right; the assertion and its comment now match it.

### Notes / limits

- The dispatcher is **in-process**, not durable: a restart between the response and the drain loses that
  job. This is the seam where BullMQ on the configured Redis belongs. What is not lost is the audit trail
  for anything that was attempted.
- A status-update retry does not know the original `fromStatus`, so it re-reads the current status and
  reports that. Still true, and arguably more useful hours later.
- Release fan-out is bounded to owners and approvers; a tenant with fifty of them gets fifty emails. No
  digesting yet.
- No per-user notification preferences and no unsubscribe — the client cannot opt out.

---

# Phase 3 — Staff Operations Console

Phase 2 is closed: the client-facing portal (requests, catalogue, deliverables, files, history) and its
delivery plumbing (invitations, retries, event emails) are built, tested and verified end to end.

Phase 3 turns the platform inward. The first slice introduces the operations surface: a cross-tenant
dashboard for platform admins and operations managers, pod structures, and the assignment handler that
routes a request to a pod.

---

## Slice 15 — Phase 3 · Operations console, pods and request routing  ✅

**Commit:** `9474ff4` — feat(ops): operations console, pods and request routing
**Brief refs:** §5 (staff operations), §11 (versioned API), §12 (tenancy)

### What shipped

| Area | Detail |
|---|---|
| Pod model | `pods` (tenant-owned, optional lead, unique `(organization_id, slug)`, soft delete) and `pod_members` (unique `(pod_id, user_id)`); `service_requests.pod_id` added, indexed, `ON DELETE SET NULL` — migration `20261104170000_pods_and_routing` |
| Ops dashboard | `GET /api/v1/ops/dashboard` behind `ops:read`: totals, one row per tenant, every pod with load, and the routing queue. `?organizationId=` narrows to one tenant, `?queueLimit=` 1–100 (default 20) |
| Pods API | `GET /pods` (`request:assign`) and `POST /pods` (`pod:manage`) — slug derived from the name, 409 on a duplicate slug inside a tenant, 400 when a member id does not exist |
| Routing | `PATCH /service-requests/:id/assign` (`request:assign`) takes `podId` and/or `assigneeId`, `null` clears either, and a pod from another tenant is a 404 rather than a silent no-op |
| Permissions | `ops:read` (ADMIN, OPS_MANAGER), `request:assign` (ADMIN, OPS_MANAGER, POD_MANAGER), `pod:manage` (ADMIN, OPS_MANAGER) |
| Shared helpers | `lib/request-status.ts` (a request is open until CLOSED/CANCELLED), `lib/slug.ts` (one slugify, used by categories and pods) |
| UI | `/ops`: six metric cards, tenant table, routing queue with a per-row pod selector, pod list with load, create-pod form. The sidebar gains a **Platform → Operations** group that only renders for admins and ops managers |
| Tests | 26 new across 2 files: role guards (9), cross-tenant aggregation (4), pod structure (6), routing (7) |

### Evidence

- `pnpm test` **241/241** across 20 files (was 215/19)
- `pnpm -r typecheck` 5/5; `next build` 10 routes, `/ops` included
- **Mutation check** (deliberately broken, then restored):
  - `ops:read` → `request:read` on the dashboard route: 3 role-guard tests failed
  - dropped the tenant filter from the pod lookup in `assignScoped`: the foreign-pod test failed
  - restored → 26/26 again
- Live, browser as `portal.verify@gc3.local` (PLATFORM_ADMIN):
  - console showed **7 tenants · 3 open · 3 unrouted · 0 pods**
  - created pod *Cloud Delivery* in Helios Cloud → banner "Pod created.", Pods **0 → 1**
  - routed `REQ-EA763D6B` via the queue selector → "Request routed to the pod.", Unrouted **3 → 2**,
    Helios row Unrouted **2 → 1**, the queue row now reads `HELIOS CLOUD · CLOUD DELIVERY · NO OWNER`
  - Postgres confirms: `pods` has `Cloud Delivery / cloud-delivery / Helios Cloud / 0 members`, and
    `REQ-EA763D6B` has `routed = t`, `REQ-4746CD7A` still `routed = f`
- Live denial, as a real `SPECIALIST` account created for this check:
  - `GET /ops/dashboard` → **403** "requires the `ops:read` permission, which your role does not grant"
  - `GET /pods` → 403; `PATCH /…/assign` → 403 (`request:assign`)
  - in the browser that account has no **Operations** nav entry, and `/ops` renders the restricted
    panel: *"It aggregates every tenant, so it is limited to platform administrators and operations
    managers. Your account (SPECIALIST) does not hold that access."*

### Bugs found and fixed

1. My dashboard seed sent `status: BLOCKED` to request creation, which only accepts DRAFT/SUBMITTED — the
   test now walks `IN_PROGRESS → BLOCKED` through the real transition endpoint. Two more seeds had the
   same flaw (`IN_PROGRESS`, `CLOSED`); all now transition rather than assert a state the API cannot
   create.
2. `notificationQuerySchema`'s `kind` filter had already been widened for event kinds, but the
   repository's filter type had not — typecheck caught the mismatch before it reached a request.

### Notes / limits

- `/ops` is mounted **without** tenant middleware on purpose. Consequence worth knowing: a client actor
  has no resolved permissions on a platform route at all, so they are refused before `ops:read` is even
  consulted. The assertion holds; the reason is broader than the permission.
- Pod membership can only be set at creation — there is no endpoint yet to seat or remove a member, edit
  a pod, or deactivate one. `is_active` exists and the routing handler honours it.
- The dashboard aggregates with `groupBy` and reduces in Node. Correct and cheap at seven tenants; at
  thousands it wants a materialised view.
- The queue orders by `dueAt` then `createdAt`. Priority is displayed but not weighted, so an URGENT
  request with no due date can sit below a routine one that is overdue.

---

## Slice 16 — Phase 3 · Pod membership and staffing  ✅

**Commit:** `e62198f` — feat(pods): pod membership and staffing management
**Brief refs:** §5 (pod management, resource allocation), §12 (tenancy)

### What shipped

| Area | Detail |
|---|---|
| Seating | `POST /api/v1/pods/:podId/members` (`pod:manage`) — 201 with the updated roster, 409 if the person is already seated, 404 for a pod in another tenant or an unknown user |
| Removal | `DELETE /api/v1/pods/:podId/members/:userId` (`pod:manage`) — 204, 404 when they were not seated, and a cross-tenant pod id removes nothing |
| Staff roster | `GET /api/v1/pods/staff` (`request:assign`) — every ACTIVE staff account with the role and how many pods in this tenant they already sit in. Client accounts never appear |
| Workload | Every pod read now returns its roster, and each seated person carries `openRequests` (open requests they own). `GET /pods` scopes that to the tenant; the ops view spans tenants |
| UI | `/ops` pod cards expand into a roster: each member with role and load, a **Remove** control, and a **Seat** control fed by the staff list. Staffing controls appear only for pods in the active workspace, with a note explaining why |
| Tests | 10 new: seating, duplicate, cross-tenant, permission gate, removal, removal 404, cross-tenant removal, per-person workload, staff list, client exclusion |

### Evidence

- `pnpm test` **251/251** across 21 files (was 241/20)
- `pnpm -r typecheck` 5/5
- Test detail: workload is asserted from the routing endpoint (`PATCH …/assign`), because request
  creation never took an assignee — a fact this slice's first test run exposed.

### Notes / limits

- Seating checks that the user *exists*, not that they are staff. A pod can hold a client account, and
  the test documents that: the seat grants no permission, so a seated client still gets 403 on
  `/pods/staff` and on `assign`. If that should be refused outright, it is a one-line guard.
- A pod's lead is not automatically seated on the roster — `leadId` and membership are separate.
- Load counts open requests only; tasks join the count in the next slice.

---

## Slice 17 — Phase 3 · Task breakdown and work allocation  ✅

**Commit:** `ed56399` — feat(tasks): task breakdown and work allocation
**Brief refs:** §5 (work queue, pod management), §12 (tenancy)

### What shipped

| Area | Detail |
|---|---|
| Data | `Task` model (`tasks`) with `requestId`, `podId`, `assigneeId`, `createdById`, `title`, `description`, `status` (`TODO`/`IN_PROGRESS`/`BLOCKED`/`DONE`/`CANCELLED`), `dueAt`, soft delete — migration `20261104180000_tasks`. Cascades with the request; pod and assignee are `SET NULL` |
| Create | `POST /api/v1/service-requests/:id/tasks` (`task:manage`) — 201 with `assigneeName` / `podName`; inherits the request's pod unless a pod is given; 404 for a foreign request or a foreign pod |
| Read | `GET /api/v1/service-requests/:id/tasks` (`task:read`) — oldest first, 404 on a foreign request |
| Update | `PATCH /api/v1/tasks/:id` (`task:manage`) — status, assignee, title, description, due date; empty body is a 400 rather than a silent no-op |
| Permissions | `task:read` (ADMIN, OPS, POD_MANAGER, SPECIALIST, ACCOUNT_MANAGER) and `task:manage` (ADMIN, OPS, POD_MANAGER, SPECIALIST). **No client role holds either** |
| Workload | Pod rosters and pods now report `openTasks` alongside `openRequests`, and each seated person carries both |
| UI | Request detail gains a staff-only **Internal tasks** checklist: per-task assignee select, status select, and an add form. `/ops` shows open task counts per pod and per person |

### Evidence

- `pnpm test` **264/264** across 22 files (was 251/21)
- `pnpm -r typecheck` 5/5
- 13 new tests: creation with names, inherited pod, foreign pod 404, foreign request 404, payload
  validation, client 403 on read *and* create, per-request isolation and ordering, TODO→IN_PROGRESS→DONE,
  reassignment and re-dating, empty/unknown-status rejection, cross-tenant PATCH 404, the
  read-only-account-manager split, and task counts in the pod roster

### Notes / limits

- Tasks are deliberately invisible to clients — the request detail payload has no `tasks` key, which the
  test asserts, so a client cannot infer internal structure even from a 200.
- `task:manage` is granted to SPECIALIST: the person doing the work can move their own item without
  needing a pod manager. There is no per-task ownership check, so a specialist can also update a
  colleague's task in the same tenant.
- No ordering field: the checklist is `createdAt` ascending. Reordering is not supported.

---

## Slice 18 — Phase 3 · Internal SLA monitoring and risk alerts  ✅

**Commit:** `e4b5847` — feat(sla): internal SLA monitoring and risk alerts
**Brief refs:** §5 (SLA monitor, operations dashboard), §7 (SLA risk detected), §12 (tenancy)

### What shipped

| Area | Detail |
|---|---|
| Commitment | `service_categories.sla_delivery_hours` (service-specific, per the brief) with a priority default when unset — URGENT 8h, HIGH 24h, NORMAL 72h, LOW 168h. `service_requests.sla_target_at` materialises it at creation (migration `20261104190000_sla`, existing rows backfilled from priority) |
| Engine | `lib/sla.ts`: pure `computeSlaState()` returning `NONE / ON_TRACK / AT_RISK / BREACHED / MET / MISSED`. The warning window is the final quarter of the contract; a closed request is judged by when it actually closed |
| Recompute | Changing priority or service recomputes the target **from creation** (an escalation cannot buy time) and re-arms the alert chain |
| Dashboard | totals and per-tenant rows gain `slaAtRisk` / `slaBreached`; every queue item carries `slaState` and `slaTargetAt`. `/ops` shows both cards, two table columns and an SLA badge per queue row |
| Alerts | `src/sla/monitor.ts`: one pass over open requests, one email per **state** per request (`sla_alerted_state` is the dedupe), escalation AT_RISK → BREACHED alerts again, recovery does not. Recipient is the assignee, then the pod lead, otherwise the request is reported `skipped` |
| Triggers | `POST /api/v1/ops/sla/sweep` (`ops:read`) plus an interval worker (`SLA_SWEEP_INTERVAL_SECONDS`, default 300, 0 disables) |
| Email | new `SLA_RISK` notification kind and template: subject names the state and reference, body carries the committed delivery time in IST and a deep link. Failed alerts join the existing retry queue and are rebuilt from the request on retry |
| UI | **Run SLA sweep** button on `/ops` reporting `scanned · at risk · breached · alerted · skipped` |
| Tests | 13 new: target from priority, service override, recompute on priority change, the pure state machine (NONE/ON_TRACK/AT_RISK/BREACHED/MET/MISSED), dashboard counts and queue states, alert once, escalation, pod-lead fallback + skip, `ops:read` gate, audit filter, and no alert to a client requester |

### Evidence

- `pnpm test` **278/278** across 23 files (was 264/22)
- `pnpm -r typecheck` 5/5; `next build` compiles with `/ops` and the request detail
- **Mutation check**: removing the `sla_alerted_state` dedupe made the "second sweep is silent"
  assertion fail; restored → 13/13 again
- Live, four roles in the browser:
  - **PLATFORM_ADMIN** on `/ops`: 7 tenants · 3 open · 2 unrouted · **SLA at risk 1** · 0 breached.
    *Run SLA sweep* → `SLA sweep: 3 scanned · 1 at risk · 0 breached · 1 alerted · 0 skipped`
  - Mailpit received *"SLA at risk: REQ-EA763D6B is approaching its commitment"* to
    `ops.specialist@gc3.local`, body naming the committed delivery time and the portal link
  - **SPECIALIST**: request detail shows **Internal tasks** with the assignee roster; added
    *"Draft the cluster sizing note"* assigned to themselves and moved it to `IN_PROGRESS`
    (Postgres confirms `IN_PROGRESS`, assignee `Ops Specialist`)
  - **CLIENT_OWNER**: same request shows no Internal tasks section and no task title; `/ops` shows the
    restricted panel; API returns 403 for `GET …/tasks`, `POST …/tasks`, `GET /pods/staff`, `GET /pods`
    and `GET /ops/dashboard`
  - **OPERATIONS_MANAGER**: full console — Operations nav, all eight metrics, tenant table with SLA
    columns, pod roster and queue

### Bugs found and fixed

1. **The specialist's request page was broken by a permission mismatch.** `GET /pods/staff` was gated on
   `request:assign`, which a SPECIALIST does not hold — so the detail page's `Promise.all` rejected and
   the whole page rendered "This action requires the request:assign permission". The roster is now gated
   on `task:read` (what the checklist actually needs), the page tolerates a failure to load assignees,
   and a regression test asserts a specialist can read the roster while a client cannot.
2. My first SLA fixtures set only `sla_target_at`; because the warning window is a fraction of the
   *contract*, shortening the target also shrank the window and the request read ON_TRACK. The fixtures
   now move both ends — the engine was right, the test was wrong.

### Notes / limits

- The sweep is **in-process** on a timer, like the notification dispatcher: a restart loses nothing
  because state is re-derived, but two API nodes would both sweep. The dedupe column makes that mostly
  harmless (only one email wins the race) rather than correct.
- `sla_alerted_state` is a plain string rather than an enum — cheap to extend, but nothing stops a typo
  at the database level.
- No pause/hold policy: the clock runs from creation through BLOCKED, so a request waiting on a client
  still breaches. The brief flags pause policy as a commercial decision.
- Compliance reporting (met vs missed percentages over time) is not built — only live states.

---

## Slice 19 — Phase 3 polish · Durable dispatch on Redis  ✅

**Commit:** `3666e2d` — feat(queue): durable dispatch on Redis for events, retries and SLA sweeps
**Brief refs:** §5 (SLA monitor, operations), §7 (notifications), §10.2 (Redis in the stack)

### Why

Slices 14–18 dispatched email and ran both sweeps from the API process. That is honest for one node but
it loses work in exactly the situation it matters: a restart between "the state change committed" and
"the email left". The cost of that gap is a client who is never told a deliverable was released, or a
pod that never hears its SLA is about to breach.

### What shipped

| Area | Detail |
|---|---|
| Dependency | `bullmq` 6.6 + `ioredis` 6, against the Postgres-adjacent Redis container (`redis:7-alpine`, port 6379) already implied by §10.2 |
| Primitive | `src/queue/durable-queue.ts` — a thin wrapper (`add`, `startWorker`, `scheduleEvery`, `counts`, `close`, `obliterate`) so nothing outside it imports BullMQ |
| Config | `EVENT_QUEUE_DRIVER` (`memory` \| `redis`, default `memory`), `QUEUE_PREFIX` (default `gc3`), reusing the existing `REDIS_URL` |
| Event dispatch | `enqueueEvent` writes to Redis and returns; a worker calls the same `processEventJob` the in-process path used, so delivery logic did not fork |
| Sweeps | `retry-sweep` and `sla-sweep` are **repeatable jobs** registered with `upsertJobScheduler`, so a restart refreshes the schedule instead of stacking a second copy, and the next run is stored in Redis rather than in a `setInterval` countdown |
| Worker | `src/queue/workers.ts` — one worker, three job names, unknown names logged and skipped (deploy skew is not a crash) |
| Lifecycle | `index.ts` starts durable workers or the old timers (never both); shutdown closes the worker so the job in hand finishes, then the queue — everything else stays queued |
| Tests | 5 new, against real Redis under a throwaway prefix |

### Evidence

- `pnpm test` **283/283** across 24 files (was 278/23)
- `pnpm -r typecheck` 5/5
- Durability suite (skips only if Redis is genuinely unreachable):
  - a job added with **no worker running** stays in `wait`, `completed` 0
  - producer closes, a **new queue instance** finds and processes the job
  - **two real processes**: one queues two jobs and exits, `waiting` is 2 with nothing attached; a
    second process starts a worker and drains both
  - `upsertJobScheduler` called three times leaves one scheduler
  - with `EVENT_QUEUE_DRIVER=redis`, the API's `enqueueEvent` puts the job in Redis, **no email is sent
    with no worker alive**, and starting the worker delivers it to the original requester
- Live, against Redis and Mailpit:
  - API **stopped**, job enqueued with `scripts/enqueue-live-event.ts` → `waiting: 1`, Mailpit 0
  - API started → boot log `durable dispatch on redis://localhost:6379 (prefix "gc3") — retry sweep
    every 300s, SLA sweep every 300s`; Mailpit *"Request REQ-EA763D6B is now TRIAGE"*
  - **delayed job** (10s) enqueued, API killed before it was due, waited past the delay with the API
    down (`delayed: 3`, Mailpit 0), API restarted → *"Request REQ-EA763D6B is now DELIVERED"*
  - `sla-sweep` job enqueued by hand → worker ran it → `REQ-4746CD7A` flipped to `sla_alerted_state =
    AT_RISK` and Mailpit received *"SLA at risk: REQ-4746CD7A is approaching its commitment"*
  - a second `sla-sweep` in the same state sent **nothing** (dedupe holds through the queue)
  - `retry-sweep` job ran clean: 0 failed jobs in Redis
  - schedule keys present: `gc3:gc3-work:repeat:retry-sweep`, `...:repeat:sla-sweep`

### Notes / limits

- **At-least-once, not exactly-once.** A crash after the email is sent but before the job is
  acknowledged re-sends it. The alternative — acknowledging first — loses mail, which is worse. The
  audit row is written per attempt, so a duplicate is visible rather than invisible.
- The event job carries only identifiers, as the retry sweep already did: the body is rebuilt from the
  database when the job runs, so a job that fires late reports current truth.
- BullMQ's stall recovery (`stalledInterval` / `lockDuration`) is configured but not asserted: the
  simulated-stall test was replaced by the real two-process test, because the stall path depends on
  lock expiry timings and asserting it made the suite slow and flaky. What is proven is the property
  that matters — a job outlives the process that queued it.
- A dead worker still leaves jobs in Redis; nothing alerts on queue depth yet. `queue.counts()` is the
  hook for that.
- `memory` remains the default so a fresh clone can run the suite without Redis; `.env.example`
  documents switching it on.

---

# Phase 3 — complete

| Slice | Delivered |
|---|---|
| 15 | Operations console, pods, request routing |
| 16 | Pod membership and staffing |
| 17 | Task breakdown and work allocation |
| 18 | Internal SLA monitoring and risk alerts |
| 19 | Durable dispatch on Redis |

Nine endpoints, three new tables (`pods`, `pod_members`, `tasks`), SLA columns and two notification
kinds added; the client portal was untouched by any of it except where it deliberately stays blind
(internal notes, tasks, the ops console). 283 integration tests, all against real Postgres, real Redis
and a real browser.

---

## Slice 20 — Phase 4 · Subscription tiers and billing data layer  ✅

**Commit:** `d2ada56`
**Brief refs:** §5 (plans, subscriptions), §9 (data model), §12 (tenancy)

### What shipped

| Area | Detail |
|---|---|
| Schema | `subscription_tiers`, `organization_subscriptions`, `invoices`, `invoice_line_items`, `usage_meters` + four enums — migration `20261105000000_phase4_finance` |
| Money | integer minor units everywhere (paise). No float, no decimal string, in the database or in the API |
| Tenancy | every table carries `organizationId` except `subscription_tiers`, which is the platform price list — the one deliberate global entity, documented as such in the schema |
| Tier seeds | `scripts/seed-tiers.ts` (idempotent upsert by code): Starter ₹25,000 / Professional ₹75,000 / Enterprise ₹2,50,000 per month, each with request, storage, API-call and seat allowances plus overage unit prices. Wired into `db:seed:tiers` **and** into `prepare-test-db` so a fresh test database behaves like production |
| Periods | `lib/period.ts` — one definition of "which month is this", shared by metering and invoicing so the two can never disagree |
| Meters | `usage.repository.ts` — atomic upsert per (tenant, meter, period); storage is counted in KB so the counter stays in int range to ~2 TB |
| Plan API | `GET /subscription` (plan + allowances + live usage), `GET /subscription/tiers`, `PATCH /subscription` (`finance:manage`) with an audit row naming both tier codes |
| Permissions | `finance:read` (ADMIN, OPS, ACCOUNT_MANAGER, FINANCE_MANAGER, CLIENT_OWNER), `finance:manage` (ADMIN, FINANCE_MANAGER) |
| Tests | 12: auto-provisioning + audit, idempotent reads, catalogue, warning/exceeded meter states, tier change + audit, client 403, unknown tier 404, malformed payload, tenant independence, and the read-permission matrix |

### Evidence

- `pnpm test` 12/12 in `subscription.test.ts` (full suite runs after slice 23)
- `pnpm --filter @gc3/api typecheck` clean
- Seed output: three tiers with `monthlyPriceCents` 2500000 / 7500000 / 25000000

### Decisions worth naming

- **Auto-provisioning, not refusal.** An organization with no subscription gets the entry tier on first
  read and an audit row saying why. A tenant created outside this flow should not be locked out of its
  own billing page.
- **Plan changes are human.** `finance:manage` is held by platform admins and finance managers only; a
  client owner can read the plan but cannot upgrade itself.
- **Allowances are per calendar month**, matching the meter period key. Proration for mid-cycle changes
  is deliberately not implemented — that is a commercial rule, not a technical default.

---

## Slice 21 — Phase 4 · Invoicing and line-item generation  ✅

**Commit:** `a4f816f`
**Brief refs:** §5 (billing), §7 (invoices generated), §12 (audit)

### What shipped

| Area | Detail |
|---|---|
| Calculator | `lib/billing.ts` — pure `computeBill(tier, usage, periodLabel)`: one `TIER_FEE` line, then a `USAGE` line per meter that exceeded its allowance. Requests per unit, storage per MB (KB→MB **rounded down**), API calls in 1,000-call blocks with a part block billed as a block. Tax is explicitly zero because no rate table exists in this deployment |
| Generation | `POST /invoices/generate` (`finance:manage`) — defaults to the **last complete month**, numbers bills `INV-YYYY-MM-NNNN` per tenant, writes the header and lines in one create, status `DRAFT` |
| Idempotency | a second generation for the same month is a 409 naming the existing invoice. A bill a client may already hold must not silently change; corrections are `ADJUSTMENT` lines on a later invoice |
| Reads | `GET /invoices` (pagination + status filter), `GET /invoices/:id` (with lines), `GET /invoices/:id/download` (printable text document, `content-disposition` attachment) |
| Transitions | `PATCH /invoices/:id/status` — DRAFT→ISSUED (sets `issuedAt`, `dueAt` = +30 days), ISSUED/OVERDUE→PAID (records `paidAt` **and which user said so**), anything unpaid→VOID. Everything else is a 409 |
| Overdue | ISSUED invoices past their due date flip to OVERDUE lazily on read, so the badge and the filter agree without a scheduler |
| Platform view | `GET /ops/billing` (`finance:read`) — MRR from active subscriptions, tier mix, invoice counts by status, outstanding vs settled money, ten most recent bills |

### Evidence

- `pnpm test` **19/19** in `invoices.test.ts`:
  - arithmetic: plan-only bill, request overage, KB→MB rounding, 1,000-call blocks, exact totals, numbering
  - generation: 4 lines for over-limit usage totalling ₹27,555.00, duplicate month 409, default period is
    last month, malformed period 400, client 403
  - reads: tenant isolation, status filter, detail + cross-tenant 404, downloadable document
  - status: issue + net-30, settle with the actor recorded, DRAFT→PAID refused, double-issue refused,
    voiding a paid invoice refused, overdue flip
  - permissions: client and account manager cannot move status, client owner can still read

### Decisions worth naming

- **No payment processor.** Settling an invoice is a human bookkeeping act: the API records who marked it
  paid and when, and nothing in the system ever sets `PAID` on its own. There is no card data, no gateway
  call, and no invoice is ever auto-settled.
- **Immutable bills.** Generation is idempotent per period rather than an upsert, because an invoice is a
  document that may already be in a client's inbox.
- **Zero tax is stated, not implied.** No jurisdiction rules are configured, so the field exists, is
  reported, and is honestly zero.

---

## Slice 22 — Phase 4 · Usage tracking, metering and plan guards  ✅

**Commit:** `e3174a1`
**Brief refs:** §5 (plan limits), §12 (tenant isolation), §14 (platform behaviour under load)

### What shipped

| Area | Detail |
|---|---|
| Guard engine | `metering/limits.ts` — `assertWithinLimit(tenant, meter, required)` reads the plan and throws a typed **403 `LIMIT_EXCEEDED`** naming the meter, what is used, what the plan includes and which tier, so the client can render an upgrade prompt instead of a mystery failure |
| Requests | `POST /service-requests` guards **before** the write and consumes **after** it: a rejected create leaves the meter untouched, and a validation failure never burns quota |
| Storage | the deliverable upload route converts bytes→KB (rounded **up**) and checks the remaining allowance before a single byte is written; only a stored file is charged |
| API calls | `metering/api-calls.ts` mounted on `/api/v1`: the counter is written on response `finish` (work that never happened is not billed), enforcement runs only for identified callers, and anonymous calls never move a tenant's meter |
| Exemptions | `/subscription`, `/invoices`, `/organizations`, `/notifications`, `/auth` stay reachable when a meter is exhausted — otherwise the block hides the very page that explains it |
| Platform view | `GET /ops/billing` extended with a per-tenant ledger (`tenants[]`: plan, status, MRR contribution, requests and storage this period) so finance can see and bill every tenant from one screen |
| Tests | 14: request counting, over-limit 403 with tier in the message, client blocked identically, upgrade lifts the limit, storage refusal leaves no file and no charge, KB rounding up, exactly-filling upload allowed, API calls counted, anonymous calls uncounted, work blocked / billing still readable, MRR follows tier changes, outstanding vs settled, tenant ledger, and the finance-vs-client permission split |

### Evidence

- `tests/metering.test.ts` **10/10**, `tests/finance-overview.test.ts` **4/4**
- full suite after the middleware landed: **324/324 across 27 files** (the per-request meter touches every
  route, so this was the real regression check)
- `pnpm --filter @gc3/api typecheck` clean

### Decisions worth naming

- **Hard, not soft.** An exhausted allowance refuses the work rather than overcharging for it. The brief
  asks for blocking, and a surprise invoice is a worse product than a clear refusal.
- **Bytes are charged only once they are stored**, and only the successful write is billed — the guard is a
  prediction, the consume is a fact.
- **Enforcement follows the plan.** A tenant with no subscription has no allowance to exceed, so the
  per-request meter never invents a plan; the request and storage guards provision the entry tier because
  that is what a real onboarding would have done.
- **Known limit, stated:** the API-call meter writes one row-increment per authenticated request. That is
  a deliberate honesty-over-throughput trade for this build; batching would be the next step.

---

## Slice 23 — Phase 4 · Client and platform financial dashboards  ✅

**Commit:** `e4fc68b`
**Brief refs:** §7 (client portal), §8 (operations console), §13 (UI standards)

### What shipped

| Area | Detail |
|---|---|
| Client billing | `apps/web/src/app/(portal)/billing` — plan card (name, price, status, period, renewal date), three usage meters with `OK`/`WARNING`/`EXCEEDED` states and progress bars, invoice table with status badges and due dates, expandable line items, and a Download control |
| Platform finance | `apps/web/src/app/(portal)/ops/billing` — MRR, outstanding vs settled, draft count, tier mix, a tenant ledger (plan, status, requests, storage, MRR) with a per-tenant **Bill <period>** action, and a recent-invoices table with Issue / Mark paid / Void |
| Nav | Billing appears in the workspace nav for roles holding `finance:read`; the Platform group gains **Finance** for admins, ops managers and finance managers |
| Client docs | `lib/api-client.ts` gained the finance calls; the invoice download is **fetched with the bearer token** and handed to the browser as a Blob, because an `<a href>` cannot send an Authorization header |
| Money formatting | `formatMoney` renders integer paise as `₹25,100.00` with `en-IN` grouping; `formatPeriodKey` / `previousPeriodKey` keep the month maths out of components |
| API | `GET /ops/billing` gained `tenants[]` (id, name, plan, status, MRR contribution, requests and storage this period) so finance can bill from one screen |
| Tests | `finance-overview.test.ts` — 4: MRR follows tier changes, outstanding vs settled after issuing and settling, the tenant ledger reflects live usage, and finance can read while a client cannot |

### Live browser evidence (2026-11-05, real Next.js + real Postgres)

**Client owner** (`client.owner@helios.test`, Helios Cloud):
- `/billing` → *Starter · ₹25,000.00 / month · November 2026 · renews 01 Dec 2026 · ACTIVE*
- meters: *17 / 20 requests — approaching limit · 85% used*; *640 / 5,120 MB — within plan · 13% used*;
  *51,407 / 50,000 calls — limit reached · 103% used · overage billed*
- invoice `INV-2026-11-0001` listed as **PAID**, ₹25,100.00, due 05 Dec 2026; expanding it showed
  *Starter plan — November 2026 · 1 × ₹25,000.00* and *Additional API calls (51404 used, 50000 included,
  billed per 1,000) · 2 × ₹50.00*, subtotal ₹25,100.00, tax ₹0.00, total ₹25,100.00
- **Download** → "INV-2026-11-0001 downloaded."; the endpoint returned
  `content-type: text/plain`, `content-disposition: attachment; filename="INV-2026-11-0001.txt"` and a
  702-byte document carrying the same lines

**Platform admin** (`portal.verify@gc3.local`):
- `/ops/billing` → MRR ₹25,000.00 (1 active subscription), outstanding ₹0.00, settled ₹0.00, drafts 0
- clicked **Bill 2026-11** on Helios → *INV-2026-11-0001 generated for Helios Cloud — ₹25,100.00*
- **Issue** → status ISSUED, due 05 Dec 2026 (net 30); **Mark paid** → *INV-2026-11-0001 is now PAID*,
  settled ₹25,100.00, outstanding ₹0.00, status chips updated, and the action buttons disappeared

**Operations manager** (`ops.manager@gc3.local`, `finance:read` but not `finance:manage`):
- same console, every action column rendered **read only** — no Bill/Issue/Mark paid/Void buttons

**Plan guard, live** (after winding the demo tenant to its limits):
- with API calls at 51,415: submitting a request in the UI returned
  *"The STARTER plan allows 50,000 API calls — 51,415 used. Upgrade the plan to continue."*
- with requests at 20/20: *"The STARTER plan allows 20 service requests — 20 used. Upgrade the plan to
  continue."* — and Postgres confirmed the request count never moved

### Evidence

- Full suite: **328 / 328 across 28 files** (includes the 12 subscription, 19 invoice, 10 metering and
  4 finance-overview tests); `pnpm typecheck` clean for both apps
- **Mutation check:** commenting out `assertWithinLimit(…,'REQUESTS')` failed 3 metering tests; restoring
  it returned 10/10 — the guard assertions are load-bearing, not decorative

### Decisions worth naming

- **The client sees the bill but cannot touch it.** `/billing` is read-only for every client role; plan
  changes and settlement are staff actions with `finance:manage`, and the API enforces that regardless of
  what a UI renders.
- **`/ops/billing` is gated on `finance:read`, not `ops:read`.** It is a revenue report: finance managers
  need it and do not need the operations console.
- **Downloads carry the token.** Fetching the document and handing over a Blob keeps the tenant header and
  bearer token on the request instead of leaking ids into a query string.
- **Buttons disappear, they do not merely disable.** A read-only viewer never sees an action they cannot
  take; the server is still the boundary.

---

## Slice 24 — Phase 5 · Queue and system observability  ✅

**Commit:** `d93c948`
**Brief refs:** §14 (operational visibility), §16 (monitoring)

### What shipped

| Area | Detail |
|---|---|
| Endpoint | `GET /api/v1/ops/queue/stats` (`ops:read`) — driver, queue name, waiting/active/delayed/failed/completed, paused flag, registered schedulers with next run, worker heartbeat and alert flags |
| Heartbeat | `observability/heartbeat.ts` — a beat every `WORKER_HEARTBEAT_INTERVAL_SECONDS` (15s) written to Redis with a **TTL** of `WORKER_HEARTBEAT_TTL_SECONDS` (60s), so a dead worker's claim expires instead of lingering; falls back to memory when Redis is not configured |
| Alert engine | `observability/queue-health.ts` — `buildQueueReport()` is pure: `DURABLE_DISPATCH_DISABLED` (INFO), `WORKER_HEARTBEAT_MISSING` / `_STALE` (CRITICAL), `QUEUE_PAUSED` (CRITICAL), `QUEUE_BACKLOG` (WARNING), `JOBS_FAILING` (CRITICAL), `SCHEDULER_MISSING` (WARNING) |
| Queue introspection | `durable-queue.ts` gained `schedulers()` and `paused()` alongside the existing `counts()` |
| Console | `/ops` shows a **Background dispatch** card: driver badge, worker pill, five counters (failed turns red when non-zero), last-beat age with pid and host, the scheduler rows with their next run, and the alert list — or "No alerts: the queue is draining and the worker is beating." |
| Tests | 12: ten report-builder cases (every alert branch, the twice-the-interval staleness boundary, threshold edges) plus auth (401/403) and the live report shape |

### Live evidence

```text
GET /api/v1/ops/queue/stats  (PLATFORM_ADMIN)
{
 "driver": "redis", "queueName": "gc3-work",
 "counts": { "waiting": 0, "active": 0, "delayed": 2, "failed": 0, "completed": 11 },
 "paused": false,
 "schedulers": [
   { "id": "retry-sweep", "everyMs": 300000, "nextRunAt": 1793868333447 },
   { "id": "sla-sweep",   "everyMs": 300000, "nextRunAt": 1793868333453 }
 ],
 "worker": { "status": "UP", "lastSeenAt": "2026-11-05T08:42:38.804Z", "ageSeconds": 3,
             "pid": 1312, "hostname": "STARK", "intervalSeconds": 15 },
 "alerts": [], "checkedAt": "2026-11-05T08:42:41.787Z"
}
```

```text
redis-cli get gc3:heartbeat:worker
{"pid":1312,"hostname":"STARK","startedAt":"2026-11-05T08:39:38.706Z",
 "lastSeenAt":"2026-11-05T08:42:38.804Z","intervalSeconds":15,"driver":"redis"}
redis-cli ttl gc3:heartbeat:worker  → 50   (counting down from 60)
```

Browser `/ops`: *BACKGROUND DISPATCH · DURABLE · REDIS · WORKER UP · WAITING 0 · ACTIVE 0 ·
DELAYED 2 · FAILED 0 · COMPLETED 11 · last beat 11s ago (pid 1312 on STARK) ·
RETRY-SWEEP EVERY 300S · NEXT 2:15:33 PM · SLA-SWEEP EVERY 300S · NEXT 2:15:33 PM ·
No alerts: the queue is draining and the worker is beating.*

### Decisions worth naming

- **Counts alone cannot detect a dead worker.** A queue with 0 waiting and a queue nobody is
  draining look identical; only the heartbeat separates them, which is why a missing beat is
  CRITICAL and a deep backlog is only WARNING.
- **The beat has a TTL, not a timestamp.** A crashed process cannot leave a stale "I am fine"
  behind — the key disappears on its own.
- **The health check never 500s.** If Redis is unreachable, the report says the worker is ABSENT,
  because that is the finding an operator needs.

---

## Slice 25 — Phase 5 · Platform executive analytics  ✅

**Commit:** `f9acf97`
**Brief refs:** §8 (platform reporting), §15 (executive visibility)

### What shipped

| Area | Detail |
|---|---|
| Endpoint | `GET /api/v1/ops/analytics` (`ops:read`, no tenant scope) — `?windowDays=` 7–365, default 90 |
| Turnaround | one Postgres pass: `AVG`, `PERCENTILE_CONT(0.5)` and `(0.9)` over creation→closure for requests closed inside the window, plus on-time/late counted against `sla_target_at` — **not** the requested due date |
| Throughput | eight weekly buckets for both directions: created bucketed by `created_at`, closed bucketed by `closed_at`, so a backlog clearing shows up in the week it cleared |
| Pod efficiency | per pod: open, closed, mean age of open work, on-time and late counts, and an on-time rate that is `null` when nothing measurable has closed |
| Tenant growth | six monthly cohorts with a running cumulative, ending at the current tenant total; active tenants are those that have raised at least one request |
| Dashboard | `/ops/analytics` — window switch (7/30/90/180/365), four headline cards, an eight-week two-series throughput chart, a pod table with colour-coded punctuality and a monthly growth list |
| Tests | 7: turnaround sample and duration, punctuality vs the SLA target (not the due date), throughput bucketing, pod efficiency including open-work age, growth cumulative arithmetic, window validation, and platform-only access |

### Live evidence

```text
GET /api/v1/ops/analytics?windowDays=90
totals:     { requests: 3, openRequests: 2, closedRequests: 1, tenants: 7, activeTenants: 2, pods: 1 }
turnaround: { sampled: 1, avgHours: 89.8, medianHours: 89.8, p90Hours: 89.8,
              onTime: 0, late: 1, onTimeRate: 0 }
pods:       [{ podName: "Cloud Delivery", openRequests: 0, closedRequests: 1,
               avgOpenAgeHours: null, onTime: 0, late: 1, onTimeRate: 0 }]
throughput: 14 Sept 0/0 · 21 Sept 0/0 · 28 Sept 0/0 · 05 Oct 0/0 · 12 Oct 0/0 ·
            19 Oct 0/0 · 26 Oct 2/0 · 02 Nov 1/1
growth:     Jun 0 · Jul 0 · Aug 0 · Sept 0 · Oct 0 · Nov +7 (cumulative 7)
```

Browser `/ops/analytics`: *Avg turnaround 3.7d (1 closed in window) · Median turnaround 3.7d (p90 3.7d) ·
On-time delivery 0.0% (0 met · 1 missed) · Tenants 7 (2 active · 1 pods)*, the eight-week chart, the pod
table (*Cloud Delivery · 0 · 1 · — · 0.0%*) and *Nov 26 +7*.

### Decisions worth naming

- **Null is not zero.** "Nothing has closed" renders as `—`, never as `0.0h` or `0%`; a dashboard that
  conflates the two quietly lies.
- **Buckets are computed in Postgres.** `date_trunc` and `percentile_cont` keep month-end reporting from
  pulling the whole table into Node.
- **Punctuality uses the SLA commitment, not the due date.** The due date is a request field a client can
  set; the commitment is what the platform promised.
- **One documented closure on dev data:** `REQ-EA763D6B` was moved IN_REVIEW → DELIVERED → CLOSED through
  the normal status route so the report had a real sample rather than an empty state.

---

## Slice 26 — Phase 5 · Audit logging, security hardening and rate limiting  ✅

**Commit:** `1ce7d1a`
**Brief refs:** §12 (auditability), §14 (security), §17 (operational readiness)

### What shipped

| Area | Detail |
|---|---|
| Audit schema | migration `20261105100000_audit_context` adds `ip`, `user_agent`, `request_id` to `audit_events` plus a `created_at DESC` index — an audit row that cannot say *where a change came from* is only half a record |
| Audit writer | `audit/audit-log.ts` — `recordAudit()` never throws (a failed audit must not roll back a committed change) but logs loudly; `SENSITIVE_AUDIT_ACTIONS` publishes the watched set as data so an omission is visible |
| Audit reader | `GET /api/v1/ops/audit` (`ops:read`) — newest first, filtered by tenant, action, actor and time |
| Tenant edits | `PATCH /organizations/:id` (`organization:update`) — the endpoint did not exist; it now edits name/slug/timezone/region and audits the changed fields with before **and** after values. Sending `status` is refused: suspension is a platform decision |
| Role changes | `PATCH /organizations/:id/memberships/:userId/roles` (`membership:manage`) — client roles only (a client owner cannot mint a `PLATFORM_ADMIN`), and the last active owner cannot be demoted (409) |
| Security headers | `middleware/security-headers.ts` — nosniff, `X-Frame-Options: DENY`, no-referrer, COOP/CORP, a permissions policy, `default-src 'none'` CSP, HSTS in production only, `x-powered-by` stripped |
| Rate limiting | `middleware/rate-limit.ts` — a fixed-window counter with two instances: `/auth/login` keyed by IP **and** email (20/15 min), the rest of `/api/v1` keyed by tenant or IP (600/min). 429 carries `Retry-After` and `x-ratelimit-*`, and the error envelope says how long to wait |
| Tests | 15 in `security.test.ts`: headers on success *and* failure, login 429, per-tenant isolation of budgets, remaining-budget advertisement, disabled-limiter pass-through, role-change audit with request context, last-owner refusal writing nothing, staff-role rejection, tenant-edit audit, no-op edits not logged, the audit API and its filters, and the authorization matrix for tenant edits |

### Live evidence

```text
GET /api/v1/health → 200
  x-content-type-options: nosniff
  x-frame-options: DENY
  referrer-policy: no-referrer
  content-security-policy: default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'
  permissions-policy: geolocation=(), microphone=(), camera=(), payment=(), usb=()
  cross-origin-opener-policy: same-origin
  x-ratelimit-limit: 600     x-ratelimit-remaining: 599
  x-powered-by: (absent)     strict-transport-security: (absent — development)
```

```text
API started with AUTH_RATE_LIMIT_MAX=3
  login attempt 1: 200 · attempt 2: 200 · attempt 3: 200
  login attempt 4: 429  retry-after: 894
  {"code":"RATE_LIMITED","message":"Too many sign-in attempts from this address. Try again in 894s.",
   "details":[{"path":"retryAfterSeconds","message":"894"}],"requestId":"40a87ea0-…"}

API started with RATE_LIMIT_MAX=5
  GET /service-requests #1..#5 → 200, remaining 4,3,2,1,0
  GET /service-requests #6      → 429, retry-after 50
  {"code":"RATE_LIMITED","message":"Rate limit exceeded (5 requests per 60s). Try again in 50s."}
  GET /service-requests (different tenant) → 200, remaining 4
```

```text
PATCH /organizations/<helios> {"name":"Helios Cloud HQ"} → 200
PATCH /organizations/<helios> {"name":"Helios Cloud"}    → 200
PATCH …/memberships/<last-owner>/roles {"roles":["CLIENT_TEAM_MEMBER"]}
  → 409 "This is the last active client owner: promote somebody else before changing these roles"

GET /ops/audit?organizationId=<helios>  → total 10
  09:04:23  organization.updated           portal.verify@gc3.local  {"after":{"name":"Helios Cloud"},"before":{"name":"Helios Cloud HQ"}}
  09:04:21  organization.updated           portal.verify@gc3.local  {"after":{"name":"Helios Cloud HQ","region":"global"},"before":{"name":"Helios Cloud","region":"apac"}}
  08:26:18  invoice.paid                   portal.verify@gc3.local  {"from":"ISSUED","to":"PAID"}
  08:26:13  invoice.issued                 portal.verify@gc3.local  {"from":"DRAFT","to":"ISSUED"}
  08:24:32  subscription.auto_provisioned  SYSTEM                   {"tierCode":"STARTER","reason":"no subscription existed"}
  11-04     membership.invite_accepted     client.owner@helios.test
```

### The audit log caught a bug in this slice

The third row above — `region: apac → global` — is a defect **I introduced in this slice**: `updateOrganizationSchema`
is a partial of the create schema, and Zod still applies `.default()` to absent keys, so forwarding the parsed
object rewrote `region` (and would have rewritten `timezone`) on every rename. It was invisible in the API
response and obvious in the audit trail, which is the entire argument for writing one.

Fixed by forwarding only the keys actually present in the request body, with a regression test, and the dev
tenant's region restored to `apac`. Slice 27's build then proved the fix under the full suite.

### Decisions worth naming

- **Never roll back a business change for an audit failure.** `recordAudit` swallows its own errors and
  screams in the log instead: losing the change is worse than losing the note about it, and the noise is
  what gets it fixed.
- **Rate limits are per tenant, not per IP.** Nobody in an office should be locked out because a colleague
  ran a loop. Unauthenticated routes key on IP because there is nobody else to attribute traffic to.
- **Sign-in is limited by IP *and* email.** Spraying one password across many accounts looks different from
  hammering one account from many addresses; one key cannot catch both.
- **Honest about the shared-nothing counter.** It is in-memory per process, so N nodes allow N times the
  ceiling. Said out loud in the README rather than implied to be a global quota.
- **Client roles only.** `updateMembershipRolesSchema` accepts `CLIENT_OWNER | CLIENT_TEAM_MEMBER |
  CLIENT_APPROVER`; staff roles are provisioned by the platform, so privilege escalation is impossible at
  the schema, not merely discouraged at the route.

---

## Slice 27 — Phase 5 · Production build, verification and documentation  ✅

**Commit:** `b2fab9e`
**Brief refs:** §19 (build and run), §20 (definition of done)

### Production build

```text
$ pnpm build
apps/api build: Done                     (tsc --noEmit: whole-program typecheck)
apps/web build: ✓ Compiled successfully in 7.6s
apps/web build:   Finished TypeScript in 7.8s
apps/web build: ✓ Generating static pages (12/12)
apps/web build: Route (app)
┌ ƒ /                     ├ ○ /billing            ├ ○ /ops
├ ○ /_not-found           ├ ○ /categories         ├ ○ /ops/analytics
├ ○ /dashboard            ├ ○ /deliveries         ├ ○ /ops/billing
├ ○ /login                ├ ○ /requests           ├ ƒ /requests/[requestId]
└ ○ /requests/new
```

The built bundle was then **served**, not just compiled — `next start --port 3010` against the real API:

```text
/login 200 · / 200 · /billing 200 · /ops 200 · /ops/analytics 200 · /ops/billing 200
```

**Why the API "build" is a typecheck.** The API runs TypeScript directly under `tsx` (`start: tsx
src/index.ts`) and consumes the workspace packages as source, so it has no separate JS artifact to emit —
emitting one would require compiling `packages/types` and friends too, and would produce a build that
differs from what runs. Stating it plainly beats shipping a `dist/` nobody starts.

### Full verification

```text
$ pnpm typecheck
packages/types Done · packages/ui Done · packages/validation Done · apps/web Done · apps/api Done

$ pnpm test        (apps/api)
 Test Files  31 passed (31)
      Tests  362 passed (362)
   Duration  261.51s

$ prisma migrate status
16 migrations found — Database schema is up to date!
```

Per-slice test counts: queue health 12, analytics 7, security 15 — 34 new tests in Phase 5, 362 total.

### A flake, found and fixed rather than re-run

The first full Phase 5 run came back **361/362**: one `TRUNCATE` in `tests/setup.ts` failed under a lock.
Re-running would have hidden it. Instead the harness now (a) names the Phase 3 and Phase 4 tables
explicitly instead of relying on the cascade from `organizations`, and (b) retries a locked truncation up
to four times with backoff, with a comment explaining why a retry is honest in a serial suite. The
subsequent run was 362/362.

### Decisions worth naming

- **Verified means executed.** Every claim in this log has a command behind it: the build output, the
  served routes, the 429s with their `Retry-After`, the audit rows with their before/after payloads.
- **A green suite that flakes is not green.** The harness fix is part of the deliverable, not a nuisance
  around it.
- **The API is honest about what it is.** TypeScript on `tsx`, packages as source, one typecheck gate.

---

## Phase 5 — closing statement

| Slice | Delivered | Commit |
|---|---|---|
| 24 · Queue & system observability | queue stats endpoint, TTL heartbeat, alert engine, console card | `d93c948` |
| 25 · Platform executive analytics | turnaround/throughput/pod-efficiency/growth queries and `/ops/analytics` | `f9acf97` |
| 26 · Audit, hardening, rate limiting | audit context + reader, tenant/role edit endpoints, security headers, two limiters | `1ce7d1a` |
| 27 · Build, verification, docs | production build served, 362/362, typecheck 5/5, this record | `b2fab9e` |

**What is built and proven:** multi-tenant identity and RBAC with invites and SMTP delivery; service
requests, catalogue, comments, deliverables with versions, stored files and SHA-256 integrity; a staff
operations console across tenants with pods, staffing, tasks and SLA tracking; durable dispatch on Redis
with event notifications and retries; subscription tiers, metered usage with hard plan guards, invoice
generation with exact integer arithmetic and a human-only settlement path; queue health, executive
analytics, a security audit trail, rate limiting and hardened headers.

**What is deliberately not built** — stated so nobody assumes otherwise: token refresh and a revocation
list; login audit of every attempt (only the ceiling is enforced); offboarding an ACTIVE member;
virus scanning and signed URLs for uploads; proration and credit notes for billing; PDF rendering; tax
rules; Redis-backed rate limiting for multi-node; queue-depth paging beyond the console card. Each is a
known boundary with a described upgrade path, not a surprise.

---

## Post-roadmap refactor — route groups `(client)` / `(ops)`  ✅

**Scope:** reorganise the existing `apps/web` routes so client and internal-staff surfaces own their own
layouts. No page was created, no page was rewritten, and **no URL changed**.

### What moved

| Route group | Pages | Layout |
|---|---|---|
| `apps/web/src/app/(client)` | `/dashboard`, `/requests`, `/requests/new`, `/requests/[requestId]`, `/billing`, `/deliveries`, `/categories` | `variant="client"` — reading column (`max-w-[1080px]`), nav is exactly **Dashboard · Requests · Billing** |
| `apps/web/src/app/(ops)` | `/ops`, `/ops/analytics`, `/ops/billing` | `variant="ops"` — high-density column (`max-w-[1440px]`), nav is **Operations · Analytics · Finance** plus a *Tenant workspace → Open client view* link |

`PortalShell` gained a `variant` prop instead of a second copy: the chrome was already shared, only the
navigation and the column width differ. The parenthesised group name is stripped from the URL, so
`(client)/dashboard` still serves `/dashboard` and `(ops)/ops/analytics` still serves `/ops/analytics`.

### Client nav has no /ops — verified, not assumed

```text
CLIENT NAV LINKS:  /dashboard :: Dashboard   /requests :: Requests   /billing :: Billing
sidebar mentions /ops: False
body mentions Operations: False
brand subtitle: CLIENT WORKSPACE
```

### Post-login routing

`homePathFor(session)` in `lib/session.ts` is the single predicate: any session with a `platformRole` is
staff and goes to `/ops`; a session without one is a client and goes to `/dashboard`. Both redirects in
the login page (fresh sign-in, and "already signed in") use it.

```text
staff hitting /login while signed in  → /ops
client hitting /login while signed in → /dashboard
```

### The /ops guard

```text
client asks for /ops  → location.pathname = /dashboard
```

The ops layout redirects a non-staff session (`platformRole === null`) to `/dashboard` before rendering,
and shows "This console is for platform operations. Redirecting…" for the frame in between. This is the
UX half of the rule; the API still answers 403 to every ops endpoint for a client token, which is the real
boundary and is already covered by the integration suite.

### Nothing lost — every route exercised as both roles

| Route | Client | Staff |
|---|---|---|
| `/dashboard` | ✅ Overview | ✅ Overview (brand returns to `/ops`) |
| `/requests` | ✅ Service Requests | ✅ Service Requests |
| `/requests/new` | ✅ New service request | — |
| `/billing` | ✅ Billing & plan | — |
| `/deliveries` | ✅ Delivery history | — |
| `/categories` | ✅ Service categories | — |
| `/ops` | ⛔ redirected to `/dashboard` | ✅ Operations console |
| `/ops/analytics` | ⛔ | ✅ Executive analytics (dense) |
| `/ops/billing` | ⛔ | ✅ Billing operations (dense) |

`pnpm -r typecheck` → `packages/types Done · packages/ui Done · packages/validation Done · apps/web Done ·
apps/api Done`. The API was not touched, so the 362-test suite and its 31 files are unaffected.

### Three things stated plainly

1. **`/ops/audit` has no page.** It was named in the brief as an existing page to move; it is an API
   endpoint only (`GET /api/v1/ops/audit`, slice 26). Since the instruction was "do not create new pages",
   none was created — the route group has three pages, not four. Say the word and the audit screen is a
   small slice on its own.
2. **`/deliveries` and `/categories` stay in `(client)` but are not in the client nav**, because the spec
   fixes that nav at Dashboard · Requests · Billing. They remain fully working at their URLs (verified
   above); they are simply not linked. If they should be reachable from the UI, the nav is a two-line
   change.
3. **Staff can get back to the console from a tenant page through the brand link.** Without it, a staff
   member who opened `/requests/[id]` had no route back except the browser's back button. The shift is
   role-aware: a client's brand link resolves to `/dashboard`, so no client ever sees an `/ops` href.

---

## Next up (not started)

| Step | Scope |
|---|---|
| Queue observability | Alert on queue depth / failed jobs; surface both on `/ops` |
| Delivery read API | `GET /organizations/:id/notifications` for account managers |
| Token lifecycle | Refresh tokens, revocation list, rate limiting / lockout on login |
| Offboarding | Revoke an ACTIVE member: session invalidation, audit, retention rules |
| Tooling | ESLint + Prettier, CI running typecheck/test/build |
