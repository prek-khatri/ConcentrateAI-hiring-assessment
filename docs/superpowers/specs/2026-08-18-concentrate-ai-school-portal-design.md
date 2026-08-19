# Concentrate.ai School Portal — Implementation Design

Date: 2026-08-18
Source specs: `SPECS.md`, `concentrate-ai-architecture-and-coding-agent-spec.md`

## Purpose

This document resolves the tooling/scaffolding decisions the source specs
leave open, so `writing-plans` can produce an unambiguous implementation
plan. It does not restate the full domain model, API surface, or permission
matrix — those are authoritative in
`concentrate-ai-architecture-and-coding-agent-spec.md` and this doc defers
to it wherever the two overlap.

## Repo layout

npm workspaces at the root, no Turborepo/pnpm — the spec's dependency rule
("use only package.json deps") is easiest to satisfy with npm's built-in
workspace support rather than adding a build-orchestration tool.

```
/
├── apps/
│   ├── web/          Next.js 15 app (hand-rolled, not create-next-app)
│   └── api/           Fastify app (hand-rolled)
├── packages/
│   ├── db/             Kysely migrations, seeds, generated DB types
│   ├── shared/          Zod schemas, shared TS types, constants
│   └── auth/            JWT/session helpers shared by api
├── e2e/                 Playwright tests, run against full docker-compose stack
├── docker/
│   ├── nginx/
│   └── certbot/
├── .github/workflows/ci.yml
├── Dockerfile            root multi-stage build
├── docker-compose.yml
└── package.json          workspaces root
```

`packages/ui` is deliberately omitted at start — only one frontend consumes
components right now; add it later if a second consumer appears (YAGNI).

## Scaffolding approach

Both `apps/web` and `apps/api` are hand-rolled rather than generated via
`create-next-app` / a Fastify starter. Scaffolders emit template cruft
(example pages, unrelated lint configs, extra deps) that conflicts with the
"only use listed dependencies" constraint. Hand-rolling means every line in
`package.json` is intentional from commit one.

## Dependency inventory

This is the full allowed dependency list. Nothing outside this list gets
added without updating this doc first.

```
apps/api (runtime):
  fastify, @fastify/cookie, @fastify/cors, kysely, pg, ioredis,
  zod, jsonwebtoken, arctic, pino, groq-sdk

apps/web (runtime):
  next, react, react-dom, tailwindcss, zod
  + Radix/shadcn UI components added individually as needed (explicitly
    allowed by SPECS.md)

packages/db:
  kysely, pg
  dev: kysely-codegen

packages/shared:
  zod

root devDependencies (shared across workspaces):
  typescript, tsx, vitest, @vitest/coverage-v8,
  @testing-library/react, @testing-library/jest-dom,
  supertest, @playwright/test, eslint, prettier
```

## Authentication

- Google is the one required OAuth provider (fits the "school portal" theme;
  Google Workspace for Education is a common real-world analogue).
- Token exchange uses **arctic**, a small provider-agnostic OAuth2 client
  library, rather than hand-rolled `fetch` calls — PKCE and state validation
  are security-sensitive enough to prefer a purpose-built library over
  reimplementing them.
- JWT issuance, HTTP-only cookie handling, `requireAuth`/`requireRole`, and
  suspension enforcement follow `concentrate-ai-architecture-and-coding-agent-spec.md`
  §10-14 exactly — no deviation.

## Testing & coverage

- Vitest for unit tests in both `apps/api` and `apps/web`, plus API
  integration tests via Supertest against the real Fastify instance.
- No mocked database and no `testcontainers` (extra dependency, not on the
  allowed list). Integration tests run against a real Postgres/Redis
  started via `docker compose up -d postgres redis` in CI (and locally in
  dev), migrated and seeded before the test run.
- Coverage via Vitest's built-in `@vitest/coverage-v8`, with `thresholds`
  set to 100 (statements/branches/functions/lines) in each workspace's
  `vitest.config.ts`. The CI step fails naturally when a workspace drops
  below threshold — no separate coverage-enforcement script needed.
- Playwright E2E tests live in root `e2e/`, run against the full
  `docker compose up` stack (web + api + db + redis), with deterministic
  seed data reset before each run (no manually-prepared dev data, per
  spec §42).

## CI/CD pipeline (GitHub Actions)

```
npm ci
  → lint
  → typecheck
  → docker compose up -d postgres redis
  → migrate
  → seed
  → unit + integration tests (coverage gate, fails <100%)
  → build (web, api)
  → docker build
  → [separate job] Playwright E2E against composed stack
  → [main branch only] Docker Hub login → build → push
```

## Chatbot (extra credit)

- Provider: **Groq** (`groq-sdk`), not Anthropic/OpenAI — fast inference, generous free tier, simple chat-completions API.
- One endpoint, `POST /api/chatbot/ask` (`requireAuth`, no role restriction — every role gets it, scoped by their own data). Body: `{message: string}`. Response: `{reply: string}`.
- Context assembled server-side per request from `request.user` — never client-supplied: role, and role-appropriate data pulled through the existing repositories (student: their enrolled classes, upcoming published assignments, recent grades; teacher: their classes, assignments, pending ungraded submissions; admin: user/teacher-group counts). This context is injected into the system prompt; the model never gets raw DB access or a tool that can query outside what's been assembled.
- The system prompt explicitly instructs the model to answer only from the supplied context and to decline anything outside it — this is a narrow Q&A feature per spec §51, not a general-purpose assistant.
- `GROQ_API_KEY` added to the env schema (P2) and `.env.example`.

## Everything else

Domain model, migrations order, API contracts, permission matrix,
suspension rules, Redis caching strategy, Nginx/Certbot deployment,
frontend UI structure, and the phase-by-phase development checklist are
unchanged from `concentrate-ai-architecture-and-coding-agent-spec.md`
§3–§59. The implementation plan should follow that document's Phase 1–9
sequencing, using the tooling choices fixed in this design doc.
