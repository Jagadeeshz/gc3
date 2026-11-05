import {
  ArrowUpRight,
  Boxes,
  Braces,
  Database,
  Layers,
  Server,
  ShieldCheck,
} from 'lucide-react';
import { Card, CardBody, CardHeader, CardTitle, MetaLabel, Badge, buttonStyles } from '@gc3/ui';
import { AGENT_PROHIBITED_ACTIONS, CLIENT_ROLES } from '@gc3/types';
import { createOrganizationSchema } from '@gc3/validation';
import { getApiHealth } from '@/lib/api';

/** Live dependency probe on every request — never a cached build-time snapshot. */
export const dynamic = 'force-dynamic';

const API_PUBLIC_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3001/api/v1';

const WORKSPACES = [
  {
    path: 'apps/web',
    label: 'Next.js App Router',
    detail: 'Client portal, consoles and pod workspaces. Tailwind v4 with GC3 brand tokens.',
    icon: Layers,
  },
  {
    path: 'apps/api',
    label: 'Express + TypeScript',
    detail: 'REST surface under /api/v1 with request correlation and tenant-scope middleware.',
    icon: Server,
  },
  {
    path: 'packages/ui',
    label: 'Shared components',
    detail: 'Button, Card and Badge primitives compiled in-place by the consuming app.',
    icon: Boxes,
  },
  {
    path: 'packages/types',
    label: 'Domain contracts',
    detail: 'Tenant-scoped entities, role taxonomy and the API response envelope.',
    icon: Braces,
  },
  {
    path: 'packages/validation',
    label: 'Zod schemas',
    detail: 'One definition per request contract, shared by the API and the web client.',
    icon: ShieldCheck,
  },
] as const;

const PHASE_ONE = [
  {
    title: 'Identity & organizations',
    body: 'Authentication, membership and role assignment — the first slice that makes tenancy real.',
    tag: 'Phase 1',
  },
  {
    title: 'Tenant isolation',
    body: 'organization_id on every owned record, enforced by middleware and query layer, never the UI.',
    tag: 'Phase 1',
  },
  {
    title: 'Persistence',
    body: 'Prisma schema and PostgreSQL migrations, replacing the current in-memory route stubs.',
    tag: 'Phase 1',
  },
] as const;

export default async function FoundationPage() {
  const health = await getApiHealth();
  const organizationFields = Object.keys(createOrganizationSchema.shape);

  return (
    <div className="min-h-dvh">
      <header className="border-b border-white/10">
        <div className="mx-auto flex max-w-[1120px] flex-wrap items-center justify-between gap-4 px-6 py-5">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-[10px] border border-gold/35 bg-gold/10 font-display text-lg font-semibold text-gold-light">
              G
            </span>
            <div className="leading-tight">
              <p className="text-sm font-semibold tracking-[0.01em] text-warm">GC³ Portal</p>
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
                Global Cloud Capability &amp; Consulting
              </p>
            </div>
          </div>
          <Badge tone="gold">Phase 0 — Foundation</Badge>
        </div>
      </header>

      <main className="mx-auto max-w-[1120px] px-6">
        {/* Hero — one dominant idea, generous vertical space. */}
        <section className="glow-gold relative -mx-6 px-6 pb-16 pt-16 sm:pt-24">
          <MetaLabel>Development Brief v1.0 · Section 10</MetaLabel>
          <h1 className="mt-5 max-w-[22ch] font-display text-4xl leading-[1.06] tracking-[-0.02em] text-warm sm:text-6xl">
            The operating platform for global delivery.
          </h1>
          <p className="mt-6 max-w-[54ch] text-base leading-relaxed text-muted">
            Monorepo scaffold for the client portal, delivery operations, pod workspaces and
            AI-augmented workflows. This page is served by{' '}
            <span className="font-mono text-warm">apps/web</span> and reads live status from{' '}
            <span className="font-mono text-warm">apps/api</span>.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <a
              className={buttonStyles('primary', 'md')}
              href={`${API_PUBLIC_URL}/health`}
              target="_blank"
              rel="noreferrer"
            >
              Probe the API
              <ArrowUpRight aria-hidden className="size-4" strokeWidth={1.75} />
            </a>
            <a
              className={buttonStyles('secondary-dark', 'md')}
              href={`${API_PUBLIC_URL}/meta`}
              target="_blank"
              rel="noreferrer"
            >
              API contract
            </a>
          </div>
        </section>

        {/* API liveness — the only non-deterministic element on the page. */}
        <Card tone="elevated" className="mb-14">
          <CardHeader>
            <div>
              <MetaLabel>upstream</MetaLabel>
              <CardTitle className="mt-2">api/v1 health</CardTitle>
            </div>
            {health.reachable ? (
              <Badge tone="positive">online</Badge>
            ) : (
              <Badge tone="critical">offline</Badge>
            )}
          </CardHeader>
          <CardBody>
            {health.reachable ? (
              <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                    service
                  </dt>
                  <dd className="mt-1 font-mono text-sm text-warm">{health.report.service}</dd>
                </div>
                <div>
                  <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                    version
                  </dt>
                  <dd className="mt-1 font-mono text-sm text-warm">{health.report.version}</dd>
                </div>
                <div>
                  <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                    environment
                  </dt>
                  <dd className="mt-1 font-mono text-sm text-warm">{health.report.environment}</dd>
                </div>
                <div>
                  <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                    uptime
                  </dt>
                  <dd className="mt-1 font-mono text-sm text-warm">
                    {health.report.uptimeSeconds}s
                  </dd>
                </div>
              </dl>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-mineral">
                  The API is not answering at{' '}
                  <span className="font-mono text-gold-light">{API_PUBLIC_URL}</span>.
                </p>
                <p className="font-mono text-xs text-muted">
                  reason: {health.reason} · start it with{' '}
                  <span className="text-warm">pnpm dev:api</span>
                </p>
              </div>
            )}
          </CardBody>
        </Card>

        {/* Workspace map */}
        <section className="pb-16">
          <div className="flex items-end justify-between gap-6">
            <div>
              <MetaLabel>workspace</MetaLabel>
              <h2 className="mt-3 font-display text-2xl tracking-[-0.01em] text-warm sm:text-3xl">
                Five packages, wired.
              </h2>
            </div>
            <p className="hidden max-w-[34ch] text-sm text-muted sm:block">
              Every path resolves through the pnpm workspace — no published artefacts, no copied
              contracts.
            </p>
          </div>

          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {WORKSPACES.map((workspace) => {
              const Icon = workspace.icon;
              return (
                <Card as="li" key={workspace.path}>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <span className="grid size-9 place-items-center rounded-[9px] border border-white/12 bg-white/5 text-gold-light">
                        <Icon aria-hidden className="size-4" strokeWidth={1.75} />
                      </span>
                      <div>
                        <p className="font-mono text-sm text-warm">{workspace.path}</p>
                        <p className="text-xs text-muted">{workspace.label}</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardBody className="pt-3 text-muted">{workspace.detail}</CardBody>
                </Card>
              );
            })}
          </ul>
        </section>

        {/* Contract proof: values rendered from the shared packages at request time. */}
        <section className="hairline grid gap-6 py-12 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <MetaLabel>contracts in force</MetaLabel>
            <h2 className="mt-3 font-display text-2xl tracking-[-0.01em] text-warm">
              Validation and guardrails are already load-bearing.
            </h2>
            <p className="mt-4 max-w-[52ch] text-sm leading-relaxed text-muted">
              The fields below are read from the shared Zod schema and the shared type constants —
              if a package were unwired, this page would fail to compile.
            </p>
          </div>

          <dl className="grid gap-4 rounded-[14px] border border-white/10 bg-graphite/70 px-5 py-5">
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                createOrganizationSchema
              </dt>
              <dd className="mt-2 flex flex-wrap gap-1.5">
                {organizationFields.map((field) => (
                  <span
                    key={field}
                    className="rounded-md border border-white/12 bg-white/5 px-2 py-1 font-mono text-[11px] text-warm"
                  >
                    {field}
                  </span>
                ))}
              </dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                client roles
              </dt>
              <dd className="mt-2 font-mono text-xs text-warm">{CLIENT_ROLES.join(' · ')}</dd>
            </div>
            <div>
              <dt className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
                agent-prohibited actions
              </dt>
              <dd className="mt-2 font-mono text-xs text-warm">
                {AGENT_PROHIBITED_ACTIONS.length} blocked · {AGENT_PROHIBITED_ACTIONS[0]}…
              </dd>
            </div>
          </dl>
        </section>

        {/* Next slices */}
        <section className="pb-20">
          <div className="flex items-center gap-3">
            <Database aria-hidden className="size-4 text-gold" strokeWidth={1.75} />
            <MetaLabel>next slices</MetaLabel>
          </div>
          <ul className="mt-6 grid gap-4 lg:grid-cols-3">
            {PHASE_ONE.map((item) => (
              <Card as="li" key={item.title} tone="graphite">
                <CardHeader>
                  <CardTitle>{item.title}</CardTitle>
                  <Badge>{item.tag}</Badge>
                </CardHeader>
                <CardBody className="pt-2 text-muted">{item.body}</CardBody>
              </Card>
            ))}
          </ul>
        </section>
      </main>

      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-[1120px] flex-col gap-2 px-6 py-6 font-mono text-[11px] uppercase tracking-[0.14em] text-muted sm:flex-row sm:items-center sm:justify-between">
          <span>GC³ Portal · monorepo skeleton</span>
          <span>source of truth: Development-Breif.md</span>
        </div>
      </footer>
    </div>
  );
}
