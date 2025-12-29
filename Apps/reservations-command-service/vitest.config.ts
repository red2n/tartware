import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["./tests/setup.ts"],
    testTimeout: 30000,
    hookTimeout: 30000,
    reporters: ["verbose"],
    coverage: {
      provider: "v8",
      reportsDirectory: "./coverage",
      reporter: ["text", "text-summary", "lcov", "html"],
      exclude: ["tests/**", "dist/**", "node_modules/**", "**/*.d.ts", "**/*.config.*"],
    },
    env: {
      RESERVATION_COMMAND_LOG_REQUESTS: "false",
      LOG_LEVEL: "silent",
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
        find: "@tartware/config",
        replacement: resolve(__dirname, "../config/src/index.ts"),
      },
      {
        find: "@tartware/telemetry",
        replacement: resolve(__dirname, "../telemetry/src/index.ts"),
      },
      {
        find: "@tartware/openapi",
        replacement: resolve(__dirname, "../openapi-utils/src/index.ts"),
      },
      {
        find: "@tartware/outbox",
        replacement: resolve(__dirname, "../outbox/src/index.ts"),
      },
    ],
  },
});
