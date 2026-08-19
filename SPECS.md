# Concentrate.ai Hiring Quiz

A **Canvas-style School Portal Platform**.

---

## Overview
This system models an educational SaaS platform for schools and institutions. It provides three user roles — **Admin**, **Teacher**, and **Student** — each with distinct permissions and workflows. The application supports class management, lesson publication, assignment submission, and grading.

The project is **fully tested**, **Dockerized**, and **deployable**, with an exposed API for school-level analytics and statistics.

## Rules
You are to use the dependencies inside the `package.json` and no others. You may install extra Radix or shadcn UI components if needed.

---

## User Roles & Features

### Admin
- CRUD operations for **teacher groups**.
- CRUD operations for users.
- Suspend/unsuspend students.
- Suspend/unsuspend teachers.

### Teacher
- CRUD operations for **classes**.
- Add or remove **students**.
- Publish **assignments**.
- Grade student submissions and provide feedback.

### Student
- View enrolled classes and assignments.
- Submit assignments.
- View grades and teacher feedback.

## Extra credit

### Chatbot
- API calls to LLM provider with app-level context.
- Should be able to answer basic questions.

---

## Tech Stack

| Layer | Technology |
|--------|-------------|
| **Frontend** | Next.js 15, React 19, TailwindCSS, Radix (or shadcn) UI |
| **Backend** | Node.js, Fastify, TypeScript, Zod |
| **Database** | PostgreSQL 17 with Kysely ORM |
| **Caching** | Redis |
| **Testing** | Vitest, @testing-library/react, Supertest, Playwright |
| **CI/CD** | GitHub Actions |
| **Containerization** | Docker & Docker Compose |

---

## API Overview

### School Statistics API
Exposes school-wide metrics for external integration.

| Endpoint | Method | Description |
|-----------|---------|--------------|
| `/api/v0/stats/average-grades` | `GET` | Returns average grade across all classes |
| `/api/v0/stats/average-grades/:id` | `GET` | Returns average grade from specified class |
| `/api/v0/stats/teacher-names` | `GET` | Lists all teacher names |
| `/api/v0/stats/student-names` | `GET` | Lists all student names |
| `/api/v0/stats/classes` | `GET` | Returns a list of all classes |
| `/api/v0/stats/classes/:id` | `GET` | Returns a list of all students from a class |

**Auth:** Roll your own JWT with secure HTTP-only cookies. All services should be protected. Integrate at least 1 OAuth provider (Google, Microsoft, GitHub, etc).

---

## Testing

Testing is enforced across all layers with **100% coverage**.

- **Framework:** Vitest + @testing-library/react + Supertest, Playwright
- **Coverage Enforcement:** CI/CD fails below 100%
- **Structure:**
  - Unit tests for all service methods
  - Integration tests for API endpoints
  - Component tests for key UI features
  - E2E tests with Playwright for full app-flow tests


To run tests:
```bash
npm run test
```

To view coverage:
```bash
npm run coverage
```

---

## CI/CD

- Run all tests and build all services
- Push to Docker Hub

## Docker Setup

The project includes a docker-compose.yml for the Postgres instance.

### Start Services
```bash
docker-compose up -d
```

### Shut Down
```bash
docker-compose down
```

---

## Containerization

Containerize all the services so they can be spun up via a singular, root-level Dockerfile.


## Deployment Guide

### Self-Hosted Deployment
- Deploy via **Docker Compose** on a cloud instance (you choose which provider)
- Use **Nginx** reverse proxy
- Obtain SSL cert with **Certbot**

---

## Development Setup

### Local Development
```bash
npm install
npm run dev
```

---

## Development Checklist
- [ ] Setup monorepo
- [ ] Implement Admin, Teacher, and Student services
- [ ] Build and expose the School Statistics API
- [ ] Implement authentication and protected routes
- [ ] Configure Docker Compose for full stack
- [ ] Write unit and integration tests (100% coverage)
- [ ] Write E2E tests
- [ ] Add CI/CD pipeline
- [ ] Deploy to production

---

## Submission
- Submit a 5-10 minute video going over the app and highlights to Google Drive and share it with adam@concentrate.ai.