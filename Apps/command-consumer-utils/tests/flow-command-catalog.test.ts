/**
 * Flow registry ↔ command catalog conformance.
 *
 * `validateFlowCompliance` proves every flow requirement has a *handler*. It
 * says nothing about whether the command can be *dispatched*: the gateway
 * resolves commands through `command_templates`, seeded from
 * scripts/tables/01-core/10_command_center.sql. A command with a handler and a
 * manifest claim but no catalog row is unreachable — the gateway answers
 * "Command <name> is not registered" (404) while compliance reports green.
 *
 * This test closes that gap by asserting the catalog covers every command the
 * flow registry requires.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import {
  ALL_FLOW_IDS,
  FLOW_REGISTRY,
  MODULE_IDS,
  registeredCommandNames,
} from "@tartware/schemas";
import { describe, expect, it } from "vitest";

const CATALOG_SQL = fileURLToPath(
  new URL("../../../scripts/tables/01-core/10_command_center.sql", import.meta.url),
);

/**
 * Command names seeded into command_templates.
 *
 * The seed is a `WITH seed_commands(...) AS (VALUES ...)` CTE whose rows look
 * like `('command.name', 'description', 'service', ARRAY['module'])`. Matching
 * the leading quoted identifier of each row is enough — descriptions and
 * service names never occupy the first position.
 */
const readCatalog = (): Set<string> => {
  const sql = readFileSync(CATALOG_SQL, "utf8");
  const start = sql.indexOf("WITH seed_commands(");
  expect(start, "seed_commands CTE not found — catalog seed layout changed").toBeGreaterThan(-1);

  const names = new Set<string>();
  for (const match of sql.slice(start).matchAll(/\(\s*'([a-z0-9_]+(?:\.[a-z0-9_]+)+)'\s*,/g)) {
    names.add(match[1]!);
  }
  return names;
};

describe("flow registry ↔ command catalog", () => {
  const catalog = readCatalog();

  it("seeds a catalog entry for every command the flow registry requires", () => {
    const missing: string[] = [];
    for (const flowId of ALL_FLOW_IDS) {
      const requirement = FLOW_REGISTRY[flowId];
      for (const commandName of requirement.requiredCommands) {
        if (!catalog.has(commandName)) {
          missing.push(`[${requirement.name}] ${commandName}`);
        }
      }
    }

    expect(
      missing,
      `\nThese commands are required by a flow and have handlers, but are absent from\n` +
        `the command catalog, so the gateway cannot route them (404 "not registered"):\n` +
        `${missing.map((m) => `  ✗ ${m}`).join("\n")}\n`,
    ).toEqual([]);
  });

  it("parsed a plausible catalog", () => {
    // Guards against a silent regex/layout break making the check vacuous.
    expect(catalog.size).toBeGreaterThan(100);
    expect(catalog.has("reservation.create")).toBe(true);
  });
});

describe("command catalog ↔ payload validators", () => {
  const catalog = readCatalog();

  /**
   * The gateway calls validateCommandPayload before dispatch, and that throws
   * for any command without a registered validator — so a catalogued command
   * with no validator is routable but permanently rejected
   * (400 COMMAND_PAYLOAD_INVALID). `registeredCommandNames` is exported for
   * exactly this parity assertion; nothing was making it.
   */
  it("registers a payload validator for every catalogued command", () => {
    const missing = [...catalog].filter((name) => !registeredCommandNames.has(name)).sort();

    expect(
      missing,
      `\nCatalogued commands with no payload validator — these dispatch but always\n` +
        `fail with COMMAND_PAYLOAD_INVALID:\n${missing.map((m) => `  ✗ ${m}`).join("\n")}\n`,
    ).toEqual([]);
  });
});

describe("command catalog ↔ module registry", () => {
  /**
   * Commands are gated on `required_modules`. The gateway rejects a command
   * whose module a tenant has not enabled — and a module id absent from
   * MODULE_IDS can never be enabled by anyone, so the command is permanently
   * dead behind 403 COMMAND_MODULES_NOT_ENABLED.
   *
   * This regressed silently once already: revenue-management (32 commands),
   * loyalty (4) and distribution (3) were gated on unregistered modules.
   */
  it("gates every command on a module that actually exists", () => {
    const sql = readFileSync(CATALOG_SQL, "utf8");
    const start = sql.indexOf("WITH seed_commands(");
    const known = new Set<string>(MODULE_IDS);

    const offenders = new Map<string, string[]>();
    for (const row of sql.slice(start).matchAll(
      /\(\s*'([a-z0-9_]+(?:\.[a-z0-9_]+)+)'\s*,[^)]*?ARRAY\[([^\]]*)\]/g,
    )) {
      const commandName = row[1]!;
      for (const mod of row[2]!.matchAll(/'([a-z0-9-]+)'/g)) {
        const moduleId = mod[1]!;
        if (!known.has(moduleId as (typeof MODULE_IDS)[number])) {
          offenders.set(moduleId, [...(offenders.get(moduleId) ?? []), commandName]);
        }
      }
    }

    const summary = [...offenders.entries()]
      .map(([mod, cmds]) => `  ✗ "${mod}" is not in MODULE_IDS — ${cmds.length} command(s) dead`)
      .join("\n");

    expect(
      [...offenders.keys()].sort(),
      `\nCommands gated on unregistered modules (403 for every tenant, forever):\n${summary}\n`,
    ).toEqual([]);
  });
});
