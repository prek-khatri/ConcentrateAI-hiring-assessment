import { execSync } from "node:child_process";

// Ensure the E2E database is migrated and seeded before the suite runs, so
// `npx playwright test` is a single self-contained command (Postgres/Redis
// must already be up via `docker compose up -d`).
const DB_ENV = {
  DATABASE_URL: process.env.DATABASE_URL ?? "postgresql://school:school@localhost:5432/school_portal",
  REDIS_URL: process.env.REDIS_URL ?? "redis://localhost:6379",
  JWT_SECRET: process.env.JWT_SECRET ?? "e2e-only-secret-please-do-not-reuse-0123456789",
};

export default function globalSetup(): void {
  execSync("npm run migrate -w api && npm run seed -w api", {
    stdio: "inherit",
    env: { ...process.env, ...DB_ENV },
  });
}
