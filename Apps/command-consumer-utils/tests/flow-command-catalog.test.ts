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

import { existsSync, readFileSync } from "node:fs";
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

describe("command handlers ↔ command catalog", () => {
  /**
   * The reverse of the flow-registry check above, and the direction nothing was
   * asserting. A service consumer dispatches on `case "<command>":`; if that
   * command has no catalog row the gateway answers 404 "not registered", so the
   * handler is unreachable no matter how complete it is.
   *
   * Eight commands were in exactly this state — inventory.lock.room,
   * inventory.release.room, inventory.release.bulk, rooms.key.issue,
   * rooms.key.revoke and the three operations.maintenance.* verbs — each with a
   * handler, a payload validator, and no way to be invoked.
   */
  const CONSUMERS = [
    "availability-guard-service/src/workers/command-center-consumer.ts",
    "housekeeping-service/src/commands/command-center-consumer.ts",
    "rooms-service/src/commands/command-center-consumer.ts",
    "guests-service/src/services/guest-command-service.ts",
    "notification-service/src/services/notification-command-service.ts",
  ];

  it("seeds a catalog entry for every command a consumer handles", () => {
    const catalog = readCatalog();
    const missing: string[] = [];
    let handled = 0;

    for (const relative of CONSUMERS) {
      const path = fileURLToPath(new URL(`../../${relative}`, import.meta.url));
      const source = readFileSync(path, "utf8");
      for (const match of source.matchAll(/case\s+"([a-z0-9_]+(?:\.[a-z0-9_]+)+)"\s*:/g)) {
        handled++;
        if (!catalog.has(match[1]!)) missing.push(`[${relative.split("/")[0]}] ${match[1]}`);
      }
    }

    // Guards against a consumer being renamed and this check going vacuous.
    expect(handled, "no `case \"command.name\":` handlers found — consumer layout changed").toBeGreaterThan(20);

    expect(
      [...new Set(missing)].sort(),
      `\nCommands with a handler but no catalog row — the gateway answers 404\n` +
        `"not registered", so the handler can never run:\n` +
        `${missing.map((m) => `  ✗ ${m}`).join("\n")}\n`,
    ).toEqual([]);
  });
});

describe("command catalog ↔ consumer target services", () => {
  /**
   * `shouldProcess` in the shared consumer utils drops any command whose
   * envelope `targetService` does not equal the consuming service's own
   * `targetServiceId`. So a catalog row naming a service that no consumer
   * claims produces a command the gateway accepts and dispatches, and that
   * every consumer then silently skips — no error, no DLQ entry.
   *
   * operations.maintenance.request was in this state: handler in
   * housekeeping-service, catalog row pointing at 'operations-command-service'.
   */
  /**
   * Catalogued commands that have no handler anywhere in Apps/, so there is no
   * consumer to claim their target service yet. They are inert rather than
   * mis-wired: the fix is to implement the handler (or drop the catalog row),
   * which is a product decision, not a wiring correction.
   *
   * Do not add a command here to silence this check — an entry means "not
   * built yet", and a command WITH a handler must never appear in this list.
   *
   * Three entries left on 2026-08-13 by deletion rather than implementation:
   * `compliance.breach.report`, `compliance.breach.notify` and
   * `operations.incident.report`. All three describe a write that already exists
   * as plain HTTP on the owning service — the breach register on core-service and
   * the incident register on housekeeping-service. Per ui-gaps/18-write-path-gap.md
   * a single-service, single-table write with no fan-out does not belong on the
   * command bus, so the catalog rows, payload schemas and validators went instead
   * of gaining handlers. Keeping them would have meant two write paths for one
   * table, one of which silently drops every message.
   */
  const UNIMPLEMENTED = new Set([
    "analytics.metric.ingest",
    "analytics.report.schedule",
    "operations.asset.update",
    "operations.inventory.adjust",
  ]);

  it("routes every command to a target service some consumer claims", () => {
    const sql = readFileSync(CATALOG_SQL, "utf8");
    const start = sql.indexOf("WITH seed_commands(");

    const claimed = new Set<string>();
    const configs = fileURLToPath(new URL("../../", import.meta.url));
    for (const relative of [
      "guests-service", "billing-service", "housekeeping-service", "rooms-service",
      "revenue-service", "notification-service", "core-service",
      "availability-guard-service", "reservations-command-service",
    ]) {
      const path = `${configs}${relative}/src/config.ts`;
      if (!existsSync(path)) continue;
      const source = readFileSync(path, "utf8");
      for (const m of source.matchAll(/buildCommandCenterConfig\(\s*"([a-z-]+)"/g)) claimed.add(m[1]!);
      // availability-guard-service builds the config inline rather than via the helper.
      for (const m of source.matchAll(/targetServiceId:\s*(?:[^,]*\?\?\s*)?"([a-z-]+)"/g)) claimed.add(m[1]!);
    }

    expect(claimed.size, "no target service ids found — config layout changed").toBeGreaterThan(5);

    const unclaimed = new Map<string, string[]>();
    for (const row of sql.slice(start).matchAll(
      /\(\s*'([a-z0-9_]+(?:\.[a-z0-9_]+)+)'\s*,\s*'[^']*'\s*,\s*'([a-z-]+)'/g,
    )) {
      const [, commandName, target] = row;
      if (!claimed.has(target!) && !UNIMPLEMENTED.has(commandName!)) {
        unclaimed.set(target!, [...(unclaimed.get(target!) ?? []), commandName!]);
      }
    }

    const summary = [...unclaimed.entries()]
      .map(([svc, cmds]) => `  ✗ "${svc}" — no consumer claims it; ${cmds.length} command(s) dropped: ${cmds.join(", ")}`)
      .join("\n");

    expect(
      [...unclaimed.keys()].sort(),
      `\nCommands routed to a target service no consumer claims. These are\n` +
        `accepted and dispatched, then silently discarded by shouldProcess():\n${summary}\n`,
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
