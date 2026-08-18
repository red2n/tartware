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
 *
 * ── The converse, added 2026-08-18 ──
 *
 * That rule is one-directional, and the gap was found on 2026-08-17 while
 * building COV-13's meeting-room slice: reverting the gateway wildcard from
 * `app.all` back to `app.get` left all 26 gateway tests green with
 * `PUT /v1/meeting-rooms/:roomId` dead. The check above scans `app.all`
 * registrations only, so it catches a phantom write surface but is blind to a
 * *stranded* one — a downstream service implementing writes the gateway refuses
 * at the edge with "no such route".
 *
 * This matters right now because the 2026-08-13 sweep demoted all 13 wildcards
 * to `app.get`. Every one of those domains needs its gateway registration
 * promoted back to `app.all` in the same commit as its service write, and until
 * this check existed nothing would remind you. See ui-gaps/18-write-path-gap.md.
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

/** Wildcard registrations for one method, with the call body so the target is visible. */
const wildcardRegistrations = (method: "all" | "get"): RegExp =>
  new RegExp(
    `\\.(${method})\\s*(?:<[\\s\\S]{0,400}?>)?\\s*\\(\\s*[\`"']([^\`"'\\n]*\\*[^\`"'\\n]*)[\`"']([\\s\\S]*?)\\n\\s*\\);`,
    "g",
  );

/** Collapse `:tenantId` → `:p` so param naming differences do not count as a match. */
const normalisePath = (path: string): string =>
  path.replace(/:[A-Za-z0-9_]+/g, ":p").replace(/\/+$/, "");

const PROXY_HELPER = /const\s+(proxy[A-Za-z]*)\s*=[\s\S]{0,300}?serviceTargets\.([A-Za-z]+)/g;

const typescriptFilesUnder = (directory: string): string[] =>
  readdirSync(directory, { recursive: true, encoding: "utf8" })
    .filter((entry) => entry.endsWith(".ts") && !entry.endsWith(".d.ts"))
    .map((entry) => `${directory}/${entry}`);

type Write = { method: string; path: string };

/** Every write a service registers, carrying the method — a POST stranded at the
 *  gateway is not rescued by a DELETE being registered on the same prefix. */
const readDownstreamWrites = (serviceDirectory: string): Write[] => {
  const writes: Write[] = [];
  for (const file of typescriptFilesUnder(`${APPS_DIR}${serviceDirectory}/src`)) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(ROUTE_REGISTRATION)) {
      const method = match[1]!;
      const path = match[2]!;
      if (!path.startsWith("/")) continue;
      if (WRITE_METHODS.has(method) || method === "all") writes.push({ method, path });
    }
  }
  return writes;
};

const writesByService = new Map(
  [...new Set(Object.values(TARGET_DIRECTORY))].map((directory) => [
    directory,
    readDownstreamWrites(directory),
  ]),
);

type WildcardRoute = { path: string; target: string; file: string };

const readWildcardRoutes = (method: "all" | "get"): WildcardRoute[] => {
  const routes: WildcardRoute[] = [];
  const routesDirectory = `${APPS_DIR}api-gateway/src/routes`;

  for (const file of typescriptFilesUnder(routesDirectory)) {
    const source = readFileSync(file, "utf8");

    const helperTargets = new Map<string, string>();
    for (const match of source.matchAll(PROXY_HELPER)) {
      helperTargets.set(match[1]!, match[2]!);
    }
    if (helperTargets.size === 0) continue;

    for (const match of source.matchAll(wildcardRegistrations(method))) {
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

type ScopedWildcard = { path: string; helper: string; readsBody: boolean; file: string };

/**
 * Every `app.all` wildcard paired with what its `preHandler` resolver looks at.
 *
 * Only `withTenantScope` helpers are judged: `authenticatedOnly` and `adminOnly`
 * do not resolve a tenant at all, and a params-based resolver reads the path,
 * which a body cannot contradict.
 */
const readWildcardScopes = (): ScopedWildcard[] => {
  const scoped: ScopedWildcard[] = [];
  const routesDirectory = `${APPS_DIR}api-gateway/src/routes`;

  for (const file of typescriptFilesUnder(routesDirectory)) {
    const source = readFileSync(file, "utf8");

    // helper name → the resolveTenantId expression it was declared with
    const resolvers = new Map<string, string>();
    for (const match of source.matchAll(
      /const\s+([A-Za-z0-9_]+)\s*=\s*app\.withTenantScope\(\{([\s\S]*?)\n\s*\}\);/g,
    )) {
      resolvers.set(match[1]!, match[2]!);
    }
    if (resolvers.size === 0) continue;

    for (const match of source.matchAll(wildcardRegistrations("all"))) {
      const path = match[2]!;
      const body = match[3]!;
      const preHandler = /preHandler:\s*([A-Za-z0-9_]+)/.exec(body)?.[1];
      if (!preHandler) continue;

      const declaration = resolvers.get(preHandler);
      // Not a tenant-scoped wildcard at all.
      if (declaration === undefined) continue;
      // `allowMissingTenantId` helpers (authenticatedOnly, adminOnly) do not
      // reject an unscoped request, so where the tenant is read from cannot
      // strand a write.
      if (/allowMissingTenantId:\s*true/.test(declaration)) continue;
      // A params resolver reads the path itself — the body cannot disagree.
      if (/request\.params/.test(declaration) && !/request\.query/.test(declaration)) continue;

      scoped.push({
        path,
        helper: preHandler,
        readsBody: /request\.body/.test(declaration),
        file: file.slice(APPS_DIR.length),
      });
    }
  }

  return scoped;
};

describe("gateway wildcard proxies ↔ downstream write handlers", () => {
  const routes = readWildcardRoutes("all");

  it("finds the wildcard proxies to check", () => {
    // A regex that silently matched nothing would make this suite vacuously green.
    expect(routes.length).toBeGreaterThan(5);
  });

  it("only forwards every method where the target implements a write", () => {
    const offenders = routes.filter((route) => {
      const prefix = route.path.split("/*")[0]!;
      const writes = writesByService.get(route.target) ?? [];
      return !writes.some(({ path }) => path.startsWith(prefix));
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

/**
 * What the gateway itself accepts a write on, per method. Coverage has to be
 * method-aware: an `app.delete("/v1/billing/*")` does nothing for a stranded
 * POST, and treating "some write method is registered here" as full coverage
 * reintroduces the very blind spot this check exists to close.
 */
type GatewayWriteCoverage = {
  /** `"post /v1/billing/fx-rates"` for explicit, non-wildcard routes. */
  exact: Set<string>;
  /** Wildcard registrations as `{ method, prefix }`; `all` covers every method. */
  wildcards: { method: string; prefix: string }[];
};

const readGatewayWriteCoverage = (): GatewayWriteCoverage => {
  const exact = new Set<string>();
  const wildcards: { method: string; prefix: string }[] = [];

  for (const file of typescriptFilesUnder(`${APPS_DIR}api-gateway/src/routes`)) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(ROUTE_REGISTRATION)) {
      const method = match[1]!;
      const path = match[2]!;
      if (!path.startsWith("/")) continue;
      if (!WRITE_METHODS.has(method) && method !== "all") continue;

      if (path.includes("*")) wildcards.push({ method, prefix: path.split("/*")[0]! });
      else exact.add(`${method} ${normalisePath(path)}`);
    }
  }

  return { exact, wildcards };
};

/** Can a request of this method reach this downstream path through the gateway? */
const isReachable = (write: Write, coverage: GatewayWriteCoverage): boolean => {
  if (coverage.exact.has(`${write.method} ${normalisePath(write.path)}`)) return true;
  if (coverage.exact.has(`all ${normalisePath(write.path)}`)) return true;

  return coverage.wildcards.some(
    ({ method, prefix }) =>
      write.path.startsWith(prefix) && (method === "all" || method === write.method),
  );
};

describe("gateway read-only wildcards ↔ stranded downstream writes", () => {
  const routes = readWildcardRoutes("get");
  const coverage = readGatewayWriteCoverage();

  it("finds the read-only wildcard proxies to check", () => {
    // The 2026-08-13 sweep demoted 13 wildcards to `app.get`. If this ever
    // matches nothing, the regex has drifted and the suite is vacuously green.
    expect(routes.length).toBeGreaterThan(5);
  });

  it("does not refuse a write its target actually implements", () => {
    const offenders: { route: WildcardRoute; stranded: Write[] }[] = [];
    const seen = new Set<string>();

    for (const route of routes) {
      const prefix = route.path.split("/*")[0]!;
      if (seen.has(`${route.target} ${prefix}`)) continue;
      seen.add(`${route.target} ${prefix}`);

      const stranded = (writesByService.get(route.target) ?? [])
        .filter((write) => write.path.startsWith(prefix))
        .filter((write) => !isReachable(write, coverage))
        .filter(
          (write, index, all) =>
            all.findIndex((w) => w.method === write.method && w.path === write.path) === index,
        )
        .sort((a, b) => `${a.path} ${a.method}`.localeCompare(`${b.path} ${b.method}`));

      if (stranded.length > 0) offenders.push({ route, stranded });
    }

    const summary = offenders
      .map(
        ({ route, stranded }) =>
          `  \u2717 ${route.path} \u2014 ${route.target} implements ${stranded.length} ` +
          `write(s) the gateway will not accept:\n` +
          stranded
            .map((write) => `      ${write.method.toUpperCase()} ${write.path}`)
            .join("\n") +
          `\n      in ${route.file}`,
      )
      .join("\n");

    expect(
      offenders.map(({ route }) => route.path).sort(),
      `\nDownstream writes the gateway refuses at the edge.\n` +
        `The service implements these; the gateway registers no matching method\n` +
        `for the path, so the request returns "no such route" and the write is\n` +
        `unreachable through the product:\n${summary}\n\n` +
        `Register the missing method on the wildcard in the same commit as the\n` +
        `service write, or give the write its own explicit gateway route.\n`,
    ).toEqual([]);
  });
});

/**
 * ── The third variant, added 2026-08-18 ──
 *
 * A wildcard can be registered `app.all`, have a target that really does
 * implement the write, and *still* refuse every write — because the tenant
 * scope resolver reads `tenant_id` from the query string only, while the front
 * end sends it in the JSON body. `withTenantScope` rejects anything it cannot
 * scope, so the request dies at the edge with 400 TENANT_ID_REQUIRED and never
 * reaches the service. Neither check above sees it: the registration is right
 * and the downstream write exists.
 *
 * Found live on 2026-08-18 on `/v1/rooms/*`, `/v1/buildings/*`, `/v1/rates/*`
 * and `/v1/night-audit/*` — room edit, building edit and delete, and rate edit
 * were all dead in the UI. The rule: a write-forwarding wildcard must resolve
 * the tenant from the body as well as the query.
 */
describe("gateway write wildcards ↔ body-scoped writes", () => {
  const scoped = readWildcardScopes();

  it("finds the wildcard scope resolvers to check", () => {
    expect(scoped.length).toBeGreaterThan(5);
  });

  it("resolves tenant_id from the body, not the query alone", () => {
    const offenders = scoped.filter((route) => !route.readsBody);

    const summary = offenders
      .map(
        (route) =>
          `  \u2717 ${route.path} \u2014 preHandler ${route.helper} reads tenant_id from the query only — ${route.file}`,
      )
      .join("\n");

    expect(
      offenders.map((route) => route.path).sort(),
      `\nWrite-forwarding wildcards that refuse every body-shaped write.\n` +
        `withTenantScope rejects a request it cannot scope, so these return\n` +
        `400 TENANT_ID_REQUIRED at the edge however correct the body is:\n${summary}\n\n` +
        `Resolve tenant_id from the query *or* the body on any wildcard that\n` +
        `forwards writes.\n`,
    ).toEqual([]);
  });
});
