#!/usr/bin/env node
/**
 * Fail if any Nx project is missing a quality guardrail target.
 *
 * `nx run-many -t biome` only runs projects that *have* a `biome` target and
 * reports success for the rest by omission — so a project added without one is
 * invisible: `pnpm run check` passes while that code is never inspected. That
 * is how UI/pms-ui and UI/guest-portal went unchecked. This closes the loop by
 * asserting coverage rather than inferring it from a green run.
 *
 * Exemptions must be explicit and justified below, never silent.
 */
import { spawnSync } from "node:child_process";

/** Targets every project is expected to expose. */
const REQUIRED_TARGETS = ["biome", "knip"];

/**
 * Projects allowed to skip a target, with the reason.
 * `lint` (ESLint) is intentionally not required: the Angular projects have no
 * ESLint setup and Biome is their linter.
 */
const EXEMPTIONS = {
  // project name -> { target: reason }
};

const show = (args) =>
  JSON.parse(
    spawnSync("npx", ["nx", "show", ...args], {
      encoding: "utf8",
      shell: process.platform === "win32",
    }).stdout.trim(),
  );

const allProjects = show(["projects", "--json"]);
const failures = [];

for (const target of REQUIRED_TARGETS) {
  const covered = new Set(show(["projects", "--with-target", target, "--json"]));
  for (const project of allProjects) {
    if (covered.has(project)) continue;
    const reason = EXEMPTIONS[project]?.[target];
    if (reason) {
      console.log(`· ${project} exempt from "${target}": ${reason}`);
      continue;
    }
    failures.push({ project, target });
  }
}

if (failures.length > 0) {
  console.error("\nMissing guardrail targets:\n");
  for (const { project, target } of failures) {
    console.error(`  ${project} has no "${target}" target`);
  }
  console.error(
    `\nAdd the target (see UI/pms-ui/project.json for the Angular pattern, or a\n` +
      `package.json "scripts" entry for the Node packages), together with the\n` +
      `matching ${REQUIRED_TARGETS.map((t) => `${t}.json`).join(" / ")} config.\n` +
      `If the project genuinely should not be checked, add it to EXEMPTIONS in\n` +
      `${"scripts/check-guardrail-coverage.mjs"} with a reason.\n`,
  );
  process.exit(1);
}

console.log(
  `Guardrail coverage OK — ${allProjects.length} projects, all with: ${REQUIRED_TARGETS.join(", ")}`,
);
