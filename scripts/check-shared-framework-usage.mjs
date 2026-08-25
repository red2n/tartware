#!/usr/bin/env node
/**
 * Fail if service code hand-rolls something a shared framework already owns.
 *
 * A shared package only pays off when every service actually goes through it.
 * KafkaJS clients drifted exactly this way: `@tartware/command-consumer-utils`
 * exposed `createKafkaClient()`, two services used it, and five others called
 * `new Kafka(...)` directly — which is how unformatted KafkaJS JSON ended up
 * interleaved with the pino output. A convention nobody checks is a convention
 * the next change forgets, so this asserts it instead.
 *
 * Add a rule here whenever a shared entry point becomes the only right way to
 * do something. Keep `allow` lists tight and justified.
 */
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

/**
 * @typedef {object} FrameworkRule
 * @property {string} id            Short slug, shown on failure.
 * @property {RegExp} pattern       Matched per line against tracked TypeScript sources.
 * @property {string[]} allow       Exact repo-relative paths (or path prefixes) permitted to match.
 * @property {string} use           The shared entry point callers must go through instead.
 * @property {string} why           Why the shared entry point exists — the cost of bypassing it.
 * @property {(line: string) => boolean} [ignore]  Lines that match the pattern but are fine.
 */

/** Type-only imports pull no runtime code, so they never bypass a framework. */
const isTypeOnlyImport = (line) => {
  const trimmed = line.trim();
  if (/^import\s+type\s/.test(trimmed)) return true;
  const braces = trimmed.match(/^import\s*\{([^}]*)\}/);
  if (!braces) return false;
  return braces[1]
    .split(",")
    .map((specifier) => specifier.trim())
    .filter(Boolean)
    .every((specifier) => specifier.startsWith("type "));
};

/** @type {FrameworkRule[]} */
const RULES = [
  {
    id: "kafka-client",
    pattern: /\bnew Kafka\s*\(/,
    allow: ["Apps/command-consumer-utils/src/producer.ts"],
    use: 'createKafkaClient() from "@tartware/command-consumer-utils/producer"',
    why:
      "the factory routes KafkaJS' own logs through the service logger; a raw client " +
      "prints unformatted JSON to stdout and skips redaction and OTLP export",
  },
  {
    id: "actor-resolution",
    pattern: /\bconst resolveActorId\s*=|\bconst SYSTEM_ACTOR(_ID)?\s*=/,
    // command-utils re-exports the sentinel; @tartware/config defines it, and cannot
    // import from command-consumer-utils (which depends on config) without a cycle.
    allow: ["Apps/command-consumer-utils/src/command-utils.ts", "Apps/config/src/audit.ts"],
    use: 'resolveActorId() / SYSTEM_ACTOR_ID from "@tartware/command-consumer-utils/command-utils"',
    why:
      "local copies skipped UUID validation and fell back to strings like \"COMMAND_CENTER\", " +
      "which Postgres rejects on the UUID audit columns (22P02) and which disagree with the " +
      "seeded system.actor row every other service writes",
  },
  {
    id: "command-error",
    pattern: /class \w*(Command|Event)Error extends Error\b/,
    allow: ["Apps/command-consumer-utils/src/command-utils.ts"],
    use: 'a subclass of CommandError from "@tartware/command-consumer-utils/command-utils"',
    why:
      "the consumer's retry predicate reads `retryable` off the error; a command error that " +
      "extends bare Error has no such field, so a deterministic rejection is retried through " +
      "the whole backoff ladder and stalls its partition before reaching the DLQ anyway",
  },
  {
    id: "pino-logger",
    pattern: /from ["']pino["']|require\(["']pino["']\)/,
    allow: ["Apps/telemetry/src/", "Apps/candidate-pipeline/src/__tests__/"],
    use: 'createServiceLogger() from "@tartware/telemetry"',
    why:
      "the shared logger owns level/pretty env handling, redaction of sensitive keys " +
      "and the OTLP log stream; a bare pino instance has none of it",
    ignore: isTypeOnlyImport,
  },
];

const isAllowed = (file, rule) =>
  rule.allow.some((entry) => (entry.endsWith("/") ? file.startsWith(entry) : file === entry));

const tracked = spawnSync("git", ["ls-files", "Apps/*/src/**/*.ts", "Apps/*/src/*.ts"], {
  encoding: "utf8",
})
  .stdout.split("\n")
  .filter((file) => file.endsWith(".ts") && !file.endsWith(".d.ts"));

const violations = [];

for (const file of tracked) {
  let source;
  try {
    source = readFileSync(file, "utf8");
  } catch {
    continue; // deleted but still indexed
  }

  const lines = source.split("\n");
  for (const rule of RULES) {
    if (isAllowed(file, rule)) continue;
    lines.forEach((line, index) => {
      if (line.trimStart().startsWith("*")) return; // doc comment referencing the pattern
      if (rule.ignore?.(line)) return;
      if (rule.pattern.test(line)) {
        violations.push({ file, line: index + 1, rule, source: line.trim() });
      }
    });
  }
}

// A workspace import that the package does not declare resolves locally through
// pnpm's store but not in a clean CI install, where it surfaces as an
// unresolvable type and a wall of no-unsafe-* lint errors far from the cause.
// Adding an import without the dependency is easy to do and hard to read back,
// so it is asserted here.
const undeclared = [];
for (const file of tracked) {
  const pkgDir = file.split("/").slice(0, 2).join("/");
  let meta;
  try {
    meta = JSON.parse(readFileSync(`${pkgDir}/package.json`, "utf8"));
  } catch {
    continue;
  }
  const declared = new Set([
    ...Object.keys(meta.dependencies ?? {}),
    ...Object.keys(meta.devDependencies ?? {}),
    meta.name,
  ]);
  let source;
  try {
    source = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  for (const match of source.matchAll(/from ["'](@tartware\/[a-z0-9-]+)/g)) {
    if (!declared.has(match[1])) {
      undeclared.push({ file, pkg: meta.name, dep: match[1] });
    }
  }
}

if (undeclared.length > 0) {
  console.error("\nWorkspace import without a declared dependency:\n");
  const seen = new Set();
  for (const { file, pkg, dep } of undeclared) {
    const key = `${pkg} ${dep}`;
    if (seen.has(key)) continue;
    seen.add(key);
    console.error(`  ${pkg} imports ${dep} (e.g. ${file})`);
  }
  console.error(
    `\nAdd it to that package's dependencies as "workspace:*", run pnpm install, and\n` +
      `list it in the package's knip.json "ignoreDependencies" (knip cannot resolve\n` +
      `workspace links). Without this it builds locally and fails on a clean CI install.\n`,
  );
  process.exit(1);
}

if (violations.length > 0) {
  console.error("\nShared framework bypassed:\n");
  for (const { file, line, rule, source } of violations) {
    console.error(`  ${file}:${line}  [${rule.id}]`);
    console.error(`    ${source}`);
    console.error(`    use ${rule.use}`);
    console.error(`    why: ${rule.why}\n`);
  }
  console.error(
    `If a call site genuinely cannot use the shared entry point, add it to the\n` +
      `rule's "allow" list in scripts/check-shared-framework-usage.mjs with a reason.\n`,
  );
  process.exit(1);
}

console.log(
  `Shared framework usage OK — ${tracked.length} files, ${RULES.length} rules: ` +
    `${RULES.map((rule) => rule.id).join(", ")}`,
);
