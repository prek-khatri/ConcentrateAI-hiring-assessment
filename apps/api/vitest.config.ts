import { defineConfig, coverageConfigDefaults } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: [
        ...coverageConfigDefaults.exclude,
        // Bootstrap / one-shot scripts — no branching logic to unit-test.
        "src/server.ts",
        "src/seed.ts",
        "src/db/migrate.ts",
        "src/db/migrations/**",
        // External Google OAuth adapter (network I/O); mocked in route tests.
        "src/auth/google.ts",
      ],
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
    },
  },
});
