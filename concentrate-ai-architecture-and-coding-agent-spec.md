# Concentrate.ai Hiring Quiz — Architecture & Coding Agent Implementation Specification

## 1. Purpose

This document is the implementation blueprint for the Concentrate.ai hiring assessment: a Canvas-style school portal supporting Admin, Teacher, and Student workflows, a versioned school statistics API, secure authentication, automated testing, Dockerized deployment, and CI/CD.

The goal is to produce a small, production-quality application that demonstrates:

- sound architecture and separation of concerns
- strong server-side authentication and authorization
- clear API contracts
- reliable database modeling
- meaningful automated tests
- 100% coverage enforcement
- reproducible Docker deployment
- a polished end-to-end user experience
- disciplined dependency usage

The implementation should favor simplicity over unnecessary abstraction. Do not introduce microservices, GraphQL, event buses, CQRS, or other heavyweight infrastructure unless the existing repository clearly requires them.

---

## 2. Hard Constraints

### Technology

- Frontend: Next.js 15, React 19, TailwindCSS, Radix/shadcn UI
- Backend: Node.js, Fastify, TypeScript, Zod
- Database: PostgreSQL 17 with Kysely ORM
- Caching: Redis
- Testing: Vitest, React Testing Library, Supertest, Playwright
- CI/CD: GitHub Actions
- Containerization: Docker and Docker Compose
- Reverse proxy: Nginx
- TLS: Certbot / Let's Encrypt

### Dependency rule

Use the dependencies already present in `package.json` and do not add arbitrary npm packages.

Before adding any package:

1. Inspect `package.json`.
2. Determine whether the existing stack can solve the problem.
3. Prefer built-in/platform APIs and existing libraries.
4. Only add Radix/shadcn components when needed and explicitly allowed.

### Security rule

All protected operations must be authorized server-side. Frontend role checks are UX only and must never be treated as the security boundary.

### Testing rule

CI must fail when coverage is below:

- 100% statements
- 100% branches
- 100% functions
- 100% lines

Do not lower coverage thresholds to make tests pass.

---

# 3. Architecture Overview

## 3.1 Recommended high-level architecture

```text
                           ┌─────────────────────┐
                           │      Browser        │
                           │ Next.js / React     │
                           └──────────┬──────────┘
                                      │
                                      │ HTTPS
                                      ▼
                           ┌─────────────────────┐
                           │       Nginx         │
                           │ TLS / Reverse Proxy │
                           └──────┬───────┬──────┘
                                  │       │
                           web    │       │ /api
                                  ▼       ▼
                       ┌────────────┐  ┌──────────────┐
                       │  Next.js   │  │   Fastify    │
                       │ Frontend   │  │     API      │
                       └────────────┘  └───────┬──────┘
                                              │
                         ┌────────────────────┼──────────────────┐
                         │                    │                  │
                         ▼                    ▼                  ▼
                  ┌─────────────┐     ┌─────────────┐    ┌─────────────┐
                  │ Auth / RBAC │     │  Services   │    │ Statistics  │
                  │ JWT / OAuth │     │  Domain     │    │   Module    │
                  └─────────────┘     └──────┬──────┘    └──────┬──────┘
                                             │                  │
                                             └────────┬─────────┘
                                                      ▼
                                               ┌─────────────┐
                                               │   Kysely    │
                                               └──────┬──────┘
                                                      │
                              ┌───────────────────────┼────────────────────┐
                              ▼                       ▼                    ▼
                       ┌─────────────┐        ┌─────────────┐      ┌─────────────┐
                       │ PostgreSQL  │        │    Redis    │      │ OAuth       │
                       │    17       │        │    Cache    │      │ Provider    │
                       └─────────────┘        └─────────────┘      └─────────────┘
```

## 3.2 Monolith vs microservices

Do **not** implement separate Admin, Teacher, and Student backend services.

Use one Fastify application with modular domain boundaries:

```text
modules/
  auth/
  users/
  teacher-groups/
  classes/
  assignments/
  submissions/
  grades/
  stats/
```

This is easier to test, deploy, secure, and explain during the interview.

---

# 4. Repository Structure

Use the existing project structure where practical. If creating the structure from scratch, prefer:

```text
/
├── apps/
│   ├── web/
│   │   ├── app/
│   │   │   ├── (auth)/
│   │   │   │   ├── login/
│   │   │   │   └── oauth/
│   │   │   ├── admin/
│   │   │   │   ├── users/
│   │   │   │   └── teacher-groups/
│   │   │   ├── teacher/
│   │   │   │   ├── classes/
│   │   │   │   ├── assignments/
│   │   │   │   └── submissions/
│   │   │   ├── student/
│   │   │   │   ├── classes/
│   │   │   │   ├── assignments/
│   │   │   │   └── grades/
│   │   │   └── dashboard/
│   │   ├── components/
│   │   ├── features/
│   │   ├── lib/
│   │   └── tests/
│   │
│   └── api/
│       ├── src/
│       │   ├── app/
│       │   ├── config/
│       │   ├── plugins/
│       │   ├── middleware/
│       │   ├── modules/
│       │   │   ├── auth/
│       │   │   ├── users/
│       │   │   ├── teacher-groups/
│       │   │   ├── classes/
│       │   │   ├── assignments/
│       │   │   ├── submissions/
│       │   │   ├── grades/
│       │   │   └── stats/
│       │   ├── db/
│       │   └── server.ts
│       └── tests/
│
├── packages/
│   ├── db/
│   │   ├── migrations/
│   │   ├── seeds/
│   │   └── src/
│   ├── shared/
│   │   ├── schemas/
│   │   ├── types/
│   │   └── constants/
│   ├── auth/
│   └── ui/
│
├── e2e/
│   ├── auth/
│   ├── admin/
│   ├── teacher/
│   └── student/
│
├── docker/
│   ├── nginx/
│   └── certbot/
│
├── .github/
│   └── workflows/
│       └── ci.yml
│
├── Dockerfile
├── docker-compose.yml
├── package.json
└── README.md
```

If the starter repository is less modular, preserve the architecture logically without introducing directory complexity for its own sake.

---

# 5. Backend Layering

Every protected API feature should follow this flow:

```text
Route
  ↓
Input Validation
  ↓
Authentication
  ↓
Authorization
  ↓
Controller / Handler
  ↓
Service
  ↓
Repository
  ↓
Kysely
  ↓
PostgreSQL
```

Example:

```text
POST /api/classes
        ↓
CreateClassSchema
        ↓
requireAuth()
        ↓
requireRole("teacher")
        ↓
classController.create()
        ↓
classService.createClass()
        ↓
classRepository.insert()
        ↓
Kysely
        ↓
PostgreSQL
```

Business logic must live in services, not directly inside route handlers.

---

# 6. Domain Model

Core entities:

- User
- OAuthAccount
- TeacherGroup
- TeacherGroupMember
- Class
- ClassStudent
- Assignment
- Submission
- Grade

---

## 6.1 Users

```text
users
-----
id UUID PRIMARY KEY
email VARCHAR UNIQUE NOT NULL
name VARCHAR NOT NULL
role ENUM(admin, teacher, student) NOT NULL
is_suspended BOOLEAN NOT NULL DEFAULT false
created_at TIMESTAMP NOT NULL
updated_at TIMESTAMP NOT NULL
```

Rules:

- A user has exactly one role.
- Suspended status is checked server-side.
- Email is unique.
- Authentication must not rely solely on role data encoded in a JWT.

---

## 6.2 OAuth accounts

```text
oauth_accounts
--------------
id UUID PRIMARY KEY
user_id UUID NOT NULL REFERENCES users(id)
provider VARCHAR NOT NULL
provider_account_id VARCHAR NOT NULL
created_at TIMESTAMP NOT NULL

UNIQUE(provider, provider_account_id)
```

Implement at least one provider. Prefer the provider for which the existing repository/dependencies make implementation simplest.

---

## 6.3 Teacher groups

```text
teacher_groups
--------------
id UUID PRIMARY KEY
name VARCHAR NOT NULL
created_at TIMESTAMP NOT NULL
updated_at TIMESTAMP NOT NULL
```

```text
teacher_group_members
---------------------
teacher_group_id UUID REFERENCES teacher_groups(id)
teacher_id UUID REFERENCES users(id)
PRIMARY KEY (teacher_group_id, teacher_id)
```

Admin can:

- create
- read
- update
- delete groups
- add teachers
- remove teachers

---

## 6.4 Classes

```text
classes
-------
id UUID PRIMARY KEY
name VARCHAR NOT NULL
description TEXT
teacher_id UUID NOT NULL REFERENCES users(id)
created_at TIMESTAMP NOT NULL
updated_at TIMESTAMP NOT NULL
```

A class has exactly one owner/teacher.

Ownership rule:

```text
class.teacher_id === currentUser.id
```

must be checked server-side for teacher mutations.

---

## 6.5 Class enrollment

```text
class_students
--------------
class_id UUID REFERENCES classes(id)
student_id UUID REFERENCES users(id)
created_at TIMESTAMP NOT NULL

PRIMARY KEY (class_id, student_id)
```

Relationships:

```text
Class   → many Students
Student → many Classes
```

---

## 6.6 Assignments

```text
assignments
-----------
id UUID PRIMARY KEY
class_id UUID NOT NULL REFERENCES classes(id)
title VARCHAR NOT NULL
description TEXT
published BOOLEAN NOT NULL DEFAULT false
due_at TIMESTAMP NULL
created_at TIMESTAMP NOT NULL
updated_at TIMESTAMP NOT NULL
```

Lifecycle:

```text
draft → published → students can view/submit
```

Students must not see unpublished assignments.

---

## 6.7 Submissions

```text
submissions
-----------
id UUID PRIMARY KEY
assignment_id UUID NOT NULL REFERENCES assignments(id)
student_id UUID NOT NULL REFERENCES users(id)
content TEXT NOT NULL
submitted_at TIMESTAMP NOT NULL
updated_at TIMESTAMP NOT NULL

UNIQUE(assignment_id, student_id)
```

Use one current submission per student per assignment. Multiple attempts are out of scope unless the starter repository already supports them.

---

## 6.8 Grades

```text
grades
------
id UUID PRIMARY KEY
submission_id UUID UNIQUE NOT NULL REFERENCES submissions(id)
score NUMERIC NOT NULL
feedback TEXT
graded_at TIMESTAMP NOT NULL
graded_by UUID NOT NULL REFERENCES users(id)
```

Grade validation:

```text
0 <= score <= 100
```

The constraint should be enforced both at the schema/business level and, where practical, in PostgreSQL.

---

# 7. Database Indexing

At minimum:

```text
users.email
users.role
classes.teacher_id
class_students.class_id
class_students.student_id
assignments.class_id
assignments.published
submissions.assignment_id
submissions.student_id
grades.submission_id
```

Required uniqueness constraints:

```text
users.email
oauth_accounts(provider, provider_account_id)
class_students(class_id, student_id)
submissions(assignment_id, student_id)
grades(submission_id)
```

---

# 8. Database Migrations

Use Kysely migrations.

Suggested migration order:

```text
001_create_users
002_create_oauth_accounts
003_create_teacher_groups
004_create_teacher_group_members
005_create_classes
006_create_class_students
007_create_assignments
008_create_submissions
009_create_grades
```

Rules:

- Migrations are immutable once committed/applied.
- Never edit an old migration to fix a later schema issue.
- Add a new migration for changes.
- Seed data must be deterministic.

---

# 9. Seed Data

Provide deterministic demo data similar to:

```text
Admin
  admin@example.com

Teacher
  teacher@example.com

Teacher
  teacher2@example.com

Students
  student@example.com
  student2@example.com
  student3@example.com
```

Example demo graph:

```text
Teacher
  ↓
Biology 101
  ↓
3 students
  ↓
2 assignments
  ↓
submissions
  ↓
grades
```

This data should make local development, integration tests, and the demo reproducible.

---

# 10. Authentication Architecture

Use:

```text
OAuth provider
    ↓
OAuth callback
    ↓
find/create user
    ↓
issue JWT
    ↓
HTTP-only cookie
```

JWT payload should be minimal:

```json
{
  "sub": "user-id",
  "role": "teacher",
  "iat": 123,
  "exp": 456
}
```

Do not put sensitive application data in the JWT.

Cookie properties:

```text
HttpOnly
Secure in production
SameSite=Lax
Path=/
```

When checking authorization, query current user state as needed. Suspension must not be bypassable because an old JWT still contains an apparently valid role.

---

# 11. Authentication Endpoints

## OAuth start

```http
GET /auth/oauth/:provider
```

## OAuth callback

```http
GET /auth/oauth/:provider/callback
```

## Current user

```http
GET /api/auth/me
```

Example response:

```json
{
  "id": "user-id",
  "name": "Jane Doe",
  "email": "jane@example.com",
  "role": "teacher"
}
```

## Logout

```http
POST /api/auth/logout
```

Logout should clear the authentication cookie.

---

# 12. Authorization Architecture

Implement reusable authorization helpers:

```text
requireAuth()
requireRole("admin")
requireRole("teacher")
requireRole("student")
requireAnyRole(...)
```

Ownership helpers:

```text
requireTeacherOwnsClass(userId, classId)
requireStudentEnrolledInClass(userId, classId)
requireStudentOwnsSubmission(userId, submissionId)
requireTeacherOwnsAssignment(userId, assignmentId)
requireTeacherOwnsSubmission(userId, submissionId)
```

Authorization must be enforced in the backend.

---

# 13. Permission Matrix

| Operation | Admin | Teacher | Student |
|---|---:|---:|---:|
| Manage users | Yes | No | No |
| Suspend/unsuspend users | Yes | No | No |
| Manage teacher groups | Yes | No | No |
| Create class | No | Own classes | No |
| Read class | All/appropriate | Own | Enrolled |
| Edit class | No | Own | No |
| Delete class | No | Own | No |
| Add/remove students | No | Own class | No |
| Create assignment | No | Own class | No |
| Edit assignment | No | Own class | No |
| Publish assignment | No | Own class | No |
| View unpublished assignment | Appropriate internal users | Own class | No |
| Submit assignment | No | No | Own submission |
| View submissions | Appropriate admin/teacher context | Own class | Own only |
| Grade submission | No | Own class | No |
| View grades | Appropriate | Own class | Own grades |
| Statistics API | Protected according to API policy | Protected according to API policy | Protected according to API policy |

If the assessment does not define an exact admin read/write permission for classes/grades, keep admin powers narrowly scoped to the explicit requirements instead of silently granting broad access.

---

# 14. Suspension Rules

Suspended users must not be able to perform protected application actions.

At minimum:

```text
Suspended teacher
- cannot create/edit/delete classes
- cannot manage class students
- cannot create/edit/publish assignments
- cannot grade submissions

Suspended student
- cannot submit assignments
- cannot access normal student application functionality
```

Recommended UX:

```text
valid authentication + suspended status
    ↓
suspension screen
```

Server-side authorization remains authoritative.

---

# 15. Admin API

## Users

```http
GET    /api/users
GET    /api/users/:id
POST   /api/users
PATCH  /api/users/:id
DELETE /api/users/:id
```

## Suspension

```http
POST /api/users/:id/suspend
POST /api/users/:id/unsuspend
```

Only Admin may perform these operations.

Define safe deletion behavior around dependent records. If hard deletion is unsafe, use a documented soft-deactivation approach instead of causing broken foreign keys or silent cascading data loss.

---

# 16. Teacher Group API

```http
GET    /api/teacher-groups
POST   /api/teacher-groups
GET    /api/teacher-groups/:id
PATCH  /api/teacher-groups/:id
DELETE /api/teacher-groups/:id

POST   /api/teacher-groups/:id/teachers/:teacherId
DELETE /api/teacher-groups/:id/teachers/:teacherId
```

Admin only.

---

# 17. Classes API

```http
GET    /api/classes
POST   /api/classes
GET    /api/classes/:id
PATCH  /api/classes/:id
DELETE /api/classes/:id
```

Behavior by role:

- Teacher: own classes
- Student: enrolled classes
- Admin: only as explicitly required; do not automatically grant broad privileges not present in the assessment

Teacher mutations must verify ownership.

---

# 18. Class Enrollment API

```http
GET    /api/classes/:id/students
POST   /api/classes/:id/students/:studentId
DELETE /api/classes/:id/students/:studentId
```

Teacher only for mutations.

Server must verify:

```text
request.user.role === teacher
AND
class.teacher_id === request.user.id
```

---

# 19. Assignment API

```http
GET    /api/classes/:classId/assignments
POST   /api/classes/:classId/assignments

GET    /api/assignments/:id
PATCH  /api/assignments/:id
DELETE /api/assignments/:id

POST   /api/assignments/:id/publish
```

Teacher can create/edit/delete/publish only in classes they own.

Student can view only published assignments in enrolled classes.

Do not make saving a draft equivalent to publishing.

---

# 20. Submission API

```http
GET   /api/assignments/:id/submission
POST  /api/assignments/:id/submission
PATCH /api/assignments/:id/submission
```

Rules:

- Student can only submit as themselves.
- Student must be enrolled in the assignment's class.
- Assignment must be published.
- One current submission per assignment/student pair.

Teacher list endpoint:

```http
GET /api/assignments/:id/submissions
```

Teacher must own the assignment's class.

---

# 21. Grade API

```http
POST  /api/submissions/:id/grade
PATCH /api/submissions/:id/grade
GET   /api/submissions/:id/grade
```

Teacher write permissions require:

```text
submission
  ↓
assignment
  ↓
class
  ↓
class.teacher_id === currentTeacher.id
```

Students may read grades for their own submissions only.

---

# 22. Statistics API

Treat this as a stable external-facing API contract:

```http
GET /api/v0/stats/average-grades
GET /api/v0/stats/average-grades/:classId
GET /api/v0/stats/teacher-names
GET /api/v0/stats/student-names
GET /api/v0/stats/classes
GET /api/v0/stats/classes/:classId
```

## Average grades

Response:

```json
{
  "averageGrade": 84.5
}
```

If no grades exist, return `null` instead of `0`.

Example:

```json
{
  "averageGrade": null
}
```

This distinguishes “no graded submissions exist” from an actual zero average.

## Class list

```json
{
  "classes": [
    {
      "id": "class-id",
      "name": "Biology 101",
      "teacherName": "Jane Doe"
    }
  ]
}
```

## Class students

```json
{
  "class": {
    "id": "class-id",
    "name": "Biology 101"
  },
  "students": [
    {
      "id": "student-id",
      "name": "John Smith"
    }
  ]
}
```

Never return arbitrary raw database rows.

Each stats route must have:

- explicit request validation
- explicit response schema
- integration tests
- stable DTOs
- appropriate caching where implemented

---

# 23. API Error Contract

Use a consistent error shape:

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "You do not have permission to perform this action."
  }
}
```

Suggested codes:

```text
UNAUTHORIZED
FORBIDDEN
NOT_FOUND
VALIDATION_ERROR
CONFLICT
INTERNAL_ERROR
```

HTTP status mapping:

```text
200 GET/PATCH success
201 POST create
204 successful DELETE/remove
400 invalid input
401 missing/invalid authentication
403 authenticated but insufficient permission
404 missing resource
409 duplicate/conflicting operation
500 unexpected server error
```

Do not leak raw Postgres or internal stack traces to clients.

---

# 24. Zod Validation

Validate all external inputs.

Schemas should exist for:

```text
CreateUserSchema
UpdateUserSchema

CreateClassSchema
UpdateClassSchema

CreateAssignmentSchema
UpdateAssignmentSchema

CreateSubmissionSchema
GradeSubmissionSchema
```

Also validate:

- route parameters
- query parameters
- request bodies
- environment variables
- provider callback inputs where applicable

Environment variables should be parsed at application startup.

Suggested variables:

```text
DATABASE_URL
REDIS_URL
JWT_SECRET
OAUTH_CLIENT_ID
OAUTH_CLIENT_SECRET
OAUTH_CALLBACK_URL
```

Fail startup with a clear error when required configuration is missing.

---

# 25. Service Layer

Business logic belongs in services.

Example route:

```ts
fastify.post("/classes", async (request) => {
  const input = CreateClassSchema.parse(request.body);

  return classService.createClass({
    teacherId: request.user.id,
    ...input,
  });
});
```

Not:

```ts
fastify.post("/classes", async (request) => {
  // large amounts of authorization and database logic here
});
```

Each service should be independently unit-testable.

---

# 26. Repository Layer

Repositories should expose meaningful operations rather than a generic CRUD abstraction.

Examples:

```text
userRepository.findById()
userRepository.findByEmail()
userRepository.create()
userRepository.update()
userRepository.suspend()

classRepository.create()
classRepository.findById()
classRepository.findByTeacher()
classRepository.addStudent()
classRepository.removeStudent()

assignmentRepository.create()
assignmentRepository.publish()
assignmentRepository.findById()

submissionRepository.create()
submissionRepository.findByStudent()
submissionRepository.findByAssignment()

gradeRepository.createOrUpdate()
gradeRepository.findBySubmission()
```

---

# 27. Transaction Boundaries

Use DB transactions when multiple related writes must succeed atomically.

Examples:

```text
Create class
  + initial enrollment writes
```

or any operation where partial completion would leave invalid state.

Do not wrap every simple single-row operation in a transaction without a reason.

---

# 28. Redis Caching

Redis is a cache, not the source of truth.

Good cache candidates:

```text
stats:average-grades
stats:average-grades:{classId}
stats:teacher-names
stats:student-names
stats:classes
stats:classes:{classId}
```

Example flow:

```text
GET /api/v0/stats/classes
         ↓
Redis hit?
   /          \
yes           no
 |             |
return       PostgreSQL
               ↓
           Redis.set
               ↓
            return
```

Use a short TTL such as 30–60 seconds unless the application clearly requires another value.

Invalidate relevant keys after mutations.

Do not add caching to every endpoint simply to demonstrate Redis.

---

# 29. Frontend Architecture

Next.js should handle:

- routing
- page composition
- server rendering where beneficial
- forms
- UI state
- API interactions
- role-based navigation
- loading/error/empty states

The frontend should not become a second source of truth for business rules.

Feature organization:

```text
features/
  auth/
  users/
  teacher-groups/
  classes/
  assignments/
  submissions/
  grades/
  stats/
```

---

# 30. Frontend API Client

Hide raw HTTP details behind typed client functions.

Suggested modules:

```text
lib/api/auth.ts
lib/api/users.ts
lib/api/classes.ts
lib/api/assignments.ts
lib/api/submissions.ts
lib/api/grades.ts
lib/api/stats.ts
```

Components should call functions such as:

```ts
classesApi.listMine()
assignmentsApi.publish(id)
gradesApi.gradeSubmission(id, input)
```

Do not construct raw URLs throughout the component tree.

---

# 31. Frontend Shell

Global shell:

```text
Sidebar
  Dashboard
  Classes
  Assignments
  Users
  Teacher Groups
  Statistics

Top bar
  User name
  Role
  Logout
```

Navigation is role-aware.

### Admin navigation

```text
Dashboard
Users
Teacher Groups
Statistics
```

### Teacher navigation

```text
Dashboard
My Classes
Assignments
Submissions
Statistics
```

### Student navigation

```text
Dashboard
My Classes
Assignments
Grades
```

---

# 32. Admin UI

## User Management

Table columns:

```text
Name
Email
Role
Status
Created
Actions
```

Actions:

```text
Edit
Suspend
Unsuspend
Delete
```

Use confirmation UI for destructive operations.

## Teacher Groups

Provide:

- group list
- create
- edit
- delete
- teacher membership management

---

# 33. Teacher UI

## Classes

Display:

```text
Class name
Description
Student count
Assignment count
Actions
```

Class detail:

```text
Class information

Students
  name
  email
  remove

Add student

Assignments
  title
  status
  due date
  actions
```

## Assignment form

Fields:

```text
Title
Description
Due date
```

Actions:

```text
Save draft
Publish
```

Saving and publishing should be distinct operations.

---

# 34. Teacher Grading UI

Example interaction:

```text
Assignment
  ↓
Student submissions

Student A
--------------------
Submission content

Score: [ 92 ]
Feedback:
[ Excellent explanation... ]

[Save Grade]
```

Teacher must only see/grade submissions in their own classes.

---

# 35. Student UI

Dashboard should show:

```text
Enrolled Classes
Upcoming Assignments
Recent Grades
```

Assignment detail:

```text
Title
Description
Due date

Submission
[textarea]

[Submit Assignment]
```

After grading:

```text
Score: 92/100

Teacher Feedback:
Excellent explanation...
```

---

# 36. Loading, Empty, and Error States

Every asynchronous page should support:

```text
loading
success
empty
error
```

Example class page:

```text
Loading classes...

No classes yet.

Failed to load classes. Retry.

Class table.
```

Use consistent design patterns across features.

---

# 37. Form Standards

Each mutation form should provide:

- schema validation
- field-level errors
- server-side error handling
- loading state
- disabled submit while pending
- success feedback

Avoid each form implementing these behaviors differently.

---

# 38. Testing Architecture

Testing is part of the design, not a final-stage activity.

Test layers:

```text
Unit tests
  ↓
API integration tests
  ↓
Component tests
  ↓
Playwright E2E
```

---

# 39. Unit Test Requirements

Unit test all service methods and important pure functions:

```text
auth service
user service
teacher group service
class service
assignment service
submission service
grading service
stats service
authorization helpers
validation utilities
```

For important branches cover:

```text
success
not found
forbidden
conflict
validation error
suspended user
ownership failure
```

Prefer small deterministic services and pure policy functions so 100% branch coverage remains practical.

---

# 40. API Integration Tests

Use Supertest against the actual Fastify app.

Every route should have tests for applicable cases:

```text
success
unauthenticated
wrong role
wrong ownership
invalid input
not found
conflict
successful mutation
```

Example:

```text
POST /api/classes

201 teacher succeeds
401 unauthenticated
403 student
403 teacher modifying another teacher's class
400 invalid payload
```

Authorization failures are first-class test cases.

---

# 41. Component Tests

Use React Testing Library for key interactive components:

- login/auth state
- user table
- class form
- assignment form
- submission form
- grade form
- suspend/unsuspend dialog
- role-based navigation

Prefer semantic queries such as:

```ts
screen.getByRole(...)
```

rather than implementation-specific DOM selectors.

---

# 42. Playwright E2E Test Plan

Primary golden path:

```text
1. Login as Admin
2. Create teacher
3. Login as Teacher
4. Create Biology 101
5. Add student
6. Create assignment
7. Publish assignment
8. Login as Student
9. Open Biology 101
10. Open assignment
11. Submit work
12. Login as Teacher
13. Open submissions
14. Grade submission
15. Add feedback
16. Login as Student
17. Verify grade and feedback
18. Verify statistics flow/API
```

Negative-path E2E tests:

```text
suspended student cannot submit
suspended teacher cannot grade
student cannot access teacher pages
teacher cannot access admin pages
teacher cannot modify another teacher's class
student cannot access another student's grade
```

E2E tests should use deterministic seed/reset behavior.

Do not depend on manually prepared developer data.

---

# 43. Coverage Configuration

Enforce:

```text
100% statements
100% branches
100% functions
100% lines
```

The CI command should fail when any metric is below 100%.

Avoid exclusions except for truly generated/framework boilerplate where necessary.

Do not game coverage.

---

# 44. Docker Architecture

Use a root multi-stage Dockerfile.

Conceptual stages:

```text
Stage 1: dependencies
Stage 2: build
Stage 3: production runtime
```

Keep the final runtime image as small as practical.

---

# 45. Docker Compose

Development stack:

```yaml
services:
  postgres:
  redis:
  api:
  web:
```

Production stack may add:

```text
nginx
certbot
```

Provide health checks for:

- PostgreSQL
- Redis
- API

Services should wait for dependencies to be healthy rather than assuming immediate availability.

---

# 46. Nginx

Nginx responsibilities:

```text
TLS termination
/       → Next.js
/api    → Fastify
```

Forward appropriate headers, including:

```text
X-Forwarded-For
X-Forwarded-Proto
Host
```

Production browsers should not need direct access to internal API service ports.

---

# 47. Certbot / SSL

Document:

```text
1. Configure DNS
2. Open ports 80 and 443
3. Start Nginx/Compose stack
4. Issue Let's Encrypt certificate
5. Configure renewal
6. Reload Nginx after certificate changes
```

Keep the process reproducible in the README.

---

# 48. GitHub Actions CI/CD

Pull request / push pipeline:

```text
npm ci
    ↓
lint
    ↓
typecheck
    ↓
unit tests
    ↓
integration tests
    ↓
coverage
    ↓
build
    ↓
Docker build
```

Main branch additionally:

```text
Docker Hub login
    ↓
Docker image build
    ↓
Docker image push
```

Use GitHub Actions secrets for Docker credentials.

Never commit secrets.

---

# 49. Observability / Logging

Use structured logs for:

- request lifecycle
- authentication failures
- authorization failures
- unexpected exceptions
- important mutations

Never log:

- JWTs
- OAuth client secrets
- cookies
- access tokens
- unnecessary student-sensitive information

---

# 50. Security Checklist

Implement:

```text
[ ] HTTP-only auth cookies
[ ] Secure cookies in production
[ ] SameSite protection
[ ] JWT expiration
[ ] Input validation
[ ] Role authorization
[ ] Resource ownership authorization
[ ] Suspension enforcement
[ ] Secrets via environment variables
[ ] No secrets committed to source
[ ] Parameterized DB access through Kysely
[ ] Safe error responses
[ ] Appropriate security headers if supported by existing stack
[ ] CSRF strategy appropriate to cookie-based auth
[ ] Rate limiting only where justified and supported by existing dependencies
```

---

# 51. Optional Chatbot / Extra Credit

The chatbot should be intentionally narrow.

It can receive controlled application context such as:

```text
current user role
current class
upcoming assignments
recent grades
```

The chatbot must obey the same authorization boundaries as the rest of the application.

Examples of acceptable questions:

```text
What assignments are due soon?
What was my latest grade?
Which students are in my class?
```

Never provide the model unrestricted database access.

Never use the chatbot to bypass authorization.

If the existing project/dependencies do not support a clean LLM integration, prioritize the core assessment requirements over the extra credit.

---

# 52. Architecture Decisions Worth Highlighting in the Interview

## Decision 1: Modular monolith instead of microservices

The domain is small. A modular Fastify application reduces deployment and testing complexity while preserving clear boundaries.

## Decision 2: Server-side authorization

Frontend checks improve UX but cannot provide security. Every protected route independently verifies authentication, role, suspension state, and resource ownership.

## Decision 3: Database as source of truth

JWTs identify users, but mutable security state such as suspension is validated against current server state.

## Decision 4: Versioned statistics API

`/api/v0/stats/*` is treated as an external contract with explicit DTOs and response schemas rather than exposing raw DB rows.

## Decision 5: Redis used selectively

Cache stats endpoints where there is measurable value; do not add unnecessary caching complexity to ordinary CRUD operations.

## Decision 6: 100% coverage by design

Keep business logic small, deterministic, and separated from I/O so branch coverage is achievable without meaningless tests.

## Decision 7: Explicit draft/publish lifecycle

Saving an assignment and making it visible to students are deliberately separate operations.

## Decision 8: `null` for no-grade averages

A school with no graded submissions is semantically different from a school whose average is zero.

---

# 53. Development Phases

## Phase 1 — Repository inspection

Before changing code:

```text
[ ] Inspect repository
[ ] Inspect package.json
[ ] Inspect test configuration
[ ] Inspect existing application code
[ ] Inspect Docker configuration
[ ] Identify reusable infrastructure
[ ] Identify missing modules
[ ] Confirm allowed dependencies
```

Deliverable:

- concise architecture assessment
- implementation plan
- dependency inventory
- identified risks

Do not rewrite functioning infrastructure without justification.

---

## Phase 2 — Infrastructure

Implement:

```text
[ ] PostgreSQL connection
[ ] Kysely setup
[ ] Database migrations
[ ] Seed system
[ ] Environment validation
[ ] Fastify bootstrap
[ ] Redis connection
[ ] Health endpoint
[ ] Logging
```

Exit criteria:

```text
Postgres starts
Redis starts
API starts
migrations execute
seed executes
health check succeeds
```

---

## Phase 3 — Authentication / Authorization

Implement:

```text
[ ] OAuth provider
[ ] OAuth callback
[ ] User lookup/create
[ ] JWT creation
[ ] HTTP-only cookie
[ ] /api/auth/me
[ ] Logout
[ ] requireAuth
[ ] requireRole
[ ] suspension enforcement
```

Test:

```text
[ ] valid login
[ ] invalid/expired token
[ ] missing auth
[ ] OAuth callback
[ ] logout
[ ] suspended user
[ ] wrong role
```

---

## Phase 4 — Domain Backend

Implement in dependency order:

```text
[ ] Users
[ ] Teacher groups
[ ] Classes
[ ] Enrollment
[ ] Assignments
[ ] Submissions
[ ] Grades
[ ] Statistics
```

Each feature should include its service, repository, schemas, routes, and tests before proceeding to the next major feature where practical.

---

## Phase 5 — Frontend

Implement:

```text
[ ] Auth flow
[ ] Shared app shell
[ ] Role-aware navigation
[ ] Admin user UI
[ ] Admin teacher groups UI
[ ] Teacher classes UI
[ ] Teacher assignment UI
[ ] Teacher grading UI
[ ] Student class UI
[ ] Student assignment UI
[ ] Student submission UI
[ ] Student grades UI
[ ] Statistics UI / integration
[ ] Loading states
[ ] Empty states
[ ] Error states
```

---

## Phase 6 — Testing

Implement and audit:

```text
[ ] Unit tests
[ ] API integration tests
[ ] Component tests
[ ] Playwright E2E
[ ] Authorization negative paths
[ ] Validation cases
[ ] Suspension cases
[ ] Ownership cases
[ ] Coverage enforcement
```

Target:

```text
100% statements
100% branches
100% functions
100% lines
```

---

## Phase 7 — Containerization / Deployment

Implement:

```text
[ ] Root Dockerfile
[ ] Multi-stage build
[ ] Docker Compose
[ ] Postgres health check
[ ] Redis health check
[ ] API health check
[ ] Nginx configuration
[ ] Certbot documentation
[ ] Production environment documentation
```

---

## Phase 8 — CI/CD

Implement:

```text
[ ] Lint
[ ] Typecheck
[ ] Unit tests
[ ] Integration tests
[ ] Coverage
[ ] Build
[ ] Docker build
[ ] Docker Hub push
```

---

## Phase 9 — Final verification

Run all of:

```bash
npm run test
npm run coverage
npm run build
```

Then verify Docker:

```bash
docker compose up -d
```

Verify:

```text
[ ] application starts cleanly
[ ] migrations run
[ ] seed data works
[ ] auth works
[ ] admin workflow works
[ ] teacher workflow works
[ ] student workflow works
[ ] grading workflow works
[ ] stats API works
[ ] Docker build works
[ ] CI configuration is valid
[ ] README is reproducible
```

---

# 54. Definition of Done

The project is not complete until all applicable items below are true:

```text
[ ] Repository architecture established
[ ] Database schema implemented
[ ] Kysely migrations implemented
[ ] Deterministic seed data implemented
[ ] Authentication implemented
[ ] OAuth provider implemented
[ ] Secure HTTP-only JWT authentication implemented
[ ] Role authorization implemented
[ ] Suspension/unsuspension implemented
[ ] Admin user management implemented
[ ] Admin teacher-group management implemented
[ ] Teacher class CRUD implemented
[ ] Student enrollment implemented
[ ] Teacher assignment CRUD implemented
[ ] Assignment publishing implemented
[ ] Student assignment viewing implemented
[ ] Student submission implemented
[ ] Teacher grading implemented
[ ] Teacher feedback implemented
[ ] Student grade/feedback viewing implemented
[ ] Statistics API implemented
[ ] Redis caching implemented appropriately
[ ] Role-based frontend navigation implemented
[ ] Admin UI implemented
[ ] Teacher UI implemented
[ ] Student UI implemented
[ ] Loading/empty/error states implemented
[ ] Unit tests implemented
[ ] API integration tests implemented
[ ] Component tests implemented
[ ] Playwright E2E tests implemented
[ ] 100% coverage enforced
[ ] Dockerfile implemented
[ ] Docker Compose implemented
[ ] Nginx configuration implemented
[ ] Certbot/self-host deployment documented
[ ] GitHub Actions CI/CD implemented
[ ] Docker image publishing implemented
[ ] README completed
```

---

# 55. Demo Flow

Design the product so one complete user journey tells the story.

Recommended demonstration:

```text
1. Login as Admin
2. Show Users
3. Create or configure Teacher
4. Show Teacher Groups
5. Login as Teacher
6. Create Biology 101
7. Add Student
8. Create assignment
9. Publish assignment
10. Login as Student
11. Open Biology 101
12. Open assignment
13. Submit work
14. Login as Teacher
15. Open submissions
16. Grade submission
17. Add feedback
18. Login as Student
19. Show grade + feedback
20. Show school statistics API
21. Show tests and 100% coverage
22. Show Docker and CI/CD architecture
```

This should fit comfortably into a 5–10 minute walkthrough when prepared cleanly.

---

# 56. Coding Agent Master Prompt

The following prompt can be given to a coding agent as the top-level implementation instruction.

```text
You are implementing the Concentrate.ai full-stack hiring assessment.

Build a production-quality school portal using the existing repository and ONLY dependencies already present in package.json, except that Radix/shadcn UI components may be added when needed.

Do not replace existing working infrastructure without first understanding it.

Architecture:
- Next.js 15 + React 19 frontend
- Fastify + TypeScript backend
- Zod validation
- PostgreSQL 17
- Kysely ORM
- Redis
- JWT authentication using secure HTTP-only cookies
- One OAuth provider
- Vitest
- React Testing Library
- Supertest
- Playwright
- Docker
- Docker Compose
- GitHub Actions
- Nginx
- Certbot documentation

Build a modular application with:
- frontend
- API
- database
- shared schemas/types where useful
- authentication
- domain modules
- E2E tests

Roles:
- admin
- teacher
- student

Implement:
- authentication
- authorization
- user CRUD
- teacher group CRUD
- teacher suspension/unsuspension
- student suspension/unsuspension
- class CRUD
- student enrollment management
- assignment CRUD
- assignment publishing
- student submissions
- grading
- teacher feedback
- student grade/feedback viewing
- school statistics API
- Redis caching where appropriate

Use server-side authorization for every protected operation.

Business ownership rules:
- teachers only manage their own classes
- teachers only manage assignments in their classes
- teachers only grade submissions in their classes
- students only see classes they belong to
- students only see published assignments in enrolled classes
- students only access their own submissions and grades
- suspended users cannot perform protected operations

Use Kysely migrations and deterministic seed data.

Use Zod for every externally supplied:
- request body
- query
- route parameter
- environment variable

Use explicit API DTOs rather than returning database rows directly.

API errors must use a consistent format and appropriate HTTP status codes.

Implement:
/api/v0/stats/average-grades
/api/v0/stats/average-grades/:id
/api/v0/stats/teacher-names
/api/v0/stats/student-names
/api/v0/stats/classes
/api/v0/stats/classes/:id

Test every service method.
Test every API endpoint.
Test authorization failures.
Test validation failures.
Test critical frontend components.
Implement Playwright E2E coverage for the primary full user workflow.

Coverage requirements:
- 100% statements
- 100% branches
- 100% functions
- 100% lines

CI must fail below 100%.

Implement:
- root Dockerfile
- docker-compose.yml
- health checks
- Nginx reverse proxy
- SSL/Certbot deployment documentation
- GitHub Actions
- Docker image publishing

Do not lower coverage thresholds to make tests pass.
Do not add unnecessary abstractions.
Do not introduce microservices.
Do not put business logic directly into HTTP route handlers.
Do not rely on frontend permissions for security.
Do not commit secrets.

Implement incrementally in these phases:
1. repository inspection
2. infrastructure/database
3. authentication/authorization
4. domain APIs
5. frontend
6. tests
7. Docker/deployment
8. CI/CD
9. final verification

After each phase report:
- implemented work
- files changed
- tests added
- coverage
- known issues
- next phase

Before considering the project complete, run the complete test suite, coverage, build, and Docker build.
```

---

# 57. Expected Agent Progress Report Format

After each phase, require this exact structure:

```text
## Phase: <name>

### Implemented
- ...

### Files Changed
- ...

### Tests Added
- ...

### Coverage
- Statements: ...
- Branches: ...
- Functions: ...
- Lines: ...

### Known Issues
- ...

### Next Phase
- ...
```

---

# 58. Final Review Checklist

Before submitting the take-home, manually verify:

```text
[ ] No undocumented dependencies were introduced
[ ] No secrets are committed
[ ] All protected API routes enforce auth
[ ] All role permissions are enforced server-side
[ ] Teacher ownership is always enforced
[ ] Student ownership is always enforced
[ ] Suspension is enforced server-side
[ ] Stats API responses are explicit DTOs
[ ] No API endpoint leaks raw database objects
[ ] All migrations run from a clean database
[ ] Seed data is reproducible
[ ] Full golden-path E2E flow passes
[ ] Negative authorization E2E flows pass
[ ] Coverage is exactly at or above 100% in every configured metric
[ ] Docker Compose starts successfully
[ ] Docker image builds successfully
[ ] GitHub Actions configuration is valid
[ ] README explains local development
[ ] README explains test execution
[ ] README explains self-hosted deployment
[ ] README explains OAuth environment variables
[ ] README explains Docker deployment
[ ] README contains useful API examples
```

---

# 59. Success Criteria

The strongest submission should feel like a compact production system rather than a collection of CRUD screens.

The reviewer should be able to see, quickly:

1. Clear domain boundaries.
2. Strong authentication and authorization.
3. Correct relational data modeling.
4. Well-defined API contracts.
5. Meaningful tests with full coverage enforcement.
6. A complete user journey from teacher setup to student submission to grading.
7. Reproducible Docker deployment.
8. CI/CD that verifies the application before publishing an image.
9. Thoughtful but restrained use of Redis.
10. A codebase that is easy to reason about and extend.

The application should optimize for correctness, clarity, and demonstrable engineering judgment rather than feature count for its own sake.
