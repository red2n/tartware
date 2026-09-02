#!/usr/bin/env node
/**
 * Fail if a load-test script references something that does not exist.
 *
 * The load harness is the only part of this repo that nothing else compiles,
 * lints or runs in CI, and it rotted accordingly. T8 was recorded as "two
 * scripts post to a route the gateway does not serve". The truth was larger:
 * `loadtest/k6/services/` imported `TENANT_ID`, `PROPERTY_ID`,
 * `generateReservation`, `generateGuest`, `generatePayment` and
 * `generateHousekeepingTask` — six names no module has ever exported — so
 * those scripts threw on their first iteration and never reached the HTTP
 * layer they were reported as failing at. 23 `ENDPOINTS.*` keys were undefined
 * too, which puts the string "undefined" in the URL.
 *
 * None of it failed loudly, because nobody ran them; the two scenarios in
 * regular use were fine, so the harness looked healthy. This is the cheapest
 * thing that would have caught it.
 *
 * Two checks:
 *   1. Every named import from lib/ resolves to a real export.
 *   2. Every `ENDPOINTS.x` is a key of ENDPOINTS.
 *
 * Deliberately static: k6 scripts need a running gateway and a seeded database
 * to execute, which is exactly why they are never run casually. A parse-level
 * check needs neither.
 */
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOT = "loadtest/k6";
const LIB = join(ROOT, "lib");

/**
 * Endpoint keys referenced by scripts that were never wired up.
 *
 * These are aspirational reads across eight service scenarios — a route each
 * for allotments, packages, seasons, and so on — and defining them means
 * verifying each against the gateway one at a time, which is its own task.
 * The list may only **shrink**: an entry that becomes defined is reported as
 * stale, so this cannot quietly grow back. Same ratchet as KNOWN_UNTYPED in
 * check-schema-first-tables.mjs.
 */
const KNOWN_UNDEFINED_ENDPOINTS = new Set([
  "allotments", "bookingSources", "cancellationPolicies", "channelMappings",
  "companies", "depositPolicies", "folios", "guestCommunications",
  "guestPreferences", "housekeepingTasks", "incidentReports", "invoices",
  "maintenanceRequests", "marketSegments", "meetingRooms", "packages",
  "ratePlans", "recommendations", "recommendationsRank", "seasons",
  "taxConfigurations", "waitlist",
]);

const walk = (dir) =>
  readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : full.endsWith(".js") ? [full] : [];
  });

/** Every `export function|const|let|class X` in a lib module. */
const exportsOf = (file) =>
  new Set(
    [...readFileSync(file, "utf8").matchAll(/export\s+(?:function|const|let|class)\s+(\w+)/g)].map(
      (m) => m[1],
    ),
  );

const libExports = new Map(
  readdirSync(LIB)
    .filter((f) => f.endsWith(".js"))
    .map((f) => [f.replace(/\.js$/, ""), exportsOf(join(LIB, f))]),
);

const config = readFileSync(join(LIB, "config.js"), "utf8");
const endpointKeys = new Set(
  [...config.slice(config.indexOf("export const ENDPOINTS")).matchAll(/^\t(\w+):/gm)].map(
    (m) => m[1],
  ),
);

const unresolvedImports = [];
const undefinedEndpoints = new Map();

for (const file of walk(ROOT)) {
  const source = readFileSync(file, "utf8");

  for (const match of source.matchAll(/import\s*\{([^}]+)\}\s*from\s*["']([^"']*lib\/(\w+)\.js)["']/g)) {
    const available = libExports.get(match[3]);
    if (!available) continue;
    for (const raw of match[1].split(",")) {
      // `x as y` imports x; the local alias is not what has to exist.
      const name = raw.trim().split(/\s+as\s+/)[0].trim();
      if (name && !available.has(name)) {
        unresolvedImports.push({ file, name, module: `${match[3]}.js` });
      }
    }
  }

  for (const match of source.matchAll(/ENDPOINTS\.(\w+)/g)) {
    if (endpointKeys.has(match[1])) continue;
    if (!undefinedEndpoints.has(match[1])) undefinedEndpoints.set(match[1], new Set());
    undefinedEndpoints.get(match[1]).add(file);
  }
}

// A syntax error in a k6 script is invisible until someone runs it against a
// live stack, which is rare enough that these files drifted for months.
// `node --check` parses ES module syntax without resolving any import, so it
// costs nothing and needs no gateway.
const unparseable = [];
for (const file of walk(ROOT)) {
  const result = spawnSync(process.execPath, ["--check", "--input-type=module"], {
    input: readFileSync(file, "utf8"),
    encoding: "utf8",
  });
  if (result.status !== 0) {
    unparseable.push({ file, error: (result.stderr ?? "").split("\n").find((l) => l.includes("Error")) ?? "parse failed" });
  }
}

const failures = [];

if (unparseable.length > 0) {
  failures.push(
    "Load-test script does not parse:\n\n" +
      unparseable.map(({ file, error }) => `  ${file}\n    ${error.trim()}`).join("\n"),
  );
}

if (unresolvedImports.length > 0) {
  failures.push(
    "Load-test script imports a name that does not exist:\n\n" +
      unresolvedImports
        .map(({ file, name, module }) => `  ${file}  imports { ${name} } from ${module}`)
        .join("\n") +
      `\n\n  A missing named import is \`undefined\` at runtime, so the script dies on\n` +
      `  its first iteration rather than reporting a failed request. Export it from\n` +
      `  the lib module, or import the name that is actually there — config.js\n` +
      `  exports TENANT_IDS / PROPERTY_IDS / ROOM_TYPE_IDS (parsed arrays), never\n` +
      `  the singular scalars.`,
  );
}

const newlyUndefined = [...undefinedEndpoints.keys()].filter(
  (key) => !KNOWN_UNDEFINED_ENDPOINTS.has(key),
);
if (newlyUndefined.length > 0) {
  failures.push(
    "Load-test script uses an ENDPOINTS key that is not defined:\n\n" +
      newlyUndefined
        .map(
          (key) =>
            `  ENDPOINTS.${key}  (${[...undefinedEndpoints.get(key)]
              .map((f) => f.split("/").pop())
              .join(", ")})`,
        )
        .join("\n") +
      `\n\n  An undefined key puts the string "undefined" in the URL and the request\n` +
      `  404s. Add it to ENDPOINTS in loadtest/k6/lib/config.js, verified against a\n` +
      `  route the gateway actually registers.`,
  );
}

const staleAllowances = [...KNOWN_UNDEFINED_ENDPOINTS].filter(
  (key) => !undefinedEndpoints.has(key),
);
if (staleAllowances.length > 0) {
  failures.push(
    "These ENDPOINTS keys are defined (or no longer used) and should leave\n" +
      "KNOWN_UNDEFINED_ENDPOINTS, so the list keeps reflecting the real debt:\n\n" +
      staleAllowances.map((key) => `  ${key}`).join("\n"),
  );
}

if (failures.length > 0) {
  console.error(`\n${failures.join("\n\n")}\n`);
  process.exit(1);
}

const scripts = walk(ROOT).length;
console.log(
  `Load-test wiring OK — ${scripts} scripts, ${endpointKeys.size} endpoints, ` +
    `${KNOWN_UNDEFINED_ENDPOINTS.size} known-undefined (may only shrink).`,
);
