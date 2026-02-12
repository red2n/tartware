#!/usr/bin/env node
// ---------------------------------------------------------------------------
// clean-all.mjs — pnpm-native workspace clean
//
// Uses `pnpm list -r --json` to discover every workspace package, then removes
// node_modules, dist, coverage, and other build artifacts from each one.
// Also prunes the pnpm content-addressable store of unreferenced packages.
// ---------------------------------------------------------------------------
import { execSync } from "node:child_process";
import { existsSync, rmSync, readdirSync, readFileSync } from "node:fs";
import { resolve, relative } from "node:path";
import process from "node:process";

const cwd = process.cwd();

/** Run a command, inheriting stdio. Returns true on success, false on failure. */
const run = (command, { optional = false } = {}) => {
  try {
    execSync(command, { stdio: "inherit", cwd });
    return true;
  } catch (error) {
    if (optional) {
      console.log(`[clean] Skipped (not available): ${command}`);
      return false;
    }
    console.error(`\n[clean] Command failed: ${command}`);
    throw error;
  }
};

/** Get human-readable size via `du -sh`. Returns null on failure. */
const getSize = (target) => {
  try {
    const out = execSync(`du -sh "${target}" 2>/dev/null`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return out.split(/\s+/)[0] ?? null;
  } catch {
    return null;
  }
};

/** Resolve an absolute path to a workspace-relative label. */
const toLabel = (abs) => {
  const rel = relative(cwd, abs);
  return rel.length === 0 ? "." : rel;
};

/**
 * Discover workspace packages via `pnpm list -r --json`.
 * Falls back to reading pnpm-workspace.yaml globs if node_modules is missing.
 * Returns an array of absolute directory paths (including the root).
 */
const discoverWorkspacePackages = () => {
  // Try the fast path first: pnpm list works even without node_modules
  // but may fail if pnpm itself isn't available or workspace is broken
  try {
    const json = execSync("pnpm list -r --depth -1 --json", {
      encoding: "utf8",
      cwd,
      stdio: ["ignore", "pipe", "ignore"],
    });
    const packages = JSON.parse(json);
    return packages.map((pkg) => pkg.path);
  } catch {
    // Fallback: scan workspace dirs from pnpm-workspace.yaml patterns
    console.log("[clean] pnpm list unavailable, scanning workspace dirs…");
    const paths = [cwd]; // always include root

    const wsFile = resolve(cwd, "pnpm-workspace.yaml");
    if (existsSync(wsFile)) {
      const content = readFileSync(wsFile, "utf8");
      // Parse simple glob patterns like 'Apps/*' and 'schema'
      const lines = content.match(/-\s*'([^']+)'/g) ?? [];
      for (const line of lines) {
        const match = line.match(/-\s*'([^']+)'/);
        if (!match) continue;
        const pattern = match[1];
        if (pattern.endsWith("/*")) {
          const dir = resolve(cwd, pattern.slice(0, -2));
          if (existsSync(dir)) {
            for (const entry of readdirSync(dir, { withFileTypes: true })) {
              if (entry.isDirectory()) paths.push(resolve(dir, entry.name));
            }
          }
        } else {
          const dir = resolve(cwd, pattern);
          if (existsSync(dir)) paths.push(dir);
        }
      }
    }
    return paths;
  }
};

// Per-package artifacts to remove
const PACKAGE_ARTIFACTS = ["node_modules", "dist", "coverage"];

// Root-only extras (resolved relative to workspace root)
const ROOT_EXTRAS = ["playwright-report", "docs/.buildinfo", "docs/_build"];

const main = () => {
  // 1 — Run Nx per-project `clean` targets (skipped if nx is not installed)
  console.log("[clean] Running workspace clean targets…");
  run("pnpm exec nx run-many -t clean", { optional: true });

  // 2 — Discover workspace packages dynamically
  const packagePaths = discoverWorkspacePackages();
  console.log(`[clean] Discovered ${packagePaths.length} workspace packages\n`);

  // 3 — Build removal map: path → { label, reportSkip }
  //     reportSkip = false for per-package dist/coverage (Nx handles those)
  const removalTargets = new Map();

  for (const pkgPath of packagePaths) {
    for (const artifact of PACKAGE_ARTIFACTS) {
      const abs = resolve(pkgPath, artifact);
      // Only report node_modules skips; dist/coverage are expected to be gone after Nx clean
      removalTargets.set(abs, {
        label: toLabel(abs),
        reportSkip: artifact === "node_modules",
      });
    }
  }

  for (const extra of ROOT_EXTRAS) {
    const abs = resolve(cwd, extra);
    removalTargets.set(abs, { label: extra, reportSkip: true });
  }

  // 4 — Remove everything that exists
  const removed = [];
  const skipped = [];

  console.log("[clean] Removing generated artifacts…");

  for (const [targetPath, { label, reportSkip }] of removalTargets) {
    if (!existsSync(targetPath)) {
      if (reportSkip) skipped.push(label);
      continue;
    }
    const size = getSize(targetPath);
    rmSync(targetPath, { recursive: true, force: true, maxRetries: 2 });
    removed.push({ label, size });
    console.log(`[clean] Removed ${label}${size ? ` (${size})` : ""}`);
  }

  // 5 — Prune unreferenced packages from the pnpm content-addressable store
  console.log("\n[clean] Pruning pnpm store…");
  run("pnpm store prune", { optional: true });

  // 6 — Summary
  console.log("\n[clean] Summary");
  if (removed.length > 0) {
    for (const { label, size } of removed) {
      console.log(`  • ${label}${size ? ` (${size})` : ""}`);
    }
  } else {
    console.log("  • No artifacts removed");
  }

  if (skipped.length > 0) {
    console.log("  Skipped (not found):");
    for (const label of skipped) {
      console.log(`    – ${label}`);
    }
  }

  console.log("\n[clean] Clean complete ✓");
};

main();
