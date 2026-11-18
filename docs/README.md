# GC3 Portal — Documentation

Module documentation required by Development Brief §19.1 lives here, grouped by concern.

```text
docs/
├── GC3_Portal_Documentation.md      Technical & functional documentation of the shipped platform
├── GC3_Figma_Editable_Blueprint.md  Design tokens and frame specs for a matching Figma file
├── architecture/   System shape, boundaries, tenancy model
├── api/            Endpoint contracts and conventions
├── database/       Schema and migration notes
├── product/        Requirements traceability to the Brief
├── workflows/      Onboarding, request, project and approval lifecycles
└── operations/     Environments, deployment, runbooks
```

## Current state

Two consolidated documents live at the top level and describe the platform as built, not as
planned:

- **`GC3_Portal_Documentation.md`** — scope, value by audience, architecture across the three
  portals, design language, stack, tenancy and security, quality, and an explicit list of what
  is deliberately not built.
- **`GC3_Figma_Editable_Blueprint.md`** — a Token Studio JSON set, per-screen frame
  specifications and component specs, plus a table recording where the blueprint diverges from
  earlier briefs (palette, motion library, hero copy, ribbon geometry).

Both are written from the codebase. Where a brief and the shipped product disagreed, the
document records the product and states the correction rather than carrying the brief forward.

Each module added from here must ship with its own overview covering: business purpose,
functional requirements, roles and permissions, workflow, data entities, API specification, UI
specification, validation rules, error handling, test cases, deployment notes and known
limitations.
