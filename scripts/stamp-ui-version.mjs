/**
 * stamp-ui-version.mjs
 * Writes the build version (YYYYMMDDHHmm-<git short hash>) into the
 * Angular environment file so it is baked into the production bundle.
 */
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";

let hash = "unknown";
try {
	hash = execSync("git rev-parse --short HEAD").toString().trim();
} catch {
	// Not a git repo or git unavailable — use fallback
}

const timestamp = new Date()
	.toISOString()
	.replace(/[-:T]/g, "")
	.slice(0, 12); // YYYYMMDDHHmm

const version = `${timestamp}-${hash}`;

const outPath = "UI/pms-ui/src/environments/build-version.ts";
const content = `// Auto-generated at build time. Do not edit manually.\nexport const BUILD_VERSION = '${version}';\n`;

writeFileSync(outPath, content);
console.log(`[stamp-ui-version] Build version: ${version}`);
