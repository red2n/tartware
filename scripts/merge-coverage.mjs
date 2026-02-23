#!/usr/bin/env node

/**
 * Merge per-service lcov.info files into a single aggregate report.
 *
 * Usage:
 *   pnpm run test:coverage          # run all service tests with coverage
 *   pnpm run test:coverage:merge    # merge lcov files into coverage/lcov.info
 *
 * The merged lcov.info can be consumed by CI tools, Codecov, SonarQube, etc.
 */

import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { join, relative } from "node:path";
import { existsSync } from "node:fs";

const ROOT = new URL("..", import.meta.url).pathname;
const APPS_DIR = join(ROOT, "Apps");
const SCHEMA_DIR = join(ROOT, "schema");
const OUTPUT_DIR = join(ROOT, "coverage");
const OUTPUT_FILE = join(OUTPUT_DIR, "lcov.info");

/** Directories that may contain coverage/lcov.info */
async function findLcovFiles() {
  const lcovFiles = [];

  // Check Apps/*/coverage/lcov.info
  const appDirs = await readdir(APPS_DIR, { withFileTypes: true });
  for (const entry of appDirs) {
    if (!entry.isDirectory()) continue;
    const lcovPath = join(APPS_DIR, entry.name, "coverage", "lcov.info");
    if (existsSync(lcovPath)) {
      lcovFiles.push({ path: lcovPath, prefix: `Apps/${entry.name}` });
    }
  }

  // Check schema/coverage/lcov.info
  const schemaLcov = join(SCHEMA_DIR, "coverage", "lcov.info");
  if (existsSync(schemaLcov)) {
    lcovFiles.push({ path: schemaLcov, prefix: "schema" });
  }

  return lcovFiles;
}

/**
 * Rewrite source file paths in lcov data so they are relative to the monorepo root.
 * lcov `SF:` lines contain paths relative to the service directory.
 */
function rewritePaths(lcovContent, servicePrefix) {
  return lcovContent.replace(/^SF:(.+)$/gm, (_match, filePath) => {
    // If path is already absolute, make it relative to ROOT
    if (filePath.startsWith("/")) {
      return `SF:${relative(ROOT, filePath)}`;
    }
    // Otherwise prefix with the service path
    return `SF:${servicePrefix}/${filePath}`;
  });
}

async function main() {
  const lcovFiles = await findLcovFiles();

  if (lcovFiles.length === 0) {
    console.log("No coverage/lcov.info files found. Run `pnpm run test:coverage` first.");
    process.exit(0);
  }

  console.log(`Found ${lcovFiles.length} coverage report(s):`);

  const parts = [];
  for (const { path: lcovPath, prefix } of lcovFiles) {
    const content = await readFile(lcovPath, "utf8");
    const rewritten = rewritePaths(content.trim(), prefix);
    parts.push(rewritten);
    const sfCount = (rewritten.match(/^SF:/gm) || []).length;
    console.log(`  ${prefix}: ${sfCount} source file(s)`);
  }

  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(OUTPUT_FILE, parts.join("\n") + "\n", "utf8");

  const totalSf = parts.reduce(
    (sum, part) => sum + (part.match(/^SF:/gm) || []).length,
    0,
  );
  console.log(`\nMerged → ${relative(ROOT, OUTPUT_FILE)} (${totalSf} total source files)`);
}

main().catch((err) => {
  console.error("Coverage merge failed:", err);
  process.exit(1);
});
