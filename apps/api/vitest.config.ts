import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    fileParallelism: false, // integration tests share one real Postgres instance and seed users
    coverage: {
      provider: "v8",
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
      exclude: [
        "**/*.test.ts",
        "vitest.config.ts",
        "src/server.ts", // process entrypoint, no branching logic
        "src/seed.ts", // one-shot CLI script
        "src/db/migrate.ts", // one-shot CLI script
        "src/db/migrations/**", // migration files run once against real Postgres, not unit-testable
        "src/db/schema.ts", // pure type declarations, no runtime code
      ],
    },
  },
});
