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
const SEED_FILE = fileURLToPath(
  new URL("../../../scripts/data/defaults/default_seed.json", import.meta.url),
);

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

const gates = readModuleGates();

describe("withTenantScope requiredModules ↔ MODULE_IDS", () => {
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

/**
 * The auth gate reads the *tenant's* enabled set, and that set comes from
 * `tenants.config -> 'modules'` — `tenant-module-service.ts` calls it the source
 * of truth. A seeded tenant with no `modules` key falls back to `["core"]`
 * through `COALESCE(t.config -> 'modules', '["core"]')`, which is not an empty
 * edge case: it silently switches off every domain gated on anything else.
 *
 * That is the state a fresh database was in on 2026-08-19. Lost & found and the
 * incident register — both shipped, both smoke-tested — answered 403
 * TENANT_MODULE_NOT_ENABLED for every call, and the E2E sweep scored each of
 * those 403s as a *skip* (`test-multi-tenant.sh`, api_smoke), so every suite
 * stayed green while whole domains were dark. See ui-gaps/14-channel-distribution.md.
 *
 * A route may of course be gated on a module a real customer has not bought.
 * The seed tenant is different: it is the one every developer, every smoke
 * script and every E2E run works against, so a module it lacks is a domain
 * nobody can exercise.
 */
describe("seed tenant ↔ module gates", () => {
  const seed = JSON.parse(readFileSync(SEED_FILE, "utf8")) as {
    tenants?: { id: string; name?: string; config?: { modules?: string[] } }[];
  };

  it("seeds at least one tenant carrying an explicit module list", () => {
    // Vacuity guard: no tenants, or a renamed key, would make the check below
    // pass by having nothing to compare.
    const withModules = (seed.tenants ?? []).filter((t) => Array.isArray(t.config?.modules));
    expect(
      withModules.length,
      `\nNo seeded tenant declares config.modules in scripts/data/defaults/default_seed.json.\n` +
        `Without it the auth gate falls back to ["core"] and every route gated on\n` +
        `another module answers 403 for the tenant all local testing runs against.\n`,
    ).toBeGreaterThan(0);
  });

  it("grants the seed tenant every module a route is gated on", () => {
    const granted = new Set<string>(
      (seed.tenants ?? []).flatMap((tenant) => tenant.config?.modules ?? []),
    );
    // Only ids that are real modules matter here; the suite above owns the rest.
    const known = new Set<string>(MODULE_IDS);
    const required = [...new Set(gates.map((gate) => gate.moduleId))].filter((id) => known.has(id));
    const missing = required.filter((id) => !granted.has(id)).sort();

    const summary = missing
      .map((id) => {
        const example = gates.find((gate) => gate.moduleId === id)?.file ?? "";
        return `  ✗ ${id} — e.g. ${example}`;
      })
      .join("\n");

    expect(
      missing,
      `\nRoutes are gated on modules the seed tenant does not have, so those domains\n` +
        `answer 403 TENANT_MODULE_NOT_ENABLED on a freshly seeded database — and the\n` +
        `E2E sweep records that as a skip, not a failure:\n${summary}\n\n` +
        `Add them to config.modules for the seed tenant in\n` +
        `scripts/data/defaults/default_seed.json.\n`,
    ).toEqual([]);
  });

  it("grants only modules that exist", () => {
    const known = new Set<string>(MODULE_IDS);
    const granted = [
      ...new Set((seed.tenants ?? []).flatMap((tenant) => tenant.config?.modules ?? [])),
    ];
    const bogus = granted.filter((id) => !known.has(id)).sort();

    expect(
      bogus,
      `\nThe seed grants module ids that are not in MODULE_IDS. They enable nothing,\n` +
        `and reading the seed suggests a coverage the tenant does not have:\n` +
        `${bogus.map((id) => `  ✗ ${id}`).join("\n")}\n`,
    ).toEqual([]);
  });
});
