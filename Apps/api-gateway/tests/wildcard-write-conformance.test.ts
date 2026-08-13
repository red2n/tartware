/**
 * Wildcard proxies must not advertise writes no downstream service implements.
 *
 * `proxy-route-conformance.test.ts` deliberately skips wildcards — they forward
 * anything, so they document no specific path. That leaves a blind spot exactly
 * where it hurts: an `app.all("/v1/x/*")` forwards POST/PUT/DELETE verbatim, the
 * request passes gateway auth and tenant scoping, and only then 404s inside the
 * target service. The gateway's OpenAPI document meanwhile advertises a full
 * write surface for a read-only domain.
 *
 * 13 wildcards were in that state on 2026-08-13 — allotments, meeting rooms,
 * event bookings, banquet orders, waitlist, group bookings, ota-connections,
 * channel mappings, metasearch, dashboard, maintenance, cashier sessions and
 * revenue. Some are read-only by nature, some take their writes through the
 * command bus, and some have no write path built yet; in every case the fix was
 * the same — register `app.get` so an unsupported method is refused at the edge
 * with a plain "no such route" instead of a misleading downstream 404.
 * See ui-gaps/18-write-path-gap.md item 2.
 *
 * The rule: a wildcard proxy may use `app.all` only if its target registers at
 * least one write under that prefix.
 */

import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const APPS_DIR = fileURLToPath(new URL("../../", import.meta.url));

/** `serviceTargets` key → the Apps/ directory that must register the path. */
const TARGET_DIRECTORY: Record<string, string> = {
  coreServiceUrl: "core-service",
  guestsServiceUrl: "guests-service",
  roomsServiceUrl: "rooms-service",
  reservationCommandServiceUrl: "reservations-command-service",
  billingServiceUrl: "billing-service",
  housekeepingServiceUrl: "housekeeping-service",
  notificationServiceUrl: "notification-service",
  revenueServiceUrl: "revenue-service",
};

const WRITE_METHODS = new Set(["post", "put", "patch", "delete"]);

const ROUTE_REGISTRATION =
  /\.(get|post|put|patch|delete|all)\s*(?:<[\s\S]{0,400}?>)?\s*\(\s*[`"']([^`"'\n]+)[`"']/g;

/** Wildcard `app.all(...)` registrations, with the call body so the target is visible. */
const WILDCARD_ALL =
  /\.(all)\s*(?:<[\s\S]{0,400}?>)?\s*\(\s*[`"']([^`"'\n]*\*[^`"'\n]*)[`"']([\s\S]*?)\n\s*\);/g;

const PROXY_HELPER = /const\s+(proxy[A-Za-z]*)\s*=[\s\S]{0,300}?serviceTargets\.([A-Za-z]+)/g;

const typescriptFilesUnder = (directory: string): string[] =>
  readdirSync(directory, { recursive: true, encoding: "utf8" })
    .filter((entry) => entry.endsWith(".ts") && !entry.endsWith(".d.ts"))
    .map((entry) => `${directory}/${entry}`);

/** Every path a service registers a write for. */
const readDownstreamWrites = (serviceDirectory: string): string[] => {
  const paths: string[] = [];
  for (const file of typescriptFilesUnder(`${APPS_DIR}${serviceDirectory}/src`)) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(ROUTE_REGISTRATION)) {
      const method = match[1]!;
      const path = match[2]!;
      if (!path.startsWith("/")) continue;
      if (WRITE_METHODS.has(method) || method === "all") paths.push(path);
    }
  }
  return paths;
};

const writesByService = new Map(
  [...new Set(Object.values(TARGET_DIRECTORY))].map((directory) => [
    directory,
    readDownstreamWrites(directory),
  ]),
);

type WildcardRoute = { path: string; target: string; file: string };

const readWildcardAllRoutes = (): WildcardRoute[] => {
  const routes: WildcardRoute[] = [];
  const routesDirectory = `${APPS_DIR}api-gateway/src/routes`;

  for (const file of typescriptFilesUnder(routesDirectory)) {
    const source = readFileSync(file, "utf8");

    const helperTargets = new Map<string, string>();
    for (const match of source.matchAll(PROXY_HELPER)) {
      helperTargets.set(match[1]!, match[2]!);
    }
    if (helperTargets.size === 0) continue;

    for (const match of source.matchAll(WILDCARD_ALL)) {
      const path = match[2]!;
      const body = match[3]!;
      const used = [...helperTargets.keys()].filter((helper) =>
        new RegExp(`\\b${helper}\\b`).test(body),
      );
      // Zero → handled locally (a command forward, not a proxy). More than one →
      // a conditional target this check cannot resolve statically.
      if (used.length !== 1) continue;

      const target = TARGET_DIRECTORY[helperTargets.get(used[0]!)!];
      if (target === undefined) continue;

      routes.push({ path, target, file: file.slice(APPS_DIR.length) });
    }
  }

  return routes;
};

describe("gateway wildcard proxies ↔ downstream write handlers", () => {
  const routes = readWildcardAllRoutes();

  it("finds the wildcard proxies to check", () => {
    // A regex that silently matched nothing would make this suite vacuously green.
    expect(routes.length).toBeGreaterThan(5);
  });

  it("only forwards every method where the target implements a write", () => {
    const offenders = routes.filter((route) => {
      const prefix = route.path.split("/*")[0]!;
      const writes = writesByService.get(route.target) ?? [];
      return !writes.some((path) => path.startsWith(prefix));
    });

    const summary = offenders
      .map(
        (route) =>
          `  ✗ ${route.path} → ${route.target} implements no write under ${route.path.split("/*")[0]} — ${route.file}`,
      )
      .join("\n");

    expect(
      offenders.map((route) => route.path).sort(),
      `\nWildcard proxies advertising a write surface their target does not have.\n` +
        `Each forwards POST/PUT/DELETE past gateway auth to a downstream 404, and\n` +
        `documents the write in the gateway's OpenAPI output:\n${summary}\n\n` +
        `Register these as \`app.get\` until the downstream write exists, so an\n` +
        `unsupported method is refused at the edge instead.\n`,
    ).toEqual([]);
  });
});
