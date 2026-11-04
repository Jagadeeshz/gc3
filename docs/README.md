# GC3 Portal — Documentation

Module documentation required by Development Brief §19.1 lives here, grouped by concern.

```text
docs/
├── architecture/   System shape, boundaries, tenancy model
├── api/            Endpoint contracts and conventions
├── database/       Schema and migration notes
├── product/        Requirements traceability to the Brief
├── workflows/      Onboarding, request, project and approval lifecycles
└── operations/     Environments, deployment, runbooks
```

## Current state

Phase 0. The only documentation that exists so far is the root `README.md` and the source-level
contracts in `packages/types` and `packages/validation`.

Each module added from Phase 1 onward must ship with its own overview covering: business purpose,
functional requirements, roles and permissions, workflow, data entities, API specification, UI
specification, validation rules, error handling, test cases, deployment notes and known limitations.
