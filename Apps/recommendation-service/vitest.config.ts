import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    reporters: ["verbose"],
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
