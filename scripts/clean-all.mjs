#!/usr/bin/env node
import { execSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { resolve, relative } from "node:path";
import process from "node:process";

const cwd = process.cwd();

const run = (command, options = {}) => {
  try {
    execSync(command, { stdio: "inherit", ...options });
  } catch (error) {
    console.error(`\n[clean] Command failed: ${command}`);
    throw error;
  }
};

const runCapture = (command) =>
  execSync(command, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });

const getSize = (target) => {
  try {
    const sizeOutput = execSync(`du -sh "${target}" 2>/dev/null`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return sizeOutput.split(/\s+/)[0] ?? null;
  } catch {
    return null;
  }
};

const toRelative = (target) => {
  const rel = relative(cwd, target);
  return rel.length === 0 ? "." : rel;
};

const main = async () => {
  console.log("[clean] Running workspace clean scripts…");
  run("npx nx run-many -t clean");

  console.log("[clean] Deriving workspace list…");
  const nxProjects = runCapture("npx nx show projects --json");
  const projectNames = JSON.parse(nxProjects);

  const removalTargets = new Map();

  // Root artifacts
  [
    "node_modules",
    "dist",
    "coverage",
    "playwright-report",
    "docs/.buildinfo",
    "docs/_build",
  ].forEach((item) => removalTargets.set(resolve(cwd, item), { label: item }));

  // Workspace node_modules
  const workspaceDirs = ["Apps", "schema", "UI"];
  for (const dir of workspaceDirs) {
    const dirPath = resolve(cwd, dir);
    if (!existsSync(dirPath)) continue;
    const { readdirSync } = await import("node:fs");
    if (dir === "schema") {
      const nmPath = resolve(dirPath, "node_modules");
      removalTargets.set(nmPath, { label: toRelative(nmPath) });
    } else {
      for (const entry of readdirSync(dirPath, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const nmPath = resolve(dirPath, entry.name, "node_modules");
        removalTargets.set(nmPath, { label: toRelative(nmPath) });
      }
    }
  }

  const removed = [];
  const skipped = [];

  console.log("[clean] Removing generated artifacts…");

  removalTargets.forEach((info, targetPath) => {
    if (!existsSync(targetPath)) {
      skipped.push(info.label);
      return;
    }

    const size = getSize(targetPath);
    rmSync(targetPath, { recursive: true, force: true, maxRetries: 2 });
    removed.push({ label: info.label, size });
    console.log(
      `[clean] Removed ${info.label}${size ? ` (${size})` : ""}`,
    );
  });

  console.log("\n[clean] Summary");
  if (removed.length > 0) {
    removed.forEach(({ label, size }) => {
      console.log(`  • ${label}${size ? ` (${size})` : ""}`);
    });
  } else {
    console.log("  • No artifacts removed");
  }

  if (skipped.length > 0) {
    console.log("  Skipped (not found):");
    skipped.forEach((label) => console.log(`    – ${label}`));
  }

  console.log("\n[clean] Clean complete");
};

main();
