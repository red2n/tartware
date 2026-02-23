import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    reporters: ["verbose"],
    coverage: {
      provider: "v8",
      reportsDirectory: "./coverage",
      reporter: ["text", "text-summary", "lcov", "html"],
      exclude: ["tests/**", "dist/**", "node_modules/**", "**/*.d.ts", "**/*.config.*"],
    },
    env: {
      LOG_LEVEL: "fatal",
    },
  },
  resolve: {
    alias: {
      "@tartware/candidate-pipeline": path.resolve(
        __dirname,
        "../candidate-pipeline/src/index.ts",
      ),
    },
  },
});
