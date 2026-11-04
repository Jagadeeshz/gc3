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
| 9 | Phase 2 · Categories & request editing | `a119478` | ✅ delivered |

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

**Commit:** `a119478` — feat(catalogue): service category CRUD and request editing UI
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

## Next up (not started)

| Step | Scope |
|---|---|
| Phase 2 step 5 | Deliverable creation UI for staff, internal-note toggle on comments |
| Delivery retry & backoff | Retry FAILED deliveries; bounce/complaint suppression list |
| Delivery read API | `GET /organizations/:id/notifications` for account managers |
| Token lifecycle | Refresh tokens, revocation list, rate limiting / lockout on login |
| Offboarding | Revoke an ACTIVE member: session invalidation, audit, retention rules |
| Tooling | ESLint + Prettier, CI running typecheck/test/build |
