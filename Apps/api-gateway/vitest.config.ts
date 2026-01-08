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
    env: {
      API_GATEWAY_LOG_REQUESTS: "false",
      API_GATEWAY_ENABLE_DUPLO_DASHBOARD: "false",
      LOG_LEVEL: "silent",
    },
    coverage: {
      provider: "v8",
      reportsDirectory: "./coverage",
      reporter: ["text", "text-summary", "lcov", "html"],
      exclude: [
        "tests/**",
        "dist/**",
        "node_modules/**",
        "**/*.d.ts",
        "**/*.config.*",
      ],
    },
  },
  resolve: {
    alias: buildTsconfigAliases("./tsconfig.json", import.meta.url),
  },
});
