import { defineConfig, devices } from "@playwright/test";

const CI = !!process.env.CI;

// The API needs these to boot; defaults match docker-compose for local runs,
// and CI provides them via the job environment.
const API_ENV = {
  DATABASE_URL: process.env.DATABASE_URL ?? "postgresql://school:school@localhost:5432/school_portal",
  REDIS_URL: process.env.REDIS_URL ?? "redis://localhost:6379",
  JWT_SECRET: process.env.JWT_SECRET ?? "e2e-only-secret-please-do-not-reuse-0123456789",
  NODE_ENV: "test",
};

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  forbidOnly: CI,
  retries: CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "npm run dev -w api",
      url: "http://localhost:4000/health",
      env: API_ENV,
      reuseExistingServer: !CI,
      timeout: 60_000,
    },
    {
      command: "npm run dev -w web",
      url: "http://localhost:3000",
      reuseExistingServer: !CI,
      timeout: 120_000,
    },
  ],
});
