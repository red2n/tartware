import { defineConfig } from "vitest/config";

import { buildTsconfigAliases } from "../../vitest.tsconfig-alias.js";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["./tests/setup.ts"],
    testTimeout: 20000,
    hookTimeout: 20000,
    reporters: ["verbose"],
    coverage: {
      provider: "v8",
      reportsDirectory: "./coverage",
      reporter: ["text", "text-summary", "lcov", "html"],
      exclude: ["tests/**", "dist/**", "node_modules/**", "**/*.d.ts", "**/*.config.*"],
    },
    env: {
      LOG_LEVEL: "silent",
    },
  },
  resolve: {
    alias: buildTsconfigAliases("./tsconfig.json", import.meta.url),
  },
});
