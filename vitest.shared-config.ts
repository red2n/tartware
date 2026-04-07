import type { UserConfig } from "vitest/config";
import { defineConfig } from "vitest/config";

import { buildTsconfigAliases } from "./vitest.tsconfig-alias.js";

/**
 * Shared vitest configuration for all service packages.
 * Import in each service's vitest.config.ts:
 *   import { createVitestConfig } from "../../vitest.shared-config.js";
 *   export default createVitestConfig(import.meta.url);
 *
 * Pass optional overrides to customise timeouts, env, etc.:
 *   export default createVitestConfig(import.meta.url, {
 *     test: { testTimeout: 60_000, env: { DEBUG: "1" } },
 *   });
 */
export function createVitestConfig(importMetaUrl: string, overrides?: UserConfig) {
	const testOverrides = overrides?.test ?? {};
	return defineConfig({
		test: {
			globals: true,
			environment: "node",
			include: ["tests/**/*.test.ts"],
			setupFiles: ["./tests/setup.ts"],
			testTimeout: 20000,
			hookTimeout: 20000,
			reporters: ["verbose"],
			coverage: {
				provider: "v8" as const,
				reportsDirectory: "./coverage",
				reporter: ["text", "text-summary", "lcov", "html"],
				exclude: ["tests/**", "dist/**", "node_modules/**", "**/*.d.ts", "**/*.config.*"],
			},
			...testOverrides,
			env: { LOG_LEVEL: "silent", ...testOverrides.env },
		},
		resolve: {
			alias: buildTsconfigAliases("./tsconfig.json", importMetaUrl),
		},
	});
}
