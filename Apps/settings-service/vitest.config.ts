import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    setupFiles: ["./tests/setup.ts"],
    testTimeout: 30000,
    hookTimeout: 30000,
    reporters: ["verbose"],
    exclude: ["dist/**", "node_modules/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "text-summary", "lcov", "html"],
      exclude: ["node_modules/", "dist/", "tests/", "**/*.d.ts", "**/*.config.*"],
      all: true,
    },
    env: {
      LOG_LEVEL: "silent",
      LOG_REQUESTS: "false",
    },
  },
  resolve: {
    alias: [
      {
        find: /^@tartware\/schemas\/(.*)$/,
        replacement: resolve(__dirname, "../../schema/src/$1.ts"),
      },
      {
        find: "@tartware/schemas",
        replacement: resolve(__dirname, "../../schema/src/index.ts"),
      },
      {
        find: "@tartware/telemetry",
        replacement: resolve(__dirname, "../telemetry/src/index.ts"),
      },
      {
        find: "@tartware/config",
        replacement: resolve(__dirname, "../config/src/index.ts"),
      },
      {
        find: "@tartware/openapi",
        replacement: resolve(__dirname, "../openapi-utils/src/index.ts"),
      },
    ],
  },
});
