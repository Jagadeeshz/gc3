# GC3 Portal — Documentation

The platform document for GC³, written to the house shape: cover, contents, an "at a glance"
page, five numbered sections that each open with a premise, and an appendix checklist.

```text
docs/
├── GC3-Portal-Documentation.docx   The document (Word, fields live)
├── GC3-Portal-Documentation.pdf    Rendered copy, contents and page numbers resolved
├── shots/                          Fourteen screens captured from the running build
├── architecture/   System shape, boundaries, tenancy model
├── api/            Endpoint contracts and conventions
├── database/       Schema and migration notes
├── product/        Requirements traceability to the Brief
├── workflows/      Onboarding, request, project and approval lifecycles
└── operations/     Environments, deployment, runbooks
```

## The document

| Section | Covers |
| --- | --- |
| 1 Executive Summary & Strategic Vision | What the product sells, the three surfaces, what is true today and what is not yet |
| 2 Brand Identity & Visual System | Palette and split, type, grid, components, the edge treatment, motion, accessibility |
| 3 Technical Blueprint | Monorepo, stack versions, data and tenancy, API surface, security, performance targets, quality gates |
| 4 The Three Portals | Public site, client portal and its roles, staff console, what each role sees, honesty rules |
| 5 Roadmap & Governance | Phases as they ran, ownership, risks, and an explicit list of what is not built |
| A Appendix | Launch readiness checklist, each line with its evidence |

Two conventions are carried through deliberately. Numbers that are targets say so, and gaps are
listed rather than implied away — Section 5.5 exists so the document cannot be read as promising
a credit ledger or a PDF invoice renderer that do not exist.

The document is generated from a builder script kept outside the repository, then rendered through
Word so the contents field and page numbers are real rather than placeholder text.

Each module added from here must ship with its own overview covering: business purpose,
functional requirements, roles and permissions, workflow, data entities, API specification, UI
specification, validation rules, error handling, test cases, deployment notes and known
limitations.
