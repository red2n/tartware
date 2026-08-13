/**
 * `withTenantScope({ requiredModules })` ↔ module registry conformance.
 *
 * `createTenantScopeGuard` answers 403 TENANT_MODULE_NOT_ENABLED for any module
 * id absent from the membership's enabled set. A tenant can only enable ids in
 * MODULE_IDS, so a route gated on an id outside that list is 403 for every
 * tenant, forever — the route ships, passes typecheck, and is unreachable.
 *
 * That is exactly what happened to the incident write path: POST /v1/incidents,
 * PUT /v1/incidents/:id and POST /v1/incidents/:id/status all gated on
 * "housekeeping", which is not a module — while the reads beside them in the
 * same file correctly used "facility-maintenance". The gateway's
 * `ALL /v1/incidents/*` carried the same id, so the by-id read 403ed too. The
 * E2E sweep only smoke-tests the bare list, so it stayed green throughout.
 * See ui-gaps/06-incidents.md.
 *
 * This is the same defect class as ui-gaps/19-gateway-proxy-mismatches.md: a
 * documented capability with nothing reachable behind it.
 */

import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { MODULE_IDS } from "@tartware/schemas";
import { describe, expect, it } from "vitest";

const APPS_DIR = fileURLToPath(new URL("../../", import.meta.url));

/** `requiredModules: "x"` and `requiredModules: ["x", "y"]`, single or double quoted. */
const REQUIRED_MODULES = /requiredModules:\s*(\[[^\]]*\]|["'][^"']*["'])/g;
const QUOTED = /["']([^"']+)["']/g;

const typescriptFilesUnder = (directory: string): string[] =>
  readdirSync(directory, { recursive: true, encoding: "utf8" })
    .filter((entry) => entry.endsWith(".ts") && !entry.endsWith(".d.ts"))
    .map((entry) => `${directory}/${entry}`);

const serviceDirectories = (): string[] =>
  readdirSync(APPS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => {
      try {
        return readdirSync(`${APPS_DIR}${name}`).includes("src");
      } catch {
        return false;
      }
    });

type Gate = { moduleId: string; file: string };

const readModuleGates = (): Gate[] => {
  const gates: Gate[] = [];

  for (const service of serviceDirectories()) {
    for (const file of typescriptFilesUnder(`${APPS_DIR}${service}/src`)) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(REQUIRED_MODULES)) {
        for (const quoted of match[1]!.matchAll(QUOTED)) {
          gates.push({ moduleId: quoted[1]!, file: file.slice(APPS_DIR.length) });
        }
      }
    }
  }

  return gates;
};

describe("withTenantScope requiredModules ↔ MODULE_IDS", () => {
  const gates = readModuleGates();

  it("finds the module gates it is meant to be checking", () => {
    // A regex that silently matches nothing would make this suite vacuously green.
    expect(gates.length).toBeGreaterThan(50);
  });

  it("gates every route on a module a tenant can actually enable", () => {
    const known = new Set<string>(MODULE_IDS);
    const unknown = gates.filter((gate) => !known.has(gate.moduleId));

    const summary = unknown
      .map((gate) => `  ✗ "${gate.moduleId}" — not in MODULE_IDS — ${gate.file}`)
      .join("\n");

    expect(
      unknown.map((gate) => `${gate.moduleId} @ ${gate.file}`).sort(),
      `\nRoutes gated on a module id no tenant can enable. Every request to these\n` +
        `routes answers 403 TENANT_MODULE_NOT_ENABLED regardless of configuration:\n${summary}\n\n` +
        `Fix the id, or add the module to MODULE_IDS in schema/src/api/tenants.ts\n` +
        `and to the registry in core-service/src/modules/module-registry.ts.\n`,
    ).toEqual([]);
  });
});
