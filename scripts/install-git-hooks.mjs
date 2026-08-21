#!/usr/bin/env node
/**
 * Point git at the repo's versioned hooks directory.
 *
 * `.git/hooks` is not tracked, so a hook committed there reaches exactly one
 * machine. Setting `core.hooksPath` to a directory that IS tracked means the
 * hook travels with the repo and a fresh clone picks it up on first install.
 *
 * Wired to `prepare`, so `pnpm install` is the only step. Idempotent, and
 * silent about anything it cannot do: a missing git dir or a CI checkout is a
 * reason to skip, never a reason to fail an install.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const HOOKS_DIR = ".githooks";

const git = (...args) =>
  spawnSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });

// CI checks out fresh and runs the checks directly; hooks would only slow it.
if (process.env.CI) process.exit(0);

if (git("rev-parse", "--git-dir").status !== 0) process.exit(0);

if (!fs.existsSync(path.join(process.cwd(), HOOKS_DIR))) process.exit(0);

const current = git("config", "--get", "core.hooksPath").stdout.trim();
if (current === HOOKS_DIR) process.exit(0);

if (git("config", "core.hooksPath", HOOKS_DIR).status === 0) {
  console.log(`git hooks enabled (core.hooksPath=${HOOKS_DIR}) — bypass a run with 'git push --no-verify'`);
}
