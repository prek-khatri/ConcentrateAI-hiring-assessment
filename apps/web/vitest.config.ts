import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: {
    jsx: "automatic",
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
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
        "**/*.test.tsx",
        ".next/**",
        "next-env.d.ts",
        "vitest.config.ts",
        "vitest.setup.ts",
        "next.config.ts", // framework config, no runtime logic
        "tailwind.config.ts", // framework config, no runtime logic
        "postcss.config.mjs", // framework config, no runtime logic
      ],
    },
  },
  resolve: {
    alias: { "@": new URL(".", import.meta.url).pathname },
  },
});
