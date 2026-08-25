/**
 * Gateway proxy route ↔ downstream handler conformance.
 *
 * `proxyRequest` forwards `request.raw.url` verbatim to the target service, so
 * a gateway route whose path no downstream service registers answers 404 —
 * while the gateway's OpenAPI document advertises it as a working endpoint.
 * Nothing catches that today: the E2E sweep in
 * executables/test-accounts-realdata/test-multi-tenant.sh treats 404 as a pass
 * (an unknown tenant or property legitimately 404s), so eight report endpoints
 * sat broken through green runs — `/v1/reports/no-show` when core-service
 * registers `no-shows`, `/v1/reports/manager-flash` when it registers `flash`,
 * and four more with no implementation anywhere. See ui-gaps/10-reports-coverage.md.
 *
 * This test asserts that every non-wildcard gateway route which delegates to a
 * `proxy*` helper resolves to a path the target service actually registers.
 * Parameter *names* are ignored — the gateway calls it `:tenantId` where a
 * service may call it `:id` — but path *shape* must match.
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

/**
 * Gateway routes known to have no matching downstream handler.
 *
 * Every entry would be a live 404 behind a documented endpoint, kept here only so
 * the check can be enforced before they are all fixed. **This list must only ever
 * shrink.** Adding to it hides the exact defect the test exists to catch; fix the
 * route or delete it instead.
 *
 * Empty since 2026-08-11, when the last eight were resolved — see
 * ui-gaps/19-gateway-proxy-mismatches.md for what each one was.
 */
const KNOWN_MISMATCHES = new Set<string>([]);

const ROUTE_REGISTRATION =
  /\.(get|post|put|patch|delete|all)\s*(?:<[\s\S]{0,400}?>)?\s*\(\s*[`"']([^`"'\n]+)[`"']/g;

/** Same registration match, but capturing the call body so the handler is visible. */
const ROUTE_WITH_BODY =
  /\.(get|post|put|patch|delete|all)\s*(?:<[\s\S]{0,400}?>)?\s*\(\s*[`"']([^`"'\n]+)[`"']([\s\S]*?)\n\s*\);/g;

const PROXY_HELPER = /const\s+(proxy[A-Za-z]*)\s*=[\s\S]{0,300}?serviceTargets\.([A-Za-z]+)/g;

/** Collapse `:tenantId` → `:p` so param naming differences do not count as mismatches. */
const normalisePath = (path: string): string =>
  path.replace(/:[A-Za-z0-9_]+/g, ":p").replace(/\/+$/, "");

const typescriptFilesUnder = (directory: string): string[] =>
  readdirSync(directory, { recursive: true, encoding: "utf8" })
    .filter((entry) => entry.endsWith(".ts") && !entry.endsWith(".d.ts"))
    .map((entry) => `${directory}/${entry}`);

/** Every `METHOD path` a service registers, plus the bare paths for shape-only checks. */
const readRegistrations = (
  serviceDirectory: string,
): { methodAndPath: Set<string>; paths: Set<string> } => {
  const methodAndPath = new Set<string>();
  const paths = new Set<string>();

  for (const file of typescriptFilesUnder(`${APPS_DIR}${serviceDirectory}/src`)) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(ROUTE_REGISTRATION)) {
      const path = match[2]!;
      if (!path.startsWith("/")) continue;
      methodAndPath.add(`${match[1]!.toUpperCase()} ${normalisePath(path)}`);
      paths.add(normalisePath(path));
    }
  }

  return { methodAndPath, paths };
};

const registrationsByService = new Map(
  [...new Set(Object.values(TARGET_DIRECTORY))].map((directory) => [
    directory,
    readRegistrations(directory),
  ]),
);

type ProxiedRoute = { key: string; target: string; file: string };

/** Gateway routes that delegate to exactly one `proxy*` helper, wildcards excluded. */
const readProxiedGatewayRoutes = (): ProxiedRoute[] => {
  const routes: ProxiedRoute[] = [];
  const routesDirectory = `${APPS_DIR}api-gateway/src/routes`;

  for (const file of typescriptFilesUnder(routesDirectory)) {
    const source = readFileSync(file, "utf8");

    const helperTargets = new Map<string, string>();
    for (const match of source.matchAll(PROXY_HELPER)) {
      helperTargets.set(match[1]!, match[2]!);
    }
    if (helperTargets.size === 0) continue;

    for (const match of source.matchAll(ROUTE_WITH_BODY)) {
      const path = match[2]!;
      // Wildcards intentionally forward anything; they document no specific path.
      if (!path.startsWith("/") || path.includes("*")) continue;

      const body = match[3]!;
      const used = [...helperTargets.keys()].filter((helper) =>
        new RegExp(`\\b${helper}\\b`).test(body),
      );
      // Zero → handled locally. More than one → conditional target we cannot resolve statically.
      if (used.length !== 1) continue;

      const target = TARGET_DIRECTORY[helperTargets.get(used[0]!)!];
      if (target === undefined) continue;

      routes.push({
        key: `${match[1]!.toUpperCase()} ${normalisePath(path)}`,
        target,
        file: file.slice(routesDirectory.length + 1),
      });
    }
  }

  return routes;
};

describe("gateway proxy routes ↔ downstream handlers", () => {
  const proxiedRoutes = readProxiedGatewayRoutes();

  it("finds the proxied gateway routes to check", () => {
    // Guards against the regexes silently matching nothing after a refactor.
    expect(proxiedRoutes.length, "no proxied gateway routes found — route layout changed").toBeGreaterThan(
      100,
    );
  });

  it("registers every proxied path on the target service", () => {
    const unresolved: string[] = [];

    for (const route of proxiedRoutes) {
      if (KNOWN_MISMATCHES.has(route.key)) continue;

      const registrations = registrationsByService.get(route.target)!;
      const [method, path] = [route.key.slice(0, route.key.indexOf(" ")), route.key.slice(route.key.indexOf(" ") + 1)];

      // `app.all` fans out to every method, so any registration of the path satisfies it.
      const resolved =
        method === "ALL" ? registrations.paths.has(path) : registrations.methodAndPath.has(route.key);

      if (!resolved) {
        const shapeExists = registrations.paths.has(path);
        unresolved.push(
          `  ✗ ${route.key} → ${route.target} ` +
            `(${shapeExists ? "path exists, wrong method" : "no such path"}, ${route.file})`,
        );
      }
    }

    expect(
      unresolved,
      `These gateway routes proxy to a path their target service does not register, ` +
        `so they answer 404 while the OpenAPI document advertises them:\n${unresolved.join("\n")}\n`,
    ).toEqual([]);
  });

  it("keeps every known mismatch real, so the allowlist shrinks as they are fixed", () => {
    const stale = [...KNOWN_MISMATCHES].filter((key) => {
      const route = proxiedRoutes.find((candidate) => candidate.key === key);
      if (route === undefined) return true; // route deleted or renamed — drop the entry
      const registrations = registrationsByService.get(route.target)!;
      const path = key.slice(key.indexOf(" ") + 1);
      return key.startsWith("ALL ") ? registrations.paths.has(path) : registrations.methodAndPath.has(key);
    });

    expect(
      stale,
      `KNOWN_MISMATCHES entries that are no longer mismatched (fixed or removed) — ` +
        `delete them from the allowlist:\n${stale.map((key) => `  ✓ ${key}`).join("\n")}\n`,
    ).toEqual([]);
  });
});
