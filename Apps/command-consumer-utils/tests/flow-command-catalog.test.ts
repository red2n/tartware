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

import { existsSync, readdirSync, readFileSync } from "node:fs";
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
   *
   * The inventory.* and operations.maintenance.* entries above are historical:
   * both sets were retired on 2026-08-18 (gRPC and plain HTTP respectively were
   * already the live paths), and availability-guard-service's consumer went with
   * them — it handled nothing else. See ui-gaps/17-command-reachability.md.
   */
  const CONSUMERS = [
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
    // Floor lowered from 20 to 15 on 2026-08-18: retiring inventory.* (3) and
    // operations.maintenance.* (4) took the real count from 26 to 19. The floor
    // is a vacuity guard, not an assertion about how many commands should exist.
    expect(handled, "no `case \"command.name\":` handlers found — consumer layout changed").toBeGreaterThan(15);

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

/**
 * Flow registry ↔ dispatchability.
 *
 * The checks above prove a required command has a handler and a catalog row.
 * Neither asks the question that actually matters: can anything *send* it?
 *
 * A flow that lists a command nobody dispatches is a manifest describing an
 * architecture the product does not have. COV-05 made this point about
 * `revenue.daily_close.process`; the 2026-08-18 reachability pass found twelve.
 * See ui-gaps/17-command-reachability.md.
 *
 * **Detection is deliberately permissive.** It counts a command as dispatchable
 * if its name appears as a literal anywhere in the gateway, in a UI
 * `commands/<name>` path, or in a job/consumer dispatch. That will over-credit a
 * name mentioned only in a comment — and that is the right way to be wrong here.
 * The forms this has to survive are hostile to exact matching: a `commandName:`
 * built with a ternary, a wrapper factory taking the name as an argument, and a
 * UI template literal. An exact matcher produced three false "unreachable"
 * verdicts on its first run, and a test that cries wolf is worse than none —
 * the same lesson the 2026-08-13 enum sweep recorded.
 */
describe("flow registry ↔ dispatchability", () => {
  const ROOT = fileURLToPath(new URL("../../../", import.meta.url));

  /**
   * Known-unreachable, each owned by a spec. This list must only ever shrink;
   * the test below fails if an entry becomes reachable and is not removed.
   */
  const KNOWN_UNREACHABLE = new Set<string>([
    // ui-gaps/05-revenue-module-status.md — blocked on the build-or-retire call.
    "revenue.daily_close.process",
    "revenue.pricing_rule.create",
    "revenue.pricing_rule.update",
    "revenue.pricing_rule.activate",
    "revenue.pricing_rule.deactivate",
    "billing.pricing.evaluate",
    // accounts-gaps/ + ui-gaps/12-billing-partials.md
    "billing.ar.post",
    "billing.payment.authorize",
    // ui-gaps/17-command-reachability.md — (c) retire: the guest portal reaches
    // mobile check-in over REST on guests-service, so the flow declares a path
    // the product does not use.
    // ui-gaps/17 — (a) needs UI.
    "reservation.generate_registration_card",
    "rooms.move",
  ]);

  const COMMAND_LITERAL = /"([a-z_]+\.[a-z_.]+)"/g;
  const UI_DISPATCH = /commands\/([a-z_]+\.[a-z_.]+)/g;
  const UI_DYNAMIC = /commands\/([a-z_.]+)\$\{/g;

  const walk = (dir: string, out: string[] = []): string[] => {
    if (!existsSync(dir)) return out;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules" || entry.name === "dist") continue;
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory()) walk(path, out);
      else if (/\.(ts|html)$/.test(path) && !path.endsWith(".d.ts")) out.push(path);
    }
    return out;
  };

  const dispatchable = (): { names: Set<string>; prefixes: string[] } => {
    const names = new Set<string>();
    const prefixes: string[] = [];

    for (const file of walk(`${ROOT}Apps/api-gateway/src`)) {
      // The gateway's flow manifest names commands to declare the *gates* in
      // front of them, not a way to send them. Counting those literals credited
      // five write-off and reopen commands with a dispatch path they do not
      // have — the permissiveness this scanner accepts everywhere else becomes
      // a false negative here, because the file exists to talk about commands.
      if (file.endsWith("/flow-manifest.ts")) continue;
      for (const m of readFileSync(file, "utf8").matchAll(COMMAND_LITERAL)) names.add(m[1]!);
    }
    for (const app of ["UI/pms-ui/src", "UI/guest-portal/src"]) {
      for (const file of walk(`${ROOT}${app}`)) {
        const src = readFileSync(file, "utf8");
        for (const m of src.matchAll(UI_DISPATCH)) names.add(m[1]!);
        for (const m of src.matchAll(UI_DYNAMIC)) prefixes.push(m[1]!);
      }
    }
    for (const file of walk(`${ROOT}Apps`)) {
      if (!/\/(jobs|consumers)\//.test(file)) continue;
      const src = readFileSync(file, "utf8");
      for (const m of src.matchAll(/(?:commandName:\s*|dispatchCommand\(\s*)"([a-z_]+\.[a-z_.]+)"/g)) {
        names.add(m[1]!);
      }
    }
    return { names, prefixes };
  };

  const { names, prefixes } = dispatchable();
  const canSend = (command: string): boolean =>
    names.has(command) || prefixes.some((p) => command.startsWith(p));

  const required = [
    ...new Set(ALL_FLOW_IDS.flatMap((id) => [...FLOW_REGISTRY[id]!.requiredCommands])),
  ].sort();

  it("found the dispatch sites it is meant to be scanning", () => {
    // A walk that silently returned nothing would make this suite vacuously green.
    expect(names.size).toBeGreaterThan(50);
    expect(required.length).toBeGreaterThan(5);
  });

  it("can dispatch every command a flow declares as required", () => {
    const unreachable = required.filter((c) => !canSend(c) && !KNOWN_UNREACHABLE.has(c));

    expect(
      unreachable,
      `\nFlows declare these commands as required, but nothing can send them:\n` +
        unreachable.map((c) => `  ✗ ${c}`).join("\n") +
        `\n\nEither wire a dispatch path (gateway wrapper, UI dispatch or job), drop\n` +
        `the command from the flow's requiredCommands, or add it to\n` +
        `KNOWN_UNREACHABLE with the spec that owns it.\n`,
    ).toEqual([]);
  });

  it("keeps KNOWN_UNREACHABLE honest, so the list shrinks as commands are wired", () => {
    const stale = [...KNOWN_UNREACHABLE].filter((c) => canSend(c)).sort();

    expect(
      stale,
      `\nThese are dispatchable now — delete them from KNOWN_UNREACHABLE:\n` +
        stale.map((c) => `  ✓ ${c}`).join("\n") + `\n`,
    ).toEqual([]);
  });
});
