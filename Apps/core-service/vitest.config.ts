import { defineConfig } from "vitest/config";

import { buildTsconfigAliases } from "../../vitest.tsconfig-alias.js";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts"],
    exclude: ["dist/**", "**/dist/**", "node_modules/**"],
    testTimeout: 30000,
    hookTimeout: 30000,
    reporters: ["verbose"],
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary", "lcov", "html"],
      exclude: ["node_modules/", "dist/", "tests/", "**/*.d.ts", "**/*.config.*"],
      all: true,
    },
    // Disable logging during tests
    env: {
      LOG_LEVEL: "silent",
      LOG_REQUESTS: "false",
    },
  },
  resolve: {
    alias: buildTsconfigAliases("./tsconfig.json", import.meta.url),
  },
});
