# Concentrate School Portal — Task Split

Work split for the team: one full vertical per person — backend route, service, web pages, and tests — so branches barely touch the same files.

- **Team**: Preksha, Vraj, Prateek
- **Verticals**: Admin, Teacher, Student
- **Merge target**: `main`

## Stack

Next.js 15, React 19, Tailwind + Radix · Fastify · Kysely + Postgres 17 · Redis · Vitest / Supertest / Playwright · Docker + GitHub Actions

## 0. App flow

### Auth & entry (shared)

1. **Login** — email+password or Google
2. **Cookie** — JWT, httpOnly
3. **Redirect by role** — `/admin`, `/teacher`, `/student`
4. **Guarded** — every route checked; suspended users blocked

### Admin — account/org management only, no classes or assignments

```
/admin/users
  list (filter by role) → create (assign role) → edit → delete
  suspend/unsuspend toggle (students & teachers)

/admin/groups
  list → create → edit (rename, assign/remove teachers) → delete
```

No public signup — this is how teachers and students get into the system at all. Has to work first.

### Teacher

```
/teacher/classes/:id
  Roster      → add / remove students
  Assignments → create (title, description, due date)
    /teacher/assignments/:id
      submissions → grade + feedback
```

Natural order: create class → roster → publish assignment → grade submissions.

### Student

```
/student/classes/:id
  assignment status: Not submitted → Submitted → Graded
  submit (text or link) if open
  graded → shows grade + teacher feedback
```

Optional extra: a flat `/student/submissions` view across all classes.

### Chatbot (extra credit)

Floating widget on every authenticated page, scoped to that user's own data — a student asks "what's my grade in Bio", a teacher asks "who hasn't submitted yet."

### Dependency chain — this is your E2E test *and* your demo-video script

1. Admin creates teacher + student accounts
2. Teacher creates class, adds student to roster
3. Teacher publishes assignment
4. Student sees it, submits
5. Teacher grades + gives feedback
6. Student sees grade + feedback

## 1. Foundation — owner: Prateek

Lands on `main` first — everyone else branches once this merges. Every vertical depends on it.

**API core**
- `db/schema.ts` — every table (users, teacher_groups, classes, class_students, assignments, submissions)
- `db/migrations/001_init.ts`
- `db/index.ts` — pg pool + Kysely instance
- `auth/password.ts`, `jwt.ts`, `middleware.ts`, `google.ts`
- `routes/auth.ts` — login, logout, OAuth
- `server.ts`, `seed.ts`

**Web + infra**
- `middleware.ts` — redirect unauthenticated users
- `app/page.tsx` — login screen
- `lib/api.ts` — shared fetch wrapper
- `docker-compose.yml` — Postgres + Redis (given)

## 2. Parallel lanes

### Teacher — Preksha (you)

Branch: `feat/teacher`

**Backend**
- `services/teacher.service.ts` — class CRUD, roster add/remove, assignment CRUD, grade + feedback
- `routes/teacher.ts` — behind `requireRole('teacher')`

**Frontend**
- `app/teacher/page.tsx` — class list + create
- `app/teacher/classes/[id]/page.tsx` — roster + assignments
- `app/teacher/assignments/[id]/page.tsx` — submissions + grading

**Also owns**
- Root `Dockerfile` — multi-stage, api + web
- `docker-compose.prod.yml`
- `DEPLOY.md`

### Admin — Vraj

Branch: `feat/admin`

**Backend**
- `services/admin.service.ts` — teacher-group CRUD, user CRUD, suspend/unsuspend
- `routes/admin.ts` — behind `requireRole('admin')`
- `services/stats.service.ts` — avg grade (overall + per class), teacher/student names, class list, roster
- `routes/stats.ts` — 6 endpoints, `requireAuth`

**Frontend**
- `app/admin/page.tsx` — user table (create/edit/delete/suspend) + teacher-group management

**Also owns**
- `.github/workflows/ci.yml` — test → build → docker push
- `playwright.config.ts` base setup

### Student — Prateek

Branch: `feat/student`

**Backend**
- `services/student.service.ts` — list classes, list assignments per class, submit, list submissions
- `routes/student.ts` — behind `requireRole('student')`
- `services/chat.service.ts` — chatbot, Groq via raw fetch, app-level context
- `routes/chat.ts` — `POST /chat`

**Frontend**
- `app/student/page.tsx` — enrolled classes
- `app/student/classes/[id]/page.tsx` — assignments, submit, grade/feedback
- `components/chat-widget.tsx` — floating widget, mounted in root layout

**Also owns**: Foundation (see above), extra-credit chatbot polish

> Every service/route/page file above gets a co-located `*.test.ts` — that's each lane's own responsibility, not a separate task.

## 3. Testing

Enforced across every layer at 100% coverage — CI fails the build below that line, not just reports it.

**Frameworks**: Vitest, @testing-library/react, Supertest, Playwright

| Layer | Scope |
|---|---|
| Unit | Every service method — one `.test.ts` co-located per `services/*.service.ts`, owned by each lane |
| Integration | Every API endpoint — Supertest against `routes/*.ts`, owned by each lane |
| Component | Key UI features — shared primitives, login page, layout auth guards |
| E2E | Full app-flow — `e2e/full-flow.spec.ts`, cross-cutting |

## 4. Sequencing

1. **Foundation → main** — Prateek: schema, auth, seed
2. **Branch** — `feat/admin`, `feat/teacher`, `feat/student`
3. **Build in parallel** — no shared files touched
4. **Merge to main** — any order; last one rebases
5. **`e2e/full-flow.spec.ts`** — whoever finishes first
