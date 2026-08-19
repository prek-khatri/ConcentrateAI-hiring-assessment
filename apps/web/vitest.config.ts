import { defineConfig, coverageConfigDefaults } from "vitest/config";

export default defineConfig({
  esbuild: {
    jsx: "automatic",
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    coverage: {
      provider: "v8",
      // Measure app source only; root config files carry no testable logic.
      include: ["app/**/*.{ts,tsx}", "lib/**/*.ts", "middleware.ts"],
      exclude: [...coverageConfigDefaults.exclude],
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
    },
  },
  resolve: {
    alias: { "@": new URL(".", import.meta.url).pathname },
  },
});
