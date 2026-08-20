import { defineConfig, coverageConfigDefaults } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    fileParallelism: false, // integration tests share one real Postgres instance and seed users
    env: {
      DATABASE_URL: process.env.DATABASE_URL || "postgresql://school:school@localhost:5432/school_portal",
      REDIS_URL: process.env.REDIS_URL || "redis://localhost:6379",
      JWT_SECRET: process.env.JWT_SECRET || "01234567890123456789012345678901",
      GROQ_API_KEY: process.env.GROQ_API_KEY || "test-groq-key-placeholder",
      NODE_ENV: "test",
    },
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: [
        ...coverageConfigDefaults.exclude,
        "src/server.ts", // process entrypoint, no branching logic
        "src/seed.ts", // one-shot CLI script
        "src/db/migrate.ts", // one-shot CLI script
        "src/db/migrations/**", // migrations run once against real Postgres, not unit-testable
        "src/db/schema.ts", // pure type declarations, no runtime code
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
