# GC³ Portal — Technical & Functional Documentation

**Quantocos Global Systems** · Platform documentation for the GC³ capability portal
Version 1.0 · reflects the shipped codebase, not a plan

---

## 1. Executive summary

GC³ is a multi-tenant operations platform in which a client buys **capability**, not
headcount. A client subscribes to a **pod**: a standing team composed around one outcome,
with one accountable manager, a defined specialist roster, supervised agents paired to each
specialist, and a **published monthly credit pool**. Work arrives as requests rather than
projects, draws from the pool, and moves through delivery commitments measured by priority.

The portal is the record of that arrangement. It is not a marketing site with a login bolted
on: the same PostgreSQL row that publishes a price is the row that bills against it.

Three surfaces share one codebase and one data model:

| Surface | Audience | Route group |
| --- | --- | --- |
| Public site | Prospects | `/`, `/pods`, `/how-it-works`, `/why-a-pod`, `/pricing` |
| Client portal | Client owner, team member, approver | `(client)/*` — 20 screens |
| Staff console | Eight internal roles | `(ops)/ops/*` |

---

## 2. Why GC³ is useful

### For enterprise clients

- **One accountable owner.** A named pod manager is on the record from the first request;
  escalation is a person, not a queue.
- **A price decided before the work.** The catalogue carries a published credit pool and a
  fixed composition. Nothing is quoted per request.
- **Commitments on the record.** Every request carries a window (urgent 8h, high 24h,
  normal 72h, low 168h) and shows when it is at risk *before* it breaches.
- **Tenant isolation as a property of the system.** Every tenant-owned row carries an
  `organization_id`; isolation is enforced in middleware and in query scope, never in the UI.
- **Billing that reconciles.** Invoices are per tenant, dated, numbered and attributable to
  the actor who issued them. Nothing is reconstructed from email.

### For internal staff

- **Operational clarity.** Cross-tenant dashboard, pods and rosters, internal tasks, and an
  SLA risk sweep, in one console rather than four tools.
- **The same record the client sees.** Staff and client views read the same rows through the
  same API, so "what the client was told" is never a separate system.

### For administration

- **Eleven roles**, three client-side and eight staff-side, resolved per request rather than
  held in a session flag.
- **Auditable actions.** Deliverable releases, version changes, invoice transitions and role
  changes are written to the audit trail with actor and timestamp.
- **Operational controls** for pods, pricing, demo requests and organisation records.

---

## 3. Architecture

### 3.1 Monorepo layout

```
apps/web            Next.js 16 App Router, React 19, Tailwind v4
apps/api            Express 5 REST API, Prisma 7, BullMQ
packages/types      Shared domain types (roles, enums, DTOs)
packages/validation Zod schemas shared by client and server
packages/ui         Shared React components
```

Package manager: **pnpm** workspaces. No build orchestrator sits between the packages;
each app builds with its own toolchain.

### 3.2 Public site

Five marketing routes plus an internal engineering page. Content structure follows an
enterprise pattern — proposition, supporting facts, catalogue, path to start, comparison —
and the catalogue itself is read from the database at request time, so a published price and
a billed price cannot drift apart.

The landing hero is a **scroll-driven 3D ribbon**: six pod cards are skinned onto a
Catmull-Rom curve in Three.js, running away from the camera over a 700vh track (520vh on
narrow viewports) inside a sticky 100vh stage. As the reader scrolls, the ribbon turns and
recedes; at 60–68% of the sequence the cards dissolve and the band closes on the statement
*"Intelligence, engineered at the edge."* The 3×2 grid the reference design settled into was
deliberately removed — it repeated what the catalogue says one screen later.

Cards are **canvas textures drawn at runtime**, not video. Nothing loads from a third-party
host, and a capability card does not need motion to be legible.

### 3.3 Client portal

Twenty screens: overview, dashboard, requests (list, detail, new), projects, deliverables,
deliveries, categories, services, knowledge, messages, support, pod, team, subscription,
billing, settings, profile.

Navigation is **derived from role**: a team member never sees a billing entry, an approver
sees approvals and not invoicing. Each screen states whether its panel is backed by live data
or is not yet instrumented; a panel that is not wired says so rather than rendering a
plausible zero.

### 3.4 Staff console

`/ops` (cross-tenant dashboard, pods and rosters, internal tasks, SLA risk sweep),
`/ops/analytics`, `/ops/billing`, plus audit surfaces. The same shell and the same API as the
client portal, scoped by staff roles instead of organisation membership.

### 3.5 API surface

Versioned at `/api/v1`, thirteen modules:

```
auth                sessions, login, logout, password change
organizations       tenant records and membership
subscriptions       plan, seats, status
invoices            issue, void, mark paid, list
service-categories  the catalogue taxonomy
service-requests    create, triage, assign, transition
deliverables        upload, version, review, release
tasks               internal staff tasks
pods                pod records, rosters, allocation
pricing             published pod pricing
notifications       in-app notification feed
ops                 cross-tenant operational endpoints, SLA sweep
demo-requests       public demo capture
```

Authentication: JWT in an httpOnly cookie (`jose`). Authorisation: role and membership
checks resolved per request, with tenant scope applied at the query layer.

### 3.6 Data

PostgreSQL 16 via Prisma 7 (`@prisma/adapter-pg`). Nineteen migrations to date, from initial
identity and tenancy through SLA, finance, audit context, ops roles, the capability pod
catalogue, and demo requests. UUID primary keys, indexed foreign keys, soft deletes where a
record must remain referenced.

Background work: **BullMQ** on Redis for queued jobs (notification fan-out, SLA sweeps).
Mail is sent over SMTP to a capture server in development, so no external mail is required to
exercise the flows.

---

## 4. Design language

The shipped theme is **black and gold**. An earlier specification proposed violet and teal
accents; that palette was not adopted, and the tokens below are what the product actually
renders.

### Palette

| Token | Value | Use |
| --- | --- | --- |
| `--color-void` | `#0d0c11` | page ground |
| `--color-void-secondary` | `#13121a` | raised ground, sidebar |
| `--color-graphite` | `#17161d` | card fill |
| `--color-graphite-elevated` | `#1e1d26` | nested surface |
| `--color-warm` | `#ffffff` | primary ink |
| `--color-muted` | `#b9b8bb` | secondary ink |
| `--color-gold` | `#c9911a` | accent |
| `--color-gold-light` | `#f2d582` | accent, highlights, positive state |
| `--color-gold-deep` | `#8b6410` | accent in shadow |

Status colour: positive and active states resolve to gold-light, warnings to gold,
destructive states stay red — a grey "breach" would be worse than an off-palette one.

### Type

| Role | Family | Notes |
| --- | --- | --- |
| Display | **Cormorant Garamond** 700 | headlines, card titles, KPI figures |
| Interface | **DM Sans** 300–600 | body, tables, controls |
| Label | **DM Mono** 400/500 | eyebrows, references, metadata |

Weight is the only variable; families are not substituted. Tabular numerals
(`font-variant-numeric: tabular-nums`) are required anywhere a number can change value, so
columns do not shift as data refreshes.

### Edges

Every card, panel, ledger row and slider slide carries a **1px gradient edge**, drawn with a
transparent padding box and an xor mask so the ring follows any corner radius and never
intercepts a click. The gradient is the nine-stop spectrum for surfaces; CTA buttons take
the soma gold gradient instead, which keeps the rainbow off the primary action.

### Glass and elevation

Raised surfaces use a translucent fill with a specular top edge
(`inset 0 1px 0 rgba(255,255,255,0.06–0.14)`) and a multi-layer ambient shadow. The fill is
never saturated: a solid block on this ground reads as a chart rather than a surface.

### Motion

Motion is CSS-first. There is no animation library in the bundle. Scroll-driven sequences use
`animation-timeline: view()`, pointer effects write CSS custom properties from a single
rAF-throttled listener, and every sequence is disabled under `prefers-reduced-motion` — the
hero renders a static grid of all six pods with their pools instead of the 3D ribbon.

Two hard-won constraints, both encoded in comments in the stylesheet:

- `view()` does not attach to a table-row box in Chromium; timelines go on the cells.
- `overflow-x: auto` creates a scroll container, and a scroll-driven animation inside one
  resolves its timeline against that box. The catalogue rail scopes its overflow to narrow
  viewports for exactly this reason.

---

## 5. Technology stack

| Layer | Choice |
| --- | --- |
| Frontend | Next.js 16.4.5 (App Router), React 19.3.1, Tailwind CSS v4, TypeScript strict |
| 3D | three.js 0.187 (hero ribbon only) |
| Icons | lucide-react |
| API | Express 5.3, Zod 4.6.7 validation, jose JWT |
| Data | PostgreSQL 16, Prisma 7.10.1 (`@prisma/adapter-pg`) |
| Queue | BullMQ 6.6 on Redis (ioredis 6) |
| Mail | Nodemailer 10 over SMTP |
| Tests | Vitest + Supertest against a real PostgreSQL database |

**Not in the stack, despite appearing in earlier briefs:** Framer Motion (motion is CSS),
Python microservices (the platform is one TypeScript monorepo), and any animation or UI
component framework beyond Tailwind.

---

## 6. Multi-tenancy and security

- Every tenant-owned record carries `organization_id`; queries are scoped by the caller's
  active organisation, not by a client-supplied parameter.
- Authorisation is evaluated per request from the membership and role records; a role change
  takes effect on the next request rather than at next login.
- Session cookie is httpOnly and SameSite; the API sets `nosniff`, `DENY` framing,
  `no-referrer`, and a restrictive CSP.
- Rate limiting: 600 requests/minute generally, 20 per 15 minutes on `/auth/login`.
- Deliverable files are tenant-scoped; a file id from another organisation resolves to 404,
  not 403, so the endpoint does not confirm existence.

---

## 7. Quality

- **33 integration test files, 379 cases**, run against a real PostgreSQL instance created
  and migrated by the test harness. The database layer is never mocked — most of the risk in
  this product lives in tenant scoping and state transitions, which a mock cannot exercise.
- TypeScript strict mode across all packages; `any` is not permitted.
- Every build exercises the full monorepo typecheck before deployment artefacts are produced.

---

## 8. Deliberately not built

Listed because a document that implies otherwise is worse than one that is short:

- Credit ledger with draw-down against the pool, and proration on plan change.
- Credit notes and tax rules; invoices carry a total, not a tax breakdown.
- PDF renderer for invoices — invoices are records, not documents.
- Access-token refresh and rotation.
- Virus scanning on uploaded deliverables.
- SLA pause and extension policy.
- Email template localisation.

---

## 9. Operating the platform

Local development requires PostgreSQL and Redis (containers are fine), then the standard
scripts: `dev`, `dev:web`, `dev:api`, `build`, `typecheck`, `test`, `db:generate`,
`db:migrate`.

Fixtures seed eleven role accounts across client and staff roles so guards can be exercised
without hand-building data. Demo requests submitted from the marketing site land in the staff
console and in the mail capture server, which makes the lead path testable end to end without
touching a real inbox.

Environments are configured entirely by environment variables: database URL, Redis URL,
session secret, SMTP credentials, and the public API origin. No secrets are committed; the
repository carries a `.env.example` template only.
