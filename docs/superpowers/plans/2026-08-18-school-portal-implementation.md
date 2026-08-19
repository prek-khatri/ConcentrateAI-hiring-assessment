# Concentrate.ai School Portal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the full Concentrate.ai school portal (Admin/Teacher/Student roles, class/assignment/grading workflows, statistics API, OAuth+JWT auth, Docker/CI deployment) to the hiring assessment's spec, split across three engineers working largely in parallel.

**Architecture:** Modular monolith — one Fastify API with domain modules, one Next.js frontend, npm workspaces monorepo. Server-side authorization only; frontend role checks are UX-only.

**Tech Stack:** Next.js 15, React 19, Tailwind, Radix/shadcn; Fastify, TypeScript, Zod; PostgreSQL 17 + Kysely; Redis; Vitest, RTL, Supertest, Playwright; Docker/Docker Compose, Nginx, Certbot; GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-08-18-concentrate-ai-school-portal-design.md` (tooling decisions) and `concentrate-ai-architecture-and-coding-agent-spec.md` (full domain model, API contracts, permission matrix — authoritative for anything not restated here).

## Global Constraints

- Dependencies limited to the inventory in the design doc; only Radix/shadcn components may be added beyond it.
- Coverage gate: 100% statements, branches, functions, lines in every workspace; CI fails below threshold. Never lower thresholds to pass.
- All protected operations authorized server-side (`requireAuth`/`requireRole`/ownership helpers). Frontend role checks are UX only, never the security boundary.
- Migrations are immutable once committed — never edit an applied migration, always add a new one.
- API error shape is always `{"error": {"code": "...", "message": "..."}}` with codes from `{UNAUTHORIZED, FORBIDDEN, NOT_FOUND, VALIDATION_ERROR, CONFLICT, INTERNAL_ERROR}`.
- JWT payload is minimal (`sub`, `role`, `iat`, `exp`) — suspension is checked against current DB state on every request, never trusted from the token.
- Stats endpoints return explicit DTOs (never raw DB rows); `averageGrade` is `null`, not `0`, when no grades exist.
- No microservices, GraphQL, event buses, or CQRS.

## Team Assignment & Sequencing

- **Prateek — Foundation & DevOps (Tasks P1–P12):** repo scaffold, DB schema/migrations/seed, shared Zod/DTO contracts, Fastify+Next bootstrap, Redis, Google OAuth + JWT + RBAC, Docker/Nginx/Certbot, CI/CD.
- **Vraj — Backend Domain (Tasks V1–V9):** Users, Teacher Groups, Classes, Enrollment, Assignments, Submissions, Grades, Statistics API + Redis caching, backend test/coverage sweep.
- **Preksha — Frontend & E2E (Tasks F1–F12):** app shell, all role UIs, API client layer, component tests, Playwright E2E.

**Critical path:** P1–P9 (repo scaffold through auth) must land before Vraj or Preksha start — they define the DB schema, shared Zod/DTO types, and `requireAuth`/`requireRole` signatures both tracks build against. P10 (Next.js bootstrap + base API client) gates Preksha specifically. Once P1–P10 are merged, Vraj and Preksha work in parallel; each Preksha task names the specific Vraj task whose DTO it consumes. P11 (Docker/Nginx) and P12 (CI) are Prateek's, but P12 only finalizes once `test`/`coverage`/`lint`/`typecheck` scripts exist in every workspace (i.e., after V9 and F10/F12 land) — treat P12 as an integration task done last.

---

## Track: Prateek — Foundation & DevOps

### Task P1: Root workspace scaffold

**Files:**
- Create: `package.json` (root, `"workspaces": ["apps/*", "packages/*"]`)
- Create: `apps/web/package.json`, `apps/api/package.json`
- Create: `packages/db/package.json`, `packages/shared/package.json`, `packages/auth/package.json`
- Create: `tsconfig.base.json`, `apps/web/tsconfig.json`, `apps/api/tsconfig.json`, `packages/*/tsconfig.json`
- Create: `.gitignore`, `.env.example`

**Interfaces:**
- Produces: `npm install` resolves all workspaces; each workspace package name is `@school/web`, `@school/api`, `@school/db`, `@school/shared`, `@school/auth`.

- [ ] **Step 1:** Write root `package.json`:
```json
{
  "name": "concentrate-school-portal",
  "private": true,
  "workspaces": ["apps/*", "packages/*"],
  "scripts": {
    "dev": "npm run dev --workspaces --if-present",
    "build": "npm run build --workspaces --if-present",
    "test": "npm run test --workspaces --if-present",
    "coverage": "npm run coverage --workspaces --if-present",
    "lint": "eslint . --ext .ts,.tsx",
    "typecheck": "npm run typecheck --workspaces --if-present"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "tsx": "^4.19.0",
    "eslint": "^9.13.0",
    "prettier": "^3.3.0"
  }
}
```
- [ ] **Step 2:** Create each workspace's `package.json` with `"name"`, `"version": "0.0.0"`, `"private": true`, empty `dependencies`/`devDependencies` (filled in by later tasks), and per-workspace scripts stubs (`"build": "tsc -p ."`, `"typecheck": "tsc --noEmit"`).
- [ ] **Step 3:** Write `tsconfig.base.json` (strict mode, `"target": "ES2022"`, `"module": "NodeNext"`, `"moduleResolution": "NodeNext"`), and have each workspace `tsconfig.json` extend it with its own `include`/`outDir`.
- [ ] **Step 4:** Write `.gitignore` (`node_modules/`, `dist/`, `.next/`, `.env`, `coverage/`, `playwright-report/`, `test-results/`).
- [ ] **Step 5:** Write `.env.example` with `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `OAUTH_CLIENT_ID`, `OAUTH_CLIENT_SECRET`, `OAUTH_CALLBACK_URL`, each with a placeholder value and one-line comment.
- [ ] **Step 6:** Run `npm install` from root. Expected: completes with no errors, `node_modules/` created, workspace symlinks present under `node_modules/@school/*`.
- [ ] **Step 7: Commit**
```bash
git add package.json package-lock.json apps/*/package.json packages/*/package.json tsconfig.base.json apps/*/tsconfig.json packages/*/tsconfig.json .gitignore .env.example
git commit -m "chore: scaffold npm workspaces monorepo"
```

---

### Task P2: Environment validation + Docker Compose dev stack

**Files:**
- Create: `apps/api/src/config/env.ts`
- Create: `apps/api/tests/config/env.test.ts`
- Create: `docker-compose.yml` (postgres + redis services only, for local dev)

**Interfaces:**
- Consumes: nothing.
- Produces: `export const envSchema: ZodSchema`, `export const env: z.infer<typeof envSchema>` — parsed and validated at import time, throwing with a readable message if a required var is missing. Downstream tasks import `env.DATABASE_URL`, `env.REDIS_URL`, `env.JWT_SECRET`, `env.OAUTH_CLIENT_ID`, `env.OAUTH_CLIENT_SECRET`, `env.OAUTH_CALLBACK_URL`, `env.PORT`.

- [ ] **Step 1: Write the failing test**
```typescript
// apps/api/tests/config/env.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";

describe("env validation", () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
  });

  it("throws when DATABASE_URL is missing", async () => {
    delete process.env.DATABASE_URL;
    await expect(async () => {
      const { loadEnv } = await import("../../src/config/env.js");
      loadEnv();
    }).rejects.toThrow();
  });
});
```
- [ ] **Step 2:** Run `npm run test --workspace=apps/api -- env.test.ts`. Expected: FAIL (module doesn't exist).
- [ ] **Step 3:** Write `apps/api/src/config/env.ts`:
```typescript
import { z } from "zod";

export const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  OAUTH_CLIENT_ID: z.string().min(1),
  OAUTH_CLIENT_SECRET: z.string().min(1),
  OAUTH_CALLBACK_URL: z.string().url(),
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(): Env {
  return envSchema.parse(process.env);
}

export const env = loadEnv();
```
- [ ] **Step 4:** Run test again. Expected: PASS.
- [ ] **Step 5:** Write `docker-compose.yml`:
```yaml
services:
  postgres:
    image: postgres:17
    environment:
      POSTGRES_USER: school
      POSTGRES_PASSWORD: school
      POSTGRES_DB: school_portal
    ports: ["5432:5432"]
    volumes: ["pgdata:/var/lib/postgresql/data"]
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U school"]
      interval: 5s
      timeout: 5s
      retries: 10
  redis:
    image: redis:7
    ports: ["6379:6379"]
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 10
volumes:
  pgdata:
```
- [ ] **Step 6:** Run `docker compose up -d postgres redis`. Expected: both containers start and report healthy (`docker compose ps`).
- [ ] **Step 7: Commit**
```bash
git add apps/api/src/config/env.ts apps/api/tests/config/env.test.ts docker-compose.yml
git commit -m "feat: env validation and dev docker-compose stack"
```

---

### Task P3: Kysely instance + migration runner

**Files:**
- Create: `packages/db/src/db.ts`
- Create: `packages/db/src/migrate.ts`
- Create: `packages/db/package.json` scripts (`"migrate": "tsx src/migrate.ts"`)
- Create: `packages/db/migrations/` (empty dir, populated in P4)

**Interfaces:**
- Consumes: `env.DATABASE_URL` from `apps/api/src/config/env.ts` is NOT imported here — `packages/db` takes its own `DATABASE_URL` from `process.env` directly so it stays usable standalone (migration CLI runs outside the API process).
- Produces: `export function createDb<DB>(connectionString: string): Kysely<DB>`; `export async function migrateToLatest(db: Kysely<any>): Promise<void>` that runs all migrations in `packages/db/migrations/` in filename order and throws on failure.

- [ ] **Step 1:** Write `packages/db/src/db.ts`:
```typescript
import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";

export function createDb<DB>(connectionString: string): Kysely<DB> {
  return new Kysely<DB>({
    dialect: new PostgresDialect({
      pool: new Pool({ connectionString }),
    }),
  });
}
```
- [ ] **Step 2:** Write `packages/db/src/migrate.ts`:
```typescript
import { promises as fs } from "fs";
import path from "path";
import { Migrator, FileMigrationProvider } from "kysely";
import { createDb } from "./db.js";

export async function migrateToLatest(): Promise<void> {
  const db = createDb(process.env.DATABASE_URL!);
  const migrator = new Migrator({
    db,
    provider: new FileMigrationProvider({
      fs,
      path,
      migrationFolder: path.join(import.meta.dirname, "../migrations"),
    }),
  });
  const { error, results } = await migrator.migrateToLatest();
  results?.forEach((r) => console.log(`${r.status}: ${r.migrationName}`));
  if (error) {
    console.error("Migration failed:", error);
    process.exit(1);
  }
  await db.destroy();
}

migrateToLatest();
```
- [ ] **Step 3:** Add to `packages/db/package.json`: `"scripts": {"migrate": "tsx src/migrate.ts"}`, deps `kysely`, `pg`, devDep `tsx`.
- [ ] **Step 4:** Run `DATABASE_URL=postgresql://school:school@localhost:5432/school_portal npm run migrate --workspace=packages/db`. Expected: runs with "No migrations to run" (folder still empty) — confirms the runner connects and executes without error.
- [ ] **Step 5: Commit**
```bash
git add packages/db/src/db.ts packages/db/src/migrate.ts packages/db/package.json
git commit -m "feat: kysely instance and migration runner"
```

---

### Task P4: Database schema — all migrations + DB type interface

**Files:**
- Create: `packages/db/migrations/001_create_users.ts` through `009_create_grades.ts`
- Create: `packages/db/src/types.ts`

**Interfaces:**
- Produces: `packages/db/src/types.ts` exports the `DB` interface (Kysely table map) that `packages/db/src/db.ts`'s `Kysely<DB>` generic uses everywhere downstream. Every other backend task imports `import type { DB } from "@school/db/types"`.

- [ ] **Step 1:** Write `packages/db/migrations/001_create_users.ts`:
```typescript
import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("users")
    .addColumn("id", "uuid", (c) => c.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("email", "varchar", (c) => c.notNull().unique())
    .addColumn("name", "varchar", (c) => c.notNull())
    .addColumn("role", "varchar", (c) => c.notNull())
    .addColumn("is_suspended", "boolean", (c) => c.notNull().defaultTo(false))
    .addColumn("created_at", "timestamp", (c) => c.notNull().defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamp", (c) => c.notNull().defaultTo(sql`now()`))
    .execute();
  await db.schema.createIndex("users_email_idx").on("users").column("email").execute();
  await db.schema.createIndex("users_role_idx").on("users").column("role").execute();
  await sql`ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin','teacher','student'))`.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("users").execute();
}
```
- [ ] **Step 2:** Write `002_create_oauth_accounts.ts` — table `oauth_accounts` (`id` uuid PK, `user_id` uuid FK→users.id, `provider` varchar not null, `provider_account_id` varchar not null, `created_at` timestamp), unique index on `(provider, provider_account_id)`.
- [ ] **Step 3:** Write `003_create_teacher_groups.ts` — table `teacher_groups` (`id` uuid PK, `name` varchar not null, `created_at`, `updated_at`).
- [ ] **Step 4:** Write `004_create_teacher_group_members.ts` — table `teacher_group_members` (`teacher_group_id` uuid FK→teacher_groups.id, `teacher_id` uuid FK→users.id), composite PK `(teacher_group_id, teacher_id)`.
- [ ] **Step 5:** Write `005_create_classes.ts` — table `classes` (`id` uuid PK, `name` varchar not null, `description` text nullable, `teacher_id` uuid FK→users.id not null, `created_at`, `updated_at`), index on `teacher_id`.
- [ ] **Step 6:** Write `006_create_class_students.ts` — table `class_students` (`class_id` uuid FK→classes.id, `student_id` uuid FK→users.id, `created_at`), composite PK `(class_id, student_id)`, indexes on both columns.
- [ ] **Step 7:** Write `007_create_assignments.ts` — table `assignments` (`id` uuid PK, `class_id` uuid FK→classes.id not null, `title` varchar not null, `description` text nullable, `published` boolean not null default false, `due_at` timestamp nullable, `created_at`, `updated_at`), indexes on `class_id` and `published`.
- [ ] **Step 8:** Write `008_create_submissions.ts` — table `submissions` (`id` uuid PK, `assignment_id` uuid FK→assignments.id not null, `student_id` uuid FK→users.id not null, `content` text not null, `submitted_at` timestamp not null default now(), `updated_at` timestamp not null default now()), unique index on `(assignment_id, student_id)`, indexes on each column individually.
- [ ] **Step 9:** Write `009_create_grades.ts` — table `grades` (`id` uuid PK, `submission_id` uuid unique not null FK→submissions.id, `score` numeric not null, `feedback` text nullable, `graded_at` timestamp not null default now(), `graded_by` uuid FK→users.id not null), plus `CHECK (score >= 0 AND score <= 100)` constraint via `sql` tag, index on `submission_id`.
- [ ] **Step 10:** Write `packages/db/src/types.ts` mapping every table above to a Kysely table interface (`id: Generated<string>` for PK columns using `gen_random_uuid()` default, `Generated<Date>` for timestamp defaults, plain types otherwise) and export the aggregate:
```typescript
import type { Generated, ColumnType } from "kysely";

export interface UsersTable {
  id: Generated<string>;
  email: string;
  name: string;
  role: "admin" | "teacher" | "student";
  is_suspended: Generated<boolean>;
  created_at: Generated<Date>;
  updated_at: Generated<Date>;
}
// ... OAuthAccountsTable, TeacherGroupsTable, TeacherGroupMembersTable,
//     ClassesTable, ClassStudentsTable, AssignmentsTable, SubmissionsTable, GradesTable
// following the same pattern as the corresponding migration.

export interface DB {
  users: UsersTable;
  oauth_accounts: OAuthAccountsTable;
  teacher_groups: TeacherGroupsTable;
  teacher_group_members: TeacherGroupMembersTable;
  classes: ClassesTable;
  class_students: ClassStudentsTable;
  assignments: AssignmentsTable;
  submissions: SubmissionsTable;
  grades: GradesTable;
}
```
- [ ] **Step 11:** Run `DATABASE_URL=postgresql://school:school@localhost:5432/school_portal npm run migrate --workspace=packages/db`. Expected: all 9 migrations report `Success`.
- [ ] **Step 12:** Verify schema: `docker compose exec postgres psql -U school -d school_portal -c '\dt'`. Expected: 9 tables listed.
- [ ] **Step 13: Commit**
```bash
git add packages/db/migrations/ packages/db/src/types.ts
git commit -m "feat: database schema — all 9 migrations and DB type map"
```

---

### Task P5: Deterministic seed data

**Files:**
- Create: `packages/db/seeds/seed.ts`
- Add script: `packages/db/package.json` → `"seed": "tsx seeds/seed.ts"`

**Interfaces:**
- Consumes: `createDb<DB>` from `packages/db/src/db.ts`, `DB` type from `packages/db/src/types.ts`.
- Produces: idempotent seed (safe to re-run — upserts by fixed UUIDs or `email`/`name` unique constraints) matching spec §9: 1 admin, 2 teachers, 3 students, 1 class ("Biology 101") owned by `teacher@example.com` with all 3 students enrolled, 2 assignments (one published with a submission+grade, one draft), so both graded and ungraded states exist for stats/UI testing.

- [ ] **Step 1:** Write `packages/db/seeds/seed.ts` using fixed, hardcoded UUIDs per entity (e.g. `const ADMIN_ID = "00000000-0000-0000-0000-000000000001"`) so re-running is idempotent via `onConflict((oc) => oc.column("id").doNothing())` on each insert.
- [ ] **Step 2:** Insert users: `admin@example.com` (admin), `teacher@example.com`/`teacher2@example.com` (teacher), `student@example.com`/`student2@example.com`/`student3@example.com` (student). All `is_suspended: false`.
- [ ] **Step 3:** Insert class "Biology 101" with `teacher_id` = teacher@example.com's id; insert `class_students` rows for all 3 students.
- [ ] **Step 4:** Insert 2 assignments on Biology 101: "Cell Structure" (`published: true`, `due_at` in the past), "Photosynthesis" (`published: false`).
- [ ] **Step 5:** Insert 1 submission from student@example.com on "Cell Structure", and 1 grade on that submission (`score: 92`, `feedback: "Excellent explanation of mitochondria."`, `graded_by` = teacher's id).
- [ ] **Step 6:** Run `DATABASE_URL=postgresql://school:school@localhost:5432/school_portal npm run seed --workspace=packages/db`. Expected: completes without error.
- [ ] **Step 7:** Run it a second time. Expected: still completes without error (idempotency check) and row counts unchanged (`SELECT count(*) FROM users` stays 6).
- [ ] **Step 8: Commit**
```bash
git add packages/db/seeds/seed.ts packages/db/package.json
git commit -m "feat: deterministic seed data"
```

---

### Task P6: Shared Zod schemas, DTO types, and error contract

**Files:**
- Create: `packages/shared/src/schemas/user.ts`, `class.ts`, `assignment.ts`, `submission.ts`, `grade.ts`, `teacher-group.ts`
- Create: `packages/shared/src/errors.ts`
- Create: `packages/shared/src/dto/stats.ts`
- Create: `packages/shared/tests/errors.test.ts`

**Interfaces:**
- Produces (exact names Vraj and Preksha both import from `@school/shared`):
  - `ErrorCode = "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND" | "VALIDATION_ERROR" | "CONFLICT" | "INTERNAL_ERROR"`
  - `class ApiError extends Error { code: ErrorCode; statusCode: number }`
  - `CreateUserSchema`, `UpdateUserSchema`, `CreateClassSchema`, `UpdateClassSchema`, `CreateAssignmentSchema`, `UpdateAssignmentSchema`, `CreateSubmissionSchema`, `GradeSubmissionSchema`, `CreateTeacherGroupSchema`, `UpdateTeacherGroupSchema` — each `z.object({...})` matching the fields in the corresponding migration from P4 (no `id`/`created_at`/`updated_at`/ownership fields, those come from route params or `request.user`).
  - `AverageGradeResponse = { averageGrade: number | null }`, `ClassListResponse = { classes: {id:string; name:string; teacherName:string}[] }`, `ClassStudentsResponse = { class: {id:string; name:string}; students: {id:string; name:string}[] }`.

- [ ] **Step 1: Write the failing test**
```typescript
// packages/shared/tests/errors.test.ts
import { describe, it, expect } from "vitest";
import { ApiError } from "../src/errors.js";

describe("ApiError", () => {
  it("maps FORBIDDEN to status 403", () => {
    const err = new ApiError("FORBIDDEN", "nope");
    expect(err.statusCode).toBe(403);
    expect(err.code).toBe("FORBIDDEN");
  });
});
```
- [ ] **Step 2:** Run `npm run test --workspace=packages/shared`. Expected: FAIL (module missing).
- [ ] **Step 3:** Write `packages/shared/src/errors.ts`:
```typescript
export type ErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION_ERROR"
  | "CONFLICT"
  | "INTERNAL_ERROR";

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  VALIDATION_ERROR: 400,
  CONFLICT: 409,
  INTERNAL_ERROR: 500,
};

export class ApiError extends Error {
  code: ErrorCode;
  statusCode: number;

  constructor(code: ErrorCode, message: string) {
    super(message);
    this.code = code;
    this.statusCode = STATUS_BY_CODE[code];
  }

  toJSON() {
    return { error: { code: this.code, message: this.message } };
  }
}
```
- [ ] **Step 4:** Run test again. Expected: PASS.
- [ ] **Step 5:** Write `packages/shared/src/schemas/user.ts`:
```typescript
import { z } from "zod";

export const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  role: z.enum(["admin", "teacher", "student"]),
});

export const UpdateUserSchema = CreateUserSchema.partial();
```
- [ ] **Step 6:** Write `packages/shared/src/schemas/class.ts` (`CreateClassSchema: {name: z.string().min(1), description: z.string().optional()}`, `UpdateClassSchema = CreateClassSchema.partial()`), `assignment.ts` (`CreateAssignmentSchema: {title: z.string().min(1), description: z.string().optional(), dueAt: z.string().datetime().optional()}`, `UpdateAssignmentSchema = CreateAssignmentSchema.partial()`), `submission.ts` (`CreateSubmissionSchema: {content: z.string().min(1)}`), `grade.ts` (`GradeSubmissionSchema: {score: z.number().min(0).max(100), feedback: z.string().optional()}`), `teacher-group.ts` (`CreateTeacherGroupSchema: {name: z.string().min(1)}`, `UpdateTeacherGroupSchema = CreateTeacherGroupSchema.partial()`) — each following the same pattern as Step 5, fields matching P4's migrations exactly.
- [ ] **Step 7:** Write `packages/shared/src/dto/stats.ts`:
```typescript
export type AverageGradeResponse = { averageGrade: number | null };
export type ClassListResponse = { classes: { id: string; name: string; teacherName: string }[] };
export type ClassStudentsResponse = {
  class: { id: string; name: string };
  students: { id: string; name: string }[];
};
```
- [ ] **Step 8:** Create `packages/shared/src/index.ts` re-exporting everything from `errors.ts`, `schemas/*`, `dto/stats.ts`.
- [ ] **Step 9:** Run `npm run test --workspace=packages/shared`. Expected: PASS.
- [ ] **Step 10: Commit**
```bash
git add packages/shared/
git commit -m "feat: shared zod schemas, DTO types, error contract"
```

---

### Task P7: Fastify bootstrap + error handler + health check

**Files:**
- Create: `apps/api/src/app.ts`
- Create: `apps/api/src/server.ts`
- Create: `apps/api/src/plugins/error-handler.ts`
- Create: `apps/api/tests/app.test.ts`

**Interfaces:**
- Consumes: `ApiError` from `@school/shared`, `env` from `./config/env.js`.
- Produces: `export async function buildApp(): Promise<FastifyInstance>` — the factory every route-module test and every later route-registration task uses (`const app = await buildApp()` then `app.register(someModulePlugin)`). `server.ts` is the only file that calls `.listen()`.

- [ ] **Step 1: Write the failing test**
```typescript
// apps/api/tests/app.test.ts
import { describe, it, expect } from "vitest";
import { buildApp } from "../src/app.js";

describe("GET /health", () => {
  it("returns 200 ok", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok" });
    await app.close();
  });
});
```
- [ ] **Step 2:** Run `npm run test --workspace=apps/api -- app.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Write `apps/api/src/plugins/error-handler.ts`:
```typescript
import type { FastifyInstance } from "fastify";
import { ApiError } from "@school/shared";
import { ZodError } from "zod";

export async function errorHandlerPlugin(app: FastifyInstance) {
  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof ApiError) {
      return reply.status(err.statusCode).send(err.toJSON());
    }
    if (err instanceof ZodError) {
      return reply
        .status(400)
        .send({ error: { code: "VALIDATION_ERROR", message: err.issues.map((i) => i.message).join("; ") } });
    }
    app.log.error(err);
    return reply.status(500).send({ error: { code: "INTERNAL_ERROR", message: "Unexpected error" } });
  });
}
```
- [ ] **Step 4:** Write `apps/api/src/app.ts`:
```typescript
import Fastify, { type FastifyInstance } from "fastify";
import cookie from "@fastify/cookie";
import cors from "@fastify/cors";
import { errorHandlerPlugin } from "./plugins/error-handler.js";

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({ logger: true });
  await app.register(cookie);
  await app.register(cors, { origin: true, credentials: true });
  await app.register(errorHandlerPlugin);

  app.get("/health", async () => ({ status: "ok" }));

  return app;
}
```
- [ ] **Step 5:** Write `apps/api/src/server.ts`:
```typescript
import { buildApp } from "./app.js";
import { env } from "./config/env.js";

const app = await buildApp();
await app.listen({ port: env.PORT, host: "0.0.0.0" });
```
- [ ] **Step 6:** Run test again. Expected: PASS.
- [ ] **Step 7: Commit**
```bash
git add apps/api/src/app.ts apps/api/src/server.ts apps/api/src/plugins/error-handler.ts apps/api/tests/app.test.ts
git commit -m "feat: fastify bootstrap, error handler, health check"
```

---

### Task P8: Redis connection plugin

**Files:**
- Create: `apps/api/src/plugins/redis.ts`
- Modify: `apps/api/src/app.ts` (register the plugin)
- Create: `apps/api/tests/plugins/redis.test.ts`

**Interfaces:**
- Produces: `app.redis` decorator (an `ioredis` client instance), available to every route registered after this plugin. Vraj's stats caching (Task V8) uses `app.redis.get`/`set`/`del`.

- [ ] **Step 1: Write the failing test**
```typescript
// apps/api/tests/plugins/redis.test.ts
import { describe, it, expect } from "vitest";
import { buildApp } from "../../src/app.js";

describe("redis plugin", () => {
  it("decorates app with a working redis client", async () => {
    const app = await buildApp();
    await app.redis.set("test:key", "value");
    const val = await app.redis.get("test:key");
    expect(val).toBe("value");
    await app.redis.del("test:key");
    await app.close();
  });
});
```
- [ ] **Step 2:** Run test. Expected: FAIL (decorator undefined).
- [ ] **Step 3:** Write `apps/api/src/plugins/redis.ts`:
```typescript
import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import Redis from "ioredis";
import { env } from "../config/env.js";

declare module "fastify" {
  interface FastifyInstance {
    redis: Redis;
  }
}

export const redisPlugin = fp(async (app: FastifyInstance) => {
  const client = new Redis(env.REDIS_URL);
  app.decorate("redis", client);
  app.addHook("onClose", async () => {
    await client.quit();
  });
});
```
- [ ] **Step 4:** In `apps/api/src/app.ts`, add `await app.register(redisPlugin);` after the error handler registration.
- [ ] **Step 5:** Ensure `docker compose up -d redis` is running, then run test again. Expected: PASS.
- [ ] **Step 6: Commit**
```bash
git add apps/api/src/plugins/redis.ts apps/api/src/app.ts apps/api/tests/plugins/redis.test.ts
git commit -m "feat: redis connection plugin"
```

---

### Task P9: Google OAuth + JWT + RBAC

**Files:**
- Create: `packages/auth/src/jwt.ts`
- Create: `packages/auth/src/cookies.ts`
- Create: `apps/api/src/middleware/require-auth.ts`
- Create: `apps/api/src/middleware/require-role.ts`
- Create: `apps/api/src/modules/auth/auth.repository.ts`
- Create: `apps/api/src/modules/auth/auth.service.ts`
- Create: `apps/api/src/modules/auth/auth.routes.ts`
- Modify: `apps/api/src/app.ts` (register auth routes)
- Create: `apps/api/tests/modules/auth/auth.routes.test.ts`
- Create: `apps/api/tests/middleware/require-auth.test.ts`

**Interfaces:**
- Consumes: `env.JWT_SECRET`, `env.OAUTH_CLIENT_ID`, `env.OAUTH_CLIENT_SECRET`, `env.OAUTH_CALLBACK_URL` from `./config/env.js`; `DB` type from `@school/db/types`; `ApiError` from `@school/shared`.
- Produces (every downstream route-module task in V1–V9 imports these exact names):
```typescript
// apps/api/src/middleware/require-auth.ts
export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void>
// sets request.user = { id: string; email: string; name: string; role: "admin"|"teacher"|"student" }
// throws ApiError("UNAUTHORIZED", ...) if no/invalid cookie
// throws ApiError("FORBIDDEN", "Account suspended") if current DB row has is_suspended = true

// apps/api/src/middleware/require-role.ts
export function requireRole(...roles: Array<"admin"|"teacher"|"student">): (request: FastifyRequest, reply: FastifyReply) => Promise<void>
// throws ApiError("FORBIDDEN", ...) if request.user.role not in roles
```
Routes: `GET /auth/oauth/google`, `GET /auth/oauth/google/callback`, `GET /api/auth/me`, `POST /api/auth/logout`.

- [ ] **Step 1: Write the failing test**
```typescript
// apps/api/tests/middleware/require-auth.test.ts
import { describe, it, expect } from "vitest";
import { buildApp } from "../../src/app.js";

describe("requireAuth", () => {
  it("returns 401 with no cookie", async () => {
    const app = await buildApp();
    app.get("/protected", { preHandler: (await import("../../src/middleware/require-auth.js")).requireAuth }, async () => ({ ok: true }));
    const res = await app.inject({ method: "GET", url: "/protected" });
    expect(res.statusCode).toBe(401);
    expect(res.json().error.code).toBe("UNAUTHORIZED");
    await app.close();
  });
});
```
- [ ] **Step 2:** Run test. Expected: FAIL (module missing).
- [ ] **Step 3:** Write `packages/auth/src/jwt.ts`:
```typescript
import jwt from "jsonwebtoken";

export type JwtPayload = { sub: string; role: "admin" | "teacher" | "student" };

export function signJwt(payload: JwtPayload, secret: string): string {
  return jwt.sign(payload, secret, { expiresIn: "7d" });
}

export function verifyJwt(token: string, secret: string): JwtPayload {
  return jwt.verify(token, secret) as JwtPayload;
}
```
- [ ] **Step 4:** Write `packages/auth/src/cookies.ts`:
```typescript
export const AUTH_COOKIE_NAME = "school_session";

export const authCookieOptions = (isProd: boolean) => ({
  httpOnly: true,
  secure: isProd,
  sameSite: "lax" as const,
  path: "/",
});
```
- [ ] **Step 5:** Write `apps/api/src/modules/auth/auth.repository.ts`:
```typescript
import type { Kysely } from "kysely";
import type { DB } from "@school/db/types";

export function createAuthRepository(db: Kysely<DB>) {
  return {
    findUserById: (id: string) =>
      db.selectFrom("users").selectAll().where("id", "=", id).executeTakeFirst(),
    findUserByEmail: (email: string) =>
      db.selectFrom("users").selectAll().where("email", "=", email).executeTakeFirst(),
    findOAuthAccount: (provider: string, providerAccountId: string) =>
      db
        .selectFrom("oauth_accounts")
        .selectAll()
        .where("provider", "=", provider)
        .where("provider_account_id", "=", providerAccountId)
        .executeTakeFirst(),
    createUserWithOAuth: (input: { email: string; name: string; providerAccountId: string }) =>
      db.transaction().execute(async (trx) => {
        const user = await trx
          .insertInto("users")
          .values({ email: input.email, name: input.name, role: "student" })
          .returningAll()
          .executeTakeFirstOrThrow();
        await trx
          .insertInto("oauth_accounts")
          .values({ user_id: user.id, provider: "google", provider_account_id: input.providerAccountId })
          .execute();
        return user;
      }),
  };
}
```
- [ ] **Step 6:** Write `apps/api/src/middleware/require-auth.ts`:
```typescript
import type { FastifyRequest, FastifyReply } from "fastify";
import { ApiError } from "@school/shared";
import { verifyJwt } from "@school/auth/jwt";
import { AUTH_COOKIE_NAME } from "@school/auth/cookies";
import { env } from "../config/env.js";
import { createAuthRepository } from "../modules/auth/auth.repository.js";
import { db } from "../db.js";

declare module "fastify" {
  interface FastifyRequest {
    user: { id: string; email: string; name: string; role: "admin" | "teacher" | "student" };
  }
}

export async function requireAuth(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const token = request.cookies[AUTH_COOKIE_NAME];
  if (!token) throw new ApiError("UNAUTHORIZED", "Not authenticated");

  let payload;
  try {
    payload = verifyJwt(token, env.JWT_SECRET);
  } catch {
    throw new ApiError("UNAUTHORIZED", "Invalid or expired session");
  }

  const repo = createAuthRepository(db);
  const user = await repo.findUserById(payload.sub);
  if (!user) throw new ApiError("UNAUTHORIZED", "User not found");
  if (user.is_suspended) throw new ApiError("FORBIDDEN", "Account suspended");

  request.user = { id: user.id, email: user.email, name: user.name, role: user.role };
}
```
- [ ] **Step 7:** Write `apps/api/src/middleware/require-role.ts`:
```typescript
import type { FastifyRequest, FastifyReply } from "fastify";
import { ApiError } from "@school/shared";

export function requireRole(...roles: Array<"admin" | "teacher" | "student">) {
  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    if (!roles.includes(request.user.role)) {
      throw new ApiError("FORBIDDEN", `Requires role: ${roles.join(" or ")}`);
    }
  };
}
```
- [ ] **Step 8:** Create `apps/api/src/db.ts` — singleton: `export const db = createDb<DB>(env.DATABASE_URL);` (imports `createDb` from `@school/db`, `DB` from `@school/db/types`, `env` from `./config/env.js`). This is the shared DB handle every module task (V1–V9) imports.
- [ ] **Step 9:** Write `apps/api/src/modules/auth/auth.service.ts` using `arctic`'s `Google` class for the OAuth2/PKCE flow: `getAuthorizationUrl(state, codeVerifier)`, `exchangeCodeForTokens(code, codeVerifier)`, `fetchGoogleUserInfo(accessToken)` (calls `https://www.googleapis.com/oauth2/v3/userinfo`), and `findOrCreateUser(googleProfile)` which calls the repository's `findOAuthAccount` → `findUserById`, or `findUserByEmail` → link, or `createUserWithOAuth` in that priority order.
- [ ] **Step 10:** Write `apps/api/src/modules/auth/auth.routes.ts`:
  - `GET /auth/oauth/google`: generates PKCE verifier + state, stores both in short-lived signed cookies, redirects to Google's authorization URL.
  - `GET /auth/oauth/google/callback`: reads `code`/`state` query params, validates `state` against the cookie, exchanges the code, fetches the profile, calls `findOrCreateUser`, signs a JWT (`signJwt({sub: user.id, role: user.role}, env.JWT_SECRET)`), sets it via `reply.setCookie(AUTH_COOKIE_NAME, token, authCookieOptions(env.NODE_ENV === "production"))`, redirects to the frontend dashboard.
  - `GET /api/auth/me` (preHandler: `requireAuth`): returns `{ id, name, email, role }` from `request.user`.
  - `POST /api/auth/logout` (preHandler: `requireAuth`): `reply.clearCookie(AUTH_COOKIE_NAME, { path: "/" })`, returns `204`.
- [ ] **Step 11:** In `apps/api/src/app.ts`, register `authRoutes` plugin after the redis plugin.
- [ ] **Step 12:** Write `apps/api/tests/modules/auth/auth.routes.test.ts` covering: `GET /api/auth/me` → 401 with no cookie; `GET /api/auth/me` → 200 with a valid signed JWT cookie (seed a user first, sign a JWT for their id, inject with `cookies: {[AUTH_COOKIE_NAME]: token}`); `POST /api/auth/logout` → 204 and clears cookie; suspended user → `GET /api/auth/me` returns 403.
- [ ] **Step 13:** Run `npm run test --workspace=apps/api`. Expected: all pass, including Step 1's test now that `require-auth.ts` exists.
- [ ] **Step 14: Commit**
```bash
git add packages/auth/ apps/api/src/db.ts apps/api/src/middleware/ apps/api/src/modules/auth/ apps/api/src/app.ts apps/api/tests/modules/auth/ apps/api/tests/middleware/
git commit -m "feat: google oauth, jwt auth, requireAuth/requireRole middleware"
```

---

### Task P10: Next.js bootstrap + base API client

**Files:**
- Create: `apps/web/next.config.ts`, `apps/web/tailwind.config.ts`, `apps/web/app/layout.tsx`, `apps/web/app/globals.css`
- Create: `apps/web/app/(auth)/login/page.tsx`
- Create: `apps/web/lib/api/client.ts`
- Create: `apps/web/tests/lib/api/client.test.ts`

**Interfaces:**
- Produces: `export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T>` — wraps `fetch` with `credentials: "include"`, base URL from `NEXT_PUBLIC_API_URL`, JSON parsing, and throws a typed `ApiClientError` (with `.code`/`.message` from the `{error:{code,message}}` body) on non-2xx. Every `lib/api/*.ts` module in Preksha's tasks (F2–F9) is built on this.

- [ ] **Step 1: Write the failing test**
```typescript
// apps/web/tests/lib/api/client.test.ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { apiFetch, ApiClientError } from "../../../lib/api/client";

afterEach(() => vi.restoreAllMocks());

describe("apiFetch", () => {
  it("throws ApiClientError with code/message on non-2xx", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({ error: { code: "FORBIDDEN", message: "nope" } }),
      })
    );
    await expect(apiFetch("/api/classes")).rejects.toMatchObject({ code: "FORBIDDEN", message: "nope" });
  });

  it("returns parsed JSON on success", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ a: 1 }) }));
    const result = await apiFetch<{ a: number }>("/api/classes");
    expect(result).toEqual({ a: 1 });
  });
});
```
- [ ] **Step 2:** Run `npm run test --workspace=apps/web -- client.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Write `apps/web/lib/api/client.ts`:
```typescript
export class ApiClientError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const body = await res.json();
  if (!res.ok) {
    throw new ApiClientError(body.error?.code ?? "INTERNAL_ERROR", body.error?.message ?? "Request failed");
  }
  return body as T;
}
```
- [ ] **Step 4:** Run test again. Expected: PASS.
- [ ] **Step 5:** Write `apps/web/app/layout.tsx` (root HTML shell, imports `globals.css`), `apps/web/app/globals.css` (Tailwind directives), `apps/web/tailwind.config.ts` (content globs over `app/**` and `components/**`).
- [ ] **Step 6:** Write `apps/web/app/(auth)/login/page.tsx` — a single "Sign in with Google" button linking to `${NEXT_PUBLIC_API_URL}/auth/oauth/google`.
- [ ] **Step 7:** Run `npm run dev --workspace=apps/web` and confirm `http://localhost:3000/login` renders the button (manual check, not automated).
- [ ] **Step 8: Commit**
```bash
git add apps/web/next.config.ts apps/web/tailwind.config.ts apps/web/app/ apps/web/lib/api/client.ts apps/web/tests/lib/api/client.test.ts
git commit -m "feat: next.js bootstrap, login page, base api client"
```

---

### Task P11: Root Dockerfile, docker-compose full stack, Nginx, Certbot docs

**Files:**
- Create: `Dockerfile` (root, multi-stage)
- Modify: `docker-compose.yml` (add `api`, `web`, `nginx` services)
- Create: `docker/nginx/default.conf`
- Modify: `README.md` (add Certbot/self-host section)

**Interfaces:**
- Consumes: working `apps/api` and `apps/web` builds (requires P1–P10 merged, and ideally V1–V9/F1–F12 landed so `npm run build` succeeds end to end — run this task's build-verification step last, after other tracks land, even though the Dockerfile itself can be written earlier).

- [ ] **Step 1:** Write root `Dockerfile` with three stages: `deps` (copies all `package.json`s + lockfile, `npm ci`), `build` (copies source, runs `npm run build --workspaces --if-present`), `runtime` (copies only `apps/api/dist`, `apps/web/.next`, `node_modules` from `deps`, and each workspace's `package.json`; runs as non-root user; `CMD` is overridden per-service via compose).
- [ ] **Step 2:** Extend `docker-compose.yml` with `api` (build: `.`, target `runtime`, command running `node apps/api/dist/server.js`, `depends_on: {postgres: {condition: service_healthy}, redis: {condition: service_healthy}}`, healthcheck hitting `/health`), `web` (build: `.`, command running `next start`, `depends_on: {api: {condition: service_healthy}}`), `nginx` (image `nginx:alpine`, mounts `docker/nginx/default.conf`, ports `80:80`/`443:443`, `depends_on: [web, api]`).
- [ ] **Step 3:** Write `docker/nginx/default.conf` — TLS termination stanza (commented placeholder for cert paths), `location /api/ { proxy_pass http://api:4000/; proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; proxy_set_header X-Forwarded-Proto $scheme; proxy_set_header Host $host; }`, `location / { proxy_pass http://web:3000/; ... same headers ... }`.
- [ ] **Step 4:** Add a `README.md` section "Self-Hosted Deployment" documenting the 6-step Certbot flow from spec §47 (DNS → open ports → start compose → issue cert → configure renewal → reload nginx), with the exact `certbot certonly --webroot` command and a `crontab` line for renewal.
- [ ] **Step 5 (run once other tracks have landed):** Run `docker compose up -d --build`. Expected: all 5 services (`postgres`, `redis`, `api`, `web`, `nginx`) report healthy; `curl http://localhost/api/health` returns `{"status":"ok"}`; `curl http://localhost/` returns the Next.js homepage HTML.
- [ ] **Step 6: Commit**
```bash
git add Dockerfile docker-compose.yml docker/nginx/default.conf README.md
git commit -m "feat: production docker stack, nginx reverse proxy, certbot docs"
```

---

### Task P12: GitHub Actions CI/CD (integration task — do last)

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: `test`, `coverage`, `lint`, `typecheck`, `build` scripts existing in every workspace (Vraj's V9 and Preksha's F10/F12 are what make `coverage` meaningful — this task should be the last one merged).

- [ ] **Step 1:** Write `.github/workflows/ci.yml` with a `test` job: checkout → setup-node (with npm cache) → `npm ci` → `npm run lint` → `npm run typecheck` → `docker compose up -d postgres redis` → wait-for-healthy loop → `npm run migrate --workspace=packages/db` → `npm run seed --workspace=packages/db` → `npm run coverage` (fails the job if any workspace drops below 100%) → `npm run build`.
- [ ] **Step 2:** Add a `docker` job (needs: `test`): checkout → `docker build .` to confirm the image builds.
- [ ] **Step 3:** Add a `playwright` job (needs: `docker`): `docker compose up -d --build` → `npx playwright install --with-deps` → `npm run test:e2e --workspace=e2e` (or root-level `e2e/` if not its own workspace) → upload `playwright-report/` as an artifact on failure.
- [ ] **Step 4:** Add a `publish` job (needs: `[test, docker, playwright]`, `if: github.ref == 'refs/heads/main'`): `docker/login-action` using `secrets.DOCKERHUB_USERNAME`/`secrets.DOCKERHUB_TOKEN`, `docker build` + `docker push` tagged with the git SHA and `latest`.
- [ ] **Step 5:** Push a throwaway branch and open a PR to confirm the `test`/`docker`/`playwright` jobs actually run and pass in GitHub Actions (not just locally).
- [ ] **Step 6: Commit**
```bash
git add .github/workflows/ci.yml
git commit -m "feat: github actions ci/cd pipeline"
```

---

## Track: Vraj — Backend Domain

*Every task below depends on Prateek's P1–P9 (schema, shared schemas/DTOs, `requireAuth`/`requireRole`, `db` singleton) being merged. Follow the exact TDD/file pattern demonstrated in full for Task V1 — repeat it for V2–V7 with the fields/routes specified.*

### Task V1: Users module — Admin CRUD + suspension

**Files:**
- Create: `apps/api/src/modules/users/users.repository.ts`
- Create: `apps/api/src/modules/users/users.service.ts`
- Create: `apps/api/src/modules/users/users.routes.ts`
- Modify: `apps/api/src/app.ts` (register users routes)
- Create: `apps/api/tests/modules/users/users.routes.test.ts`
- Create: `apps/api/tests/modules/users/users.service.test.ts`

**Interfaces:**
- Consumes: `requireAuth`, `requireRole` from `../../middleware/*`; `CreateUserSchema`, `UpdateUserSchema`, `ApiError` from `@school/shared`; `db` from `../../db.js`.
- Produces: `createUsersRepository(db)` → `{findAll, findById, create, update, suspend, unsuspend, delete: (id) => ...}`; routes `GET/POST /api/users`, `GET/PATCH/DELETE /api/users/:id`, `POST /api/users/:id/suspend`, `POST /api/users/:id/unsuspend` — all admin-only.

- [ ] **Step 1: Write the failing test**
```typescript
// apps/api/tests/modules/users/users.routes.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { buildApp } from "../../../src/app.js";
import { db } from "../../../src/db.js";
import { signJwt } from "@school/auth/jwt";
import { env } from "../../../src/config/env.js";
import { AUTH_COOKIE_NAME } from "@school/auth/cookies";

async function loginAs(role: "admin" | "teacher" | "student") {
  const user = await db.selectFrom("users").selectAll().where("role", "=", role).executeTakeFirstOrThrow();
  return { cookie: signJwt({ sub: user.id, role: user.role }, env.JWT_SECRET), user };
}

describe("POST /api/users", () => {
  it("403s for a non-admin", async () => {
    const app = await buildApp();
    const { cookie } = await loginAs("teacher");
    const res = await app.inject({
      method: "POST",
      url: "/api/users",
      cookies: { [AUTH_COOKIE_NAME]: cookie },
      payload: { email: "new@example.com", name: "New Person", role: "student" },
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it("201s for an admin and creates the user", async () => {
    const app = await buildApp();
    const { cookie } = await loginAs("admin");
    const res = await app.inject({
      method: "POST",
      url: "/api/users",
      cookies: { [AUTH_COOKIE_NAME]: cookie },
      payload: { email: "new-user@example.com", name: "New Person", role: "student" },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().email).toBe("new-user@example.com");
    await app.close();
  });
});
```
*(Run this against a seeded test database — Vraj's local/CI setup runs `npm run migrate` + `npm run seed` against a dedicated `school_portal_test` DB before `npm run test`.)*
- [ ] **Step 2:** Run `npm run test --workspace=apps/api -- users.routes.test.ts`. Expected: FAIL.
- [ ] **Step 3:** Write `apps/api/src/modules/users/users.repository.ts`:
```typescript
import type { Kysely } from "kysely";
import type { DB } from "@school/db/types";

export function createUsersRepository(db: Kysely<DB>) {
  return {
    findAll: () => db.selectFrom("users").selectAll().execute(),
    findById: (id: string) => db.selectFrom("users").selectAll().where("id", "=", id).executeTakeFirst(),
    create: (input: { email: string; name: string; role: string }) =>
      db.insertInto("users").values(input).returningAll().executeTakeFirstOrThrow(),
    update: (id: string, input: Partial<{ email: string; name: string; role: string }>) =>
      db.updateTable("users").set({ ...input, updated_at: new Date() }).where("id", "=", id).returningAll().executeTakeFirst(),
    setSuspended: (id: string, isSuspended: boolean) =>
      db.updateTable("users").set({ is_suspended: isSuspended, updated_at: new Date() }).where("id", "=", id).returningAll().executeTakeFirst(),
    delete: (id: string) => db.deleteFrom("users").where("id", "=", id).executeTakeFirst(),
  };
}
```
- [ ] **Step 4:** Write `apps/api/src/modules/users/users.service.ts` wrapping the repository with `ApiError("NOT_FOUND", ...)` checks (e.g. `update`/`suspend`/`delete` throw if `findById` returns nothing first) and `ApiError("CONFLICT", "Email already in use")` translation on unique-constraint violations (`error.code === "23505"` from `pg`) in `create`.
- [ ] **Step 5:** Write `apps/api/src/modules/users/users.routes.ts` as a Fastify plugin registering all 6 routes with `{ preHandler: [requireAuth, requireRole("admin")] }`, parsing bodies with `CreateUserSchema`/`UpdateUserSchema` via `schema.parse(request.body)`, returning `201` on create, `200` on read/update, `204` on delete/suspend/unsuspend.
- [ ] **Step 6:** Register in `apps/api/src/app.ts`: `await app.register(usersRoutes, { prefix: "/api" });`.
- [ ] **Step 7:** Run tests again. Expected: PASS.
- [ ] **Step 8:** Add remaining route test cases to `users.routes.test.ts`: 401 unauthenticated, 404 unknown id, 409 duplicate email, suspend then verify `is_suspended: true` via a follow-up GET, unsuspend reverses it. Write `users.service.test.ts` unit-testing the service's NOT_FOUND/CONFLICT branches directly against an in-memory fake of the repository (plain object with vi.fn() methods) — no DB needed for this file.
- [ ] **Step 9:** Run `npm run coverage --workspace=apps/api -- users` and confirm 100% on the three new files; add any missing branch cases.
- [ ] **Step 10: Commit**
```bash
git add apps/api/src/modules/users/ apps/api/src/app.ts apps/api/tests/modules/users/
git commit -m "feat: admin user management API"
```

---

### Task V2: Teacher Groups module

**Files:**
- Create: `apps/api/src/modules/teacher-groups/{teacher-groups.repository.ts,teacher-groups.service.ts,teacher-groups.routes.ts}`
- Modify: `apps/api/src/app.ts`
- Create: `apps/api/tests/modules/teacher-groups/*.test.ts`

**Interfaces:**
- Produces: `createTeacherGroupsRepository(db)` → `{findAll, findById, create, update, delete, addTeacher(groupId, teacherId), removeTeacher(groupId, teacherId)}`.
- Routes (all admin-only via `requireRole("admin")`, spec §16): `GET/POST /api/teacher-groups`, `GET/PATCH/DELETE /api/teacher-groups/:id`, `POST/DELETE /api/teacher-groups/:id/teachers/:teacherId`.

- [ ] **Step 1:** Following the exact TDD pattern from V1 Steps 1–2 (route test first, run to confirm failure), write `teacher-groups.routes.test.ts` covering: 403 non-admin on every route, 201 create, `POST .../teachers/:teacherId` adds a membership row and a follow-up `GET /api/teacher-groups/:id` reflects it (include the member in the response via a joined query), `DELETE .../teachers/:teacherId` removes it, 404 on unknown group/teacher id, `DELETE /api/teacher-groups/:id` cascades (verify membership rows are gone after — add `ON DELETE CASCADE` to migration 004 if not already present; if it isn't, that's a bug in P4 to fix as part of this task, not skip).
- [ ] **Step 2:** Implement `teacher-groups.repository.ts`, `.service.ts` (404 on missing group/teacher, 409 on duplicate membership insert), `.routes.ts` following V1's plugin/schema-validation pattern exactly, using `CreateTeacherGroupSchema`/`UpdateTeacherGroupSchema` from `@school/shared`.
- [ ] **Step 3:** Register in `app.ts`, run tests to green, run coverage, fill any gaps.
- [ ] **Step 4: Commit**
```bash
git add apps/api/src/modules/teacher-groups/ apps/api/src/app.ts apps/api/tests/modules/teacher-groups/
git commit -m "feat: teacher groups CRUD + membership API"
```

---

### Task V3: Classes module + ownership helper

**Files:**
- Create: `apps/api/src/modules/classes/{classes.repository.ts,classes.service.ts,classes.routes.ts}`
- Create: `apps/api/src/modules/classes/ownership.ts`
- Modify: `apps/api/src/app.ts`
- Create: `apps/api/tests/modules/classes/*.test.ts`

**Interfaces:**
- Produces: `requireTeacherOwnsClass(userId: string, classId: string): Promise<void>` (throws `ApiError("FORBIDDEN", ...)` if `classes.teacher_id !== userId`, `ApiError("NOT_FOUND", ...)` if the class doesn't exist) — exported from `ownership.ts` for reuse by V4/V5 (enrollment and assignments both check class ownership).
- Routes (spec §17): `GET /api/classes` (teacher: own classes via `WHERE teacher_id = request.user.id`; student: enrolled classes via join on `class_students`; admin: empty list unless a query param explicitly requests otherwise — per spec, don't grant broad admin access not in the assessment), `POST /api/classes` (teacher only, `teacher_id` forced to `request.user.id`, never trusted from body), `GET/PATCH/DELETE /api/classes/:id` (teacher mutations call `requireTeacherOwnsClass` first).

- [ ] **Step 1:** Write `classes.routes.test.ts` first: teacher A creates a class → teacher B's `PATCH`/`DELETE` on it → 403; teacher A's own `PATCH` → 200; student's `GET /api/classes` only returns classes they're enrolled in (seed two classes, enroll the test student in one); `POST /api/classes` ignores any `teacherId` in the body and always uses the authenticated user's id (assert by trying to pass a different teacher's id in the payload and checking the created row's `teacher_id` is still the caller's).
- [ ] **Step 2:** Run to confirm failure, then implement `ownership.ts`, `classes.repository.ts` (`findByTeacher`, `findByStudent` (join `class_students`), `findById`, `create`, `update`, `delete`), `.service.ts`, `.routes.ts` using `CreateClassSchema`/`UpdateClassSchema`.
- [ ] **Step 3:** Register, run to green, coverage, fill gaps.
- [ ] **Step 4: Commit**
```bash
git add apps/api/src/modules/classes/ apps/api/src/app.ts apps/api/tests/modules/classes/
git commit -m "feat: classes CRUD API with ownership enforcement"
```

---

### Task V4: Class enrollment module

**Files:**
- Create: `apps/api/src/modules/classes/enrollment.repository.ts`, `enrollment.routes.ts` (co-located under `modules/classes/` since it's the same resource family, per "files that change together live together")
- Add to `ownership.ts`: `requireStudentEnrolledInClass`
- Modify: `apps/api/src/app.ts`
- Create: `apps/api/tests/modules/classes/enrollment.routes.test.ts`

**Interfaces:**
- Consumes: `requireTeacherOwnsClass` from `./ownership.ts` (Task V3).
- Produces: `requireStudentEnrolledInClass(userId: string, classId: string): Promise<void>` — used later by V5 (assignments) and V6 (submissions).
- Routes (spec §18, teacher-only mutations): `GET /api/classes/:id/students`, `POST/DELETE /api/classes/:id/students/:studentId` — each verifying `request.user.role === "teacher" && class.teacher_id === request.user.id` via `requireTeacherOwnsClass`.

- [ ] **Step 1:** Write `enrollment.routes.test.ts`: non-owning teacher gets 403 on add/remove; owning teacher adds a student → `GET .../students` includes them; remove → they're gone; adding a student who's already enrolled → 409 (unique constraint on `class_students`).
- [ ] **Step 2:** Confirm failure, implement `enrollment.repository.ts` (`listStudents(classId)`, `addStudent(classId, studentId)`, `removeStudent(classId, studentId)`) and `enrollment.routes.ts` reusing `requireTeacherOwnsClass`, add `requireStudentEnrolledInClass` to `ownership.ts`.
- [ ] **Step 3:** Register, green, coverage.
- [ ] **Step 4: Commit**
```bash
git add apps/api/src/modules/classes/enrollment.repository.ts apps/api/src/modules/classes/enrollment.routes.ts apps/api/src/modules/classes/ownership.ts apps/api/src/app.ts apps/api/tests/modules/classes/enrollment.routes.test.ts
git commit -m "feat: class enrollment API"
```

---

### Task V5: Assignments module + publish lifecycle

**Files:**
- Create: `apps/api/src/modules/assignments/{assignments.repository.ts,assignments.service.ts,assignments.routes.ts}`
- Add to `apps/api/src/modules/classes/ownership.ts`: `requireTeacherOwnsAssignment`
- Modify: `apps/api/src/app.ts`
- Create: `apps/api/tests/modules/assignments/*.test.ts`

**Interfaces:**
- Consumes: `requireTeacherOwnsClass` (V3), `requireStudentEnrolledInClass` (V4).
- Produces: `requireTeacherOwnsAssignment(userId, assignmentId)` (resolves the assignment's class, delegates to `requireTeacherOwnsClass`) — used by V6/V7.
- Routes (spec §19): `GET/POST /api/classes/:classId/assignments`, `GET/PATCH/DELETE /api/assignments/:id`, `POST /api/assignments/:id/publish`. Students only ever see `published: true` rows on `GET`.

- [ ] **Step 1:** Write `assignments.routes.test.ts`: student sees only published assignments in their enrolled class (seed one draft + one published, assert list length 1 and content matches published one); student not enrolled gets 403/empty depending on route (list endpoint: 403; direct `GET /api/assignments/:id` on an unpublished one they're not enrolled in: 404, don't leak existence); teacher creates a draft (`published: false` by default — verify `POST` never accepts a `published` field from the body, only `/publish` can flip it); non-owning teacher's `PATCH`/`DELETE`/`publish` → 403.
- [ ] **Step 2:** Confirm failure, implement repository/service/routes using `CreateAssignmentSchema`/`UpdateAssignmentSchema` (both schemas deliberately have no `published` field — enforce that saving a draft is never equivalent to publishing per spec §19), a dedicated `publish(id)` repository method setting `published: true`.
- [ ] **Step 3:** Register, green, coverage.
- [ ] **Step 4: Commit**
```bash
git add apps/api/src/modules/assignments/ apps/api/src/modules/classes/ownership.ts apps/api/src/app.ts apps/api/tests/modules/assignments/
git commit -m "feat: assignments CRUD + publish lifecycle API"
```

---

### Task V6: Submissions module

**Files:**
- Create: `apps/api/src/modules/submissions/{submissions.repository.ts,submissions.service.ts,submissions.routes.ts}`
- Add to `ownership.ts`: `requireStudentOwnsSubmission`, `requireTeacherOwnsSubmission`
- Modify: `apps/api/src/app.ts`
- Create: `apps/api/tests/modules/submissions/*.test.ts`

**Interfaces:**
- Consumes: `requireStudentEnrolledInClass` (V4), `requireTeacherOwnsAssignment` (V5).
- Produces: `requireStudentOwnsSubmission(userId, submissionId)`, `requireTeacherOwnsSubmission(userId, submissionId)` (resolves submission → assignment → class → delegates to `requireTeacherOwnsClass`) — used by V7 (grades).
- Routes (spec §20): `GET/POST/PATCH /api/assignments/:id/submission` (student, own submission only — `student_id` always forced to `request.user.id`), `GET /api/assignments/:id/submissions` (teacher, must own the assignment's class).

- [ ] **Step 1:** Write `submissions.routes.test.ts`: unpublished assignment → `POST .../submission` 404/403 (assignment must be published — reject before enrollment check so students can't distinguish "not enrolled" from "not published" for classes they're not in); not-enrolled student → 403; enrolled student, published assignment → 201, second `POST` on same assignment → 409 (or route it through `PATCH` — implement `POST` as upsert-or-409 per spec's "one current submission" rule, `PATCH` as the explicit update path); `GET .../submissions` (teacher list) — non-owning teacher → 403, owning teacher → sees all students' submissions for that assignment.
- [ ] **Step 2:** Confirm failure, implement using `CreateSubmissionSchema`, unique constraint from migration 008 backing the 409.
- [ ] **Step 3:** Register, green, coverage.
- [ ] **Step 4: Commit**
```bash
git add apps/api/src/modules/submissions/ apps/api/src/modules/classes/ownership.ts apps/api/src/app.ts apps/api/tests/modules/submissions/
git commit -m "feat: student submissions API"
```

---

### Task V7: Grades module

**Files:**
- Create: `apps/api/src/modules/grades/{grades.repository.ts,grades.service.ts,grades.routes.ts}`
- Modify: `apps/api/src/app.ts`
- Create: `apps/api/tests/modules/grades/*.test.ts`

**Interfaces:**
- Consumes: `requireTeacherOwnsSubmission`, `requireStudentOwnsSubmission` (V6).
- Routes (spec §21): `POST/PATCH/GET /api/submissions/:id/grade` — teacher write requires owning the submission's class (via `requireTeacherOwnsSubmission`); student read requires owning the submission (via `requireStudentOwnsSubmission`).

- [ ] **Step 1:** Write `grades.routes.test.ts`: non-owning teacher `POST` → 403; owning teacher `POST` → 201 with `score`/`feedback`; score outside `[0,100]` → 400 (Zod validation, matching `GradeSubmissionSchema`); `PATCH` updates an existing grade (upsert semantics — one grade per submission per the unique constraint on migration 009); student reading their own submission's grade → 200; student reading another student's grade → 403.
- [ ] **Step 2:** Confirm failure, implement using `GradeSubmissionSchema`, `graded_by` forced to `request.user.id`, `graded_at` set server-side.
- [ ] **Step 3:** Register, green, coverage.
- [ ] **Step 4: Commit**
```bash
git add apps/api/src/modules/grades/ apps/api/src/app.ts apps/api/tests/modules/grades/
git commit -m "feat: grading API"
```

---

### Task V8: Statistics API + Redis caching

**Files:**
- Create: `apps/api/src/modules/stats/{stats.repository.ts,stats.service.ts,stats.routes.ts}`
- Modify: `apps/api/src/app.ts`
- Create: `apps/api/tests/modules/stats/*.test.ts`

**Interfaces:**
- Consumes: `app.redis` (P8); `AverageGradeResponse`, `ClassListResponse`, `ClassStudentsResponse` DTO types from `@school/shared`.
- Routes (spec §22, versioned `/api/v0/` prefix, all currently unauthenticated per the assessment brief's "external API" framing — no `requireAuth` preHandler, but every response must still be a DTO, never raw rows): `GET /api/v0/stats/average-grades`, `GET /api/v0/stats/average-grades/:id`, `GET /api/v0/stats/teacher-names`, `GET /api/v0/stats/student-names`, `GET /api/v0/stats/classes`, `GET /api/v0/stats/classes/:id`.

- [ ] **Step 1:** Write `stats.routes.test.ts`: `average-grades` with no grades in a fresh class → `{averageGrade: null}` (not `0` — assert `toBeNull()` explicitly, not falsy); with the seeded graded submission → returns the correct average; `classes` list returns `{id, name, teacherName}[]` shape, no other fields (assert `Object.keys` on an item matches exactly `["id","name","teacherName"]`); `classes/:id` on unknown id → 404; second call to the same endpoint within the TTL window returns from cache (spy on the repository method with `vi.spyOn`, assert it was called exactly once across two requests).
- [ ] **Step 2:** Confirm failure. Implement `stats.repository.ts` with raw aggregate queries (`avg(grades.score)` joined through submissions→assignments→classes, `count`/`null`-safe via Kysely's `.$if` or a plain `COALESCE` in SQL only where it clarifies null-vs-zero — the service layer, not SQL, is what returns `null`: `const row = await repo.avgForClass(id); return { averageGrade: row.avg === null ? null : Number(row.avg) };`).
- [ ] **Step 3:** Implement caching in `stats.service.ts`: `const cacheKey = `stats:classes:${id ?? "all"}`; const cached = await redis.get(cacheKey); if (cached) return JSON.parse(cached); const result = await repo...; await redis.set(cacheKey, JSON.stringify(result), "EX", 45);` (45s TTL, within the spec's 30–60s guidance) for each of the 6 endpoints, keyed per spec §28's naming (`stats:average-grades`, `stats:average-grades:{classId}`, `stats:teacher-names`, `stats:student-names`, `stats:classes`, `stats:classes:{classId}`).
- [ ] **Step 4:** Add cache invalidation: in `grades.service.ts` (V7) and `classes.service.ts` (V3), after a successful mutation, call a small exported `invalidateStatsCache(redis, keys: string[])` helper (define it in `stats.service.ts` and import it from V3/V7 — this is a legitimate cross-module dependency the spec's caching section calls for). Update V3/V7 accordingly as part of this task (they were left without invalidation when first written).
- [ ] **Step 5:** Register, green, coverage.
- [ ] **Step 6: Commit**
```bash
git add apps/api/src/modules/stats/ apps/api/src/modules/grades/grades.service.ts apps/api/src/modules/classes/classes.service.ts apps/api/src/app.ts apps/api/tests/modules/stats/
git commit -m "feat: statistics API with redis caching and invalidation"
```

---

### Task V9: Backend coverage sweep

**Files:**
- Modify: any `apps/api/src/**` or `packages/**/src/**` file with uncovered branches
- Modify: `apps/api/vitest.config.ts`, `packages/*/vitest.config.ts` (add coverage thresholds)

**Interfaces:**
- Consumes: nothing new — this task closes gaps across V1–V8's output.

- [ ] **Step 1:** In each backend `vitest.config.ts`, set:
```typescript
export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      thresholds: { statements: 100, branches: 100, functions: 100, lines: 100 },
    },
  },
});
```
- [ ] **Step 2:** Run `npm run coverage --workspace=apps/api` and `npm run coverage --workspace=packages/db` and `npm run coverage --workspace=packages/shared` and `npm run coverage --workspace=packages/auth`.
- [ ] **Step 3:** For every uncovered line/branch reported, add the missing test case (suspended-user branch, forbidden branch, not-found branch, validation-error branch, conflict branch — per spec §39's required branch list) to the relevant existing test file from V1–V8. No new files needed unless a whole module was missed.
- [ ] **Step 4:** Re-run coverage until all four metrics report 100% in every backend workspace.
- [ ] **Step 5: Commit**
```bash
git add apps/api/vitest.config.ts packages/*/vitest.config.ts apps/api/tests/ packages/*/tests/
git commit -m "test: close coverage gaps to 100% across backend workspaces"
```

---

## Track: Preksha — Frontend & E2E

*Depends on Prateek's P1, P6, P10 (workspace, shared DTOs, Next.js bootstrap + `apiFetch`) and, per-task, the specific Vraj task producing that resource's API.*

### Task F1: App shell + role-aware navigation + auth guard

**Files:**
- Create: `apps/web/components/shell/Sidebar.tsx`, `apps/web/components/shell/TopBar.tsx`, `apps/web/components/shell/AppShell.tsx`
- Create: `apps/web/lib/api/auth.ts`
- Create: `apps/web/app/dashboard/layout.tsx`, `apps/web/app/dashboard/page.tsx`
- Create: `apps/web/tests/components/shell/Sidebar.test.tsx`

**Interfaces:**
- Consumes: `apiFetch` (P10).
- Produces: `authApi.me(): Promise<{id,name,email,role}>`, `authApi.logout(): Promise<void>` in `lib/api/auth.ts`; `<AppShell role={...}>` component every dashboard page (F2–F9) wraps its content in.

- [ ] **Step 1: Write the failing test**
```tsx
// apps/web/tests/components/shell/Sidebar.test.tsx
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Sidebar } from "../../../components/shell/Sidebar";

describe("Sidebar", () => {
  it("shows admin nav items for admin role", () => {
    render(<Sidebar role="admin" />);
    expect(screen.getByRole("link", { name: /users/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /my classes/i })).not.toBeInTheDocument();
  });

  it("shows teacher nav items for teacher role", () => {
    render(<Sidebar role="teacher" />);
    expect(screen.getByRole("link", { name: /my classes/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^users$/i })).not.toBeInTheDocument();
  });
});
```
- [ ] **Step 2:** Run `npm run test --workspace=apps/web -- Sidebar.test.tsx`. Expected: FAIL.
- [ ] **Step 3:** Write `apps/web/components/shell/Sidebar.tsx` with a `NAV_BY_ROLE: Record<Role, {label: string; href: string}[]>` map matching spec §31 exactly (admin: Dashboard/Users/Teacher Groups/Statistics; teacher: Dashboard/My Classes/Assignments/Submissions/Statistics; student: Dashboard/My Classes/Assignments/Grades), rendering `<Link>` per entry.
- [ ] **Step 4:** Run test again. Expected: PASS.
- [ ] **Step 5:** Write `apps/web/lib/api/auth.ts` (`me`/`logout` wrapping `apiFetch`), `TopBar.tsx` (user name, role badge, logout button calling `authApi.logout()` then redirecting to `/login`), `AppShell.tsx` (composes `Sidebar` + `TopBar` + `children`).
- [ ] **Step 6:** Write `apps/web/app/dashboard/layout.tsx` as a server component calling `authApi.me()` (via a server-side fetch forwarding cookies) — redirect to `/login` on 401, render `<AppShell role={user.role}>{children}</AppShell>` otherwise.
- [ ] **Step 7:** Write a minimal `apps/web/app/dashboard/page.tsx` placeholder (empty state, filled in by F2–F9's own dashboard widgets if any — otherwise just a welcome message).
- [ ] **Step 8: Commit**
```bash
git add apps/web/components/shell/ apps/web/lib/api/auth.ts apps/web/app/dashboard/ apps/web/tests/components/shell/
git commit -m "feat: app shell, role-aware navigation, auth guard"
```

---

### Task F2: Admin — Users UI

**Files:**
- Create: `apps/web/lib/api/users.ts`
- Create: `apps/web/app/admin/users/page.tsx`, `apps/web/components/users/UserTable.tsx`, `apps/web/components/users/UserFormDialog.tsx`, `apps/web/components/users/SuspendDialog.tsx`
- Create: `apps/web/tests/components/users/UserTable.test.tsx`

**Interfaces:**
- Consumes: `apiFetch` (P10); depends on Vraj's **Task V1** for the `/api/users*` contract.
- Produces: `usersApi.{list,create,update,suspend,unsuspend,remove}` in `lib/api/users.ts`.

- [ ] **Step 1:** Write `UserTable.test.tsx` (RTL, `screen.getByRole("table")`, columns Name/Email/Role/Status/Created/Actions per spec §32, an Edit/Suspend/Unsuspend/Delete button per row using `getByRole("button", {name: /suspend/i})` scoped to the row).
- [ ] **Step 2:** Confirm failure, implement `lib/api/users.ts`, `UserTable.tsx` (loading/empty/error states per spec §36 — `if (isLoading) return <p>Loading users...</p>`, `if (users.length === 0) return <p>No users yet.</p>`, `if (error) return <p>Failed to load users. <button onClick={retry}>Retry</button></p>`), `UserFormDialog.tsx` (create/edit form, Zod-validated via `CreateUserSchema`/`UpdateUserSchema` reused from `@school/shared` on the client, field-level errors, disabled submit while pending), `SuspendDialog.tsx` (confirmation dialog per spec §32's "use confirmation UI for destructive operations" — also gate Delete behind the same confirmation pattern), `app/admin/users/page.tsx` wiring them together.
- [ ] **Step 3:** Run test to green.
- [ ] **Step 4: Commit**
```bash
git add apps/web/lib/api/users.ts apps/web/app/admin/users/ apps/web/components/users/ apps/web/tests/components/users/
git commit -m "feat: admin user management UI"
```

---

### Task F3: Admin — Teacher Groups UI

**Files:**
- Create: `apps/web/lib/api/teacher-groups.ts`
- Create: `apps/web/app/admin/teacher-groups/page.tsx`, `apps/web/app/admin/teacher-groups/[id]/page.tsx`, `apps/web/components/teacher-groups/GroupList.tsx`, `apps/web/components/teacher-groups/GroupFormDialog.tsx`, `apps/web/components/teacher-groups/MembershipManager.tsx`

**Interfaces:**
- Depends on Vraj's **Task V2**.

- [ ] **Step 1:** List page: group list, create dialog (name only, `CreateTeacherGroupSchema`), each row links to detail.
- [ ] **Step 2:** Detail page: group info, edit, delete (confirmation dialog), `MembershipManager` (add/remove teacher — a searchable select populated from `usersApi.list({role: "teacher"})` from Task F2, plus a remove button per current member).
- [ ] **Step 3:** All list/detail views implement loading/empty/error states matching F2's pattern.
- [ ] **Step 4:** Manual check: `npm run dev`, walk through create → add 2 teachers → remove 1 → delete group.
- [ ] **Step 5: Commit**
```bash
git add apps/web/lib/api/teacher-groups.ts apps/web/app/admin/teacher-groups/ apps/web/components/teacher-groups/
git commit -m "feat: admin teacher groups UI"
```

---

### Task F4: Teacher — Classes UI

**Files:**
- Create: `apps/web/lib/api/classes.ts`
- Create: `apps/web/app/teacher/classes/page.tsx`, `apps/web/app/teacher/classes/[id]/page.tsx`, `apps/web/components/classes/ClassCard.tsx`, `apps/web/components/classes/ClassFormDialog.tsx`, `apps/web/components/classes/StudentRoster.tsx`
- Create: `apps/web/tests/components/classes/ClassFormDialog.test.tsx`

**Interfaces:**
- Depends on Vraj's **Task V3** (classes) and **Task V4** (enrollment).

- [ ] **Step 1:** Write `ClassFormDialog.test.tsx` (RTL: submit with empty name shows a field error and does not call the create handler; valid submit calls it with the trimmed payload).
- [ ] **Step 2:** Confirm failure, implement `lib/api/classes.ts` (`list`, `create`, `update`, `remove`, `listStudents`, `addStudent`, `removeStudent`), list page (`ClassCard` per class: name/description/student count/assignment count/actions per spec §33), detail page (class info, `StudentRoster` — name/email/remove per row, "Add student" search-select, assignments list stub linking to F5).
- [ ] **Step 3:** Run to green.
- [ ] **Step 4: Commit**
```bash
git add apps/web/lib/api/classes.ts apps/web/app/teacher/classes/ apps/web/components/classes/ apps/web/tests/components/classes/
git commit -m "feat: teacher classes UI"
```

---

### Task F5: Teacher — Assignments UI

**Files:**
- Create: `apps/web/lib/api/assignments.ts`
- Create: `apps/web/app/teacher/classes/[id]/assignments/[assignmentId]/page.tsx`, `apps/web/components/assignments/AssignmentFormDialog.tsx`, `apps/web/components/assignments/AssignmentList.tsx`
- Create: `apps/web/tests/components/assignments/AssignmentFormDialog.test.tsx`

**Interfaces:**
- Depends on Vraj's **Task V5**.

- [ ] **Step 1:** Write `AssignmentFormDialog.test.tsx` (RTL: "Save draft" button calls `create`/`update` without touching publish state; "Publish" button is a visibly distinct, separate action — assert two different buttons exist via `getByRole("button", {name: /save draft/i})` and `getByRole("button", {name: /publish/i})`, matching spec §33/§19's "saving and publishing are distinct operations").
- [ ] **Step 2:** Confirm failure, implement `lib/api/assignments.ts` (`list`, `create`, `update`, `remove`, `publish`), `AssignmentFormDialog.tsx` (Title/Description/Due date fields, `CreateAssignmentSchema`, Save draft calls `create`/`update`, Publish calls `create`/`update` then `publish` as a second explicit call — never bundled into one request), `AssignmentList.tsx` (title/status badge/due date/actions per spec §33).
- [ ] **Step 3:** Run to green.
- [ ] **Step 4: Commit**
```bash
git add apps/web/lib/api/assignments.ts apps/web/app/teacher/classes/[id]/assignments/ apps/web/components/assignments/ apps/web/tests/components/assignments/
git commit -m "feat: teacher assignment CRUD + publish UI"
```

---

### Task F6: Teacher — Grading UI

**Files:**
- Create: `apps/web/lib/api/submissions.ts`, `apps/web/lib/api/grades.ts`
- Create: `apps/web/app/teacher/assignments/[id]/submissions/page.tsx`, `apps/web/components/grading/SubmissionList.tsx`, `apps/web/components/grading/GradeForm.tsx`
- Create: `apps/web/tests/components/grading/GradeForm.test.tsx`

**Interfaces:**
- Depends on Vraj's **Task V6** (submissions) and **Task V7** (grades).

- [ ] **Step 1:** Write `GradeForm.test.tsx` (RTL: score input rejects non-numeric/out-of-range via field error before submit — mirrors `GradeSubmissionSchema`'s `min(0).max(100)`; "Save Grade" disabled while a request is pending).
- [ ] **Step 2:** Confirm failure, implement `lib/api/submissions.ts` (`listForAssignment`, `getMine`, `create`, `update`), `lib/api/grades.ts` (`get`, `create`, `update`), page listing each student's submission content with a `GradeForm` (Score input, Feedback textarea, Save Grade button) per spec §34 — teacher only ever sees submissions for assignments they own (route guarded server-side already by V6/V7; client just calls the API and surfaces the 403 as an error state if it somehow gets one).
- [ ] **Step 3:** Run to green.
- [ ] **Step 4: Commit**
```bash
git add apps/web/lib/api/submissions.ts apps/web/lib/api/grades.ts apps/web/app/teacher/assignments/ apps/web/components/grading/ apps/web/tests/components/grading/
git commit -m "feat: teacher grading UI"
```

---

### Task F7: Student — Classes/Assignments/Submission UI

**Files:**
- Create: `apps/web/app/student/classes/page.tsx`, `apps/web/app/student/classes/[id]/page.tsx`, `apps/web/app/student/assignments/[id]/page.tsx`
- Create: `apps/web/components/student/AssignmentDetail.tsx`, `apps/web/components/student/SubmissionForm.tsx`
- Create: `apps/web/tests/components/student/SubmissionForm.test.tsx`

**Interfaces:**
- Reuses `classesApi` (F4), `assignmentsApi` (F5), `submissionsApi` (F6). Depends on Vraj's **Task V4** and **V6**.

- [ ] **Step 1:** Write `SubmissionForm.test.tsx` (RTL: empty content shows a field error, matching `CreateSubmissionSchema`'s `min(1)`; successful submit shows a success confirmation and disables further edits to that field — or switches to an "update" mode, per how V6 implemented `PATCH`).
- [ ] **Step 2:** Confirm failure, implement: classes list page (enrolled classes only, calls `classesApi.list()` which already scopes by role server-side), class detail (published assignments only — again server-scoped), `AssignmentDetail.tsx` (Title/Description/Due date per spec §35), `SubmissionForm.tsx` (textarea + Submit Assignment button).
- [ ] **Step 3:** Run to green.
- [ ] **Step 4: Commit**
```bash
git add apps/web/app/student/ apps/web/components/student/AssignmentDetail.tsx apps/web/components/student/SubmissionForm.tsx apps/web/tests/components/student/
git commit -m "feat: student classes/assignments/submission UI"
```

---

### Task F8: Student — Grades UI

**Files:**
- Create: `apps/web/app/student/grades/page.tsx`
- Create: `apps/web/components/student/GradeCard.tsx`
- Modify: `apps/web/app/student/assignments/[id]/page.tsx` (show grade + feedback after grading, per spec §35)

**Interfaces:**
- Depends on Vraj's **Task V7**.

- [ ] **Step 1:** Implement `grades.ts` client already exists from F6 — reuse `gradesApi.get`. Build `GradeCard.tsx` (Score X/100, Teacher Feedback block).
- [ ] **Step 2:** `app/student/grades/page.tsx` lists all of the student's graded submissions across classes (a small aggregate query — add `gradesApi.listMine()` to `lib/api/grades.ts` if the backend doesn't already expose it; if it doesn't, that's a gap to flag to Vraj rather than build a workaround, since server-side scoping is the security boundary — add the missing `GET /api/grades/mine` route as a one-line addition to V7's routes file with the same TDD pattern, then consume it here).
- [ ] **Step 3:** Update the assignment detail page (F7) to show `GradeCard` when a grade exists, the submission form otherwise.
- [ ] **Step 4:** Manual check via `npm run dev`, seeded student login, confirm grade+feedback renders for the seeded graded submission.
- [ ] **Step 5: Commit**
```bash
git add apps/web/app/student/grades/ apps/web/components/student/GradeCard.tsx apps/web/app/student/assignments/[id]/page.tsx apps/web/lib/api/grades.ts
git commit -m "feat: student grades UI"
```

---

### Task F9: Statistics UI

**Files:**
- Create: `apps/web/lib/api/stats.ts`
- Create: `apps/web/app/dashboard/statistics/page.tsx`
- Create: `apps/web/components/stats/StatsSummary.tsx`

**Interfaces:**
- Depends on Vraj's **Task V8**.

- [ ] **Step 1:** Implement `lib/api/stats.ts` (`averageGrades()`, `averageGradesForClass(id)`, `teacherNames()`, `studentNames()`, `classes()`, `classStudents(id)`), rendering a simple summary (overall average, per-class breakdown table, teacher/student counts) reachable from every role's nav per spec §31 ("Statistics" appears for admin and teacher; student nav omits it — only render the nav link for admin/teacher in `Sidebar.tsx` from F1, but leave the route itself accessible since the stats API is unauthenticated per V8).
- [ ] **Step 2:** Handle `averageGrade: null` explicitly in the UI (render "No grades yet" instead of "0" or blank — this is the one place a client bug could silently misrepresent the null/zero distinction the backend went out of its way to preserve).
- [ ] **Step 3:** Manual check via `npm run dev`.
- [ ] **Step 4: Commit**
```bash
git add apps/web/lib/api/stats.ts apps/web/app/dashboard/statistics/ apps/web/components/stats/
git commit -m "feat: statistics UI"
```

---

### Task F10: Component test sweep

**Files:**
- Create/modify: `apps/web/tests/components/**` for any of the 8 components spec §41 calls out that aren't yet covered by F1–F9's own test steps (login/auth state, user table, class form, assignment form, submission form, grade form, suspend/unsuspend dialog, role-based navigation)
- Modify: `apps/web/vitest.config.ts` (coverage thresholds, same shape as V9's backend config)

**Interfaces:**
- Consumes: nothing new — closes gaps across F1–F9.

- [ ] **Step 1:** Cross-check spec §41's list against what F1–F9 already wrote tests for. `Sidebar` (F1, role nav) ✓, `UserFormDialog`/`UserTable`/`SuspendDialog` (F2) ✓, `ClassFormDialog` (F4) ✓, `AssignmentFormDialog` (F5) ✓, `GradeForm` (F6) ✓, `SubmissionForm` (F7) ✓. Confirm "login/auth state" has a test — if `dashboard/layout.tsx`'s redirect-on-401 behavior wasn't tested in F1, add `apps/web/tests/app/dashboard/layout.test.tsx` for it now.
- [ ] **Step 2:** Set coverage thresholds in `apps/web/vitest.config.ts` to 100 (same shape as V9).
- [ ] **Step 3:** Run `npm run coverage --workspace=apps/web`, add test cases for every uncovered branch (empty state, error state, loading state per component — these are the most commonly missed branches per spec §36).
- [ ] **Step 4:** Re-run until 100% across all four metrics.
- [ ] **Step 5: Commit**
```bash
git add apps/web/tests/ apps/web/vitest.config.ts
git commit -m "test: close component test coverage gaps to 100%"
```

---

### Task F11: Playwright E2E — golden path

**Files:**
- Create: `e2e/playwright.config.ts`
- Create: `e2e/fixtures/reset-db.ts`
- Create: `e2e/golden-path.spec.ts`

**Interfaces:**
- Consumes: the full docker-compose stack (P11) must be running (`docker compose up -d`).
- Produces: `resetAndSeed(): Promise<void>` in `e2e/fixtures/reset-db.ts` — calls `packages/db`'s migrate+seed against the compose Postgres, run in Playwright's `globalSetup`/`beforeEach` so every test starts from the same deterministic state (never manually-prepared dev data, per spec §42).

- [ ] **Step 1:** Write `e2e/playwright.config.ts` (`baseURL: "http://localhost"`, `globalSetup: "./fixtures/reset-db.ts"`, one project per browser or just Chromium for the assessment's scope).
- [ ] **Step 2:** Write `e2e/fixtures/reset-db.ts` shelling out to `packages/db`'s migrate+seed scripts (or importing `migrateToLatest`/seed functions directly) against `DATABASE_URL` pointed at the compose Postgres.
- [ ] **Step 3:** Write `e2e/golden-path.spec.ts` implementing spec §42's 18-step flow: login as admin (via the seeded `admin@example.com` — for E2E, add a test-only backdoor login route gated behind `NODE_ENV !== "production"` in `auth.routes.ts`, since driving real Google OAuth in CI isn't practical; flag this as a coordinated change with Prateek's P9 rather than adding it unilaterally) → create teacher → login as teacher → create Biology 101 → add student → create assignment → publish → login as student → open class → open assignment → submit → login as teacher → open submissions → grade → add feedback → login as student → verify grade+feedback → verify stats page reflects the new average.
- [ ] **Step 4:** Run `npx playwright test golden-path.spec.ts` against the running compose stack. Expected: all steps pass.
- [ ] **Step 5: Commit**
```bash
git add e2e/playwright.config.ts e2e/fixtures/reset-db.ts e2e/golden-path.spec.ts
git commit -m "test: playwright e2e golden path"
```

---

### Task F12: Playwright E2E — negative auth paths

**Files:**
- Create: `e2e/negative-paths.spec.ts`

**Interfaces:**
- Consumes: `resetAndSeed` (F11).

- [ ] **Step 1:** Write `e2e/negative-paths.spec.ts` covering spec §42's negative list: suspended student cannot submit (seed a suspended student, attempt submission, assert a visible error state, not a silent failure); suspended teacher cannot grade; student navigating directly to `/admin/users` is redirected/blocked; teacher navigating to `/admin/users` is redirected/blocked; teacher A cannot modify teacher B's class (attempt via direct URL to the edit form, assert error); student cannot view another student's grade via direct URL manipulation.
- [ ] **Step 2:** Run `npx playwright test negative-paths.spec.ts`. Expected: all pass.
- [ ] **Step 3: Commit**
```bash
git add e2e/negative-paths.spec.ts
git commit -m "test: playwright e2e negative authorization paths"
```

---

## Final Integration Checklist (all three, before submission)

Once P1–P12, V1–V9, F1–F12 are all merged to `main`:

- [ ] Run `npm run coverage` from root — confirm 100% across every workspace.
- [ ] Run `docker compose up -d --build` — confirm all 5 services healthy.
- [ ] Manually walk the full demo flow from spec §55 against the running compose stack.
- [ ] Confirm `.github/workflows/ci.yml` is green on the actual PR that merges this work.
- [ ] Walk spec §58's Final Review Checklist line by line.
