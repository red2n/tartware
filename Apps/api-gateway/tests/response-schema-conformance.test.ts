/**
 * A route that returns a bare array must declare an array response schema.
 *
 * `buildRouteSchema` defaults `response` to `{ 200: jsonObjectSchema }`. Fastify
 * compiles that into a fast-json-stringify serializer, so a handler returning a
 * bare array is serialized *against an object schema* and emitted as
 * `{"0":…,"1":…,"2":…}`. No error is raised anywhere: the query ran, the handler
 * returned the right rows, the status is 200.
 *
 * The UI is where it surfaces. `reports.ts`'s `extractRows` looks for `data`,
 * `rows`, `items` or `results`, finds none, and falls to its scalar branch —
 * wrapping the whole payload as **one row whose column names are the array
 * indices**, every cell rendering `[object Object]`.
 *
 * Found 2026-08-24 on `/v1/revenue/booking-pace` and `/v1/revenue/demand-calendar`,
 * both shipped and both never once serialized by any test. Twelve routes were in
 * that state, all in revenue-service. 70 of 590 route registrations omit an
 * explicit `response`; the other 58 return objects and are correct as they stand.
 * See ui-gaps/05-revenue-module-status.md.
 *
 * Nothing else can see this class. Typecheck cannot: the handler's return type
 * and the route's declared schema are unrelated values to it — the same blind
 * spot COV-13's `{ data, message }` 500 recorded on 2026-08-18. `sql:contracts`
 * reads SQL, not responses. The gateway and command-catalog suites never
 * serialize a body.
 *
 * **Detection is deliberately narrow.** Only a handler whose body is a direct
 * `return someFunction(...)` is judged, and only when that function's *declared*
 * return type is a plain `T[]` or `Array<T>`. A handler that wraps its result
 * (`return { items: await list() }`) is not a bare array and is skipped; a union
 * (`Promise<T[] | null>`) is ambiguous and is skipped. That under-reports rather
 * than over-reports, which is the right way to be wrong — a check that cries
 * wolf is worse than none, the lesson the 2026-08-13 enum sweep recorded.
 */

import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const APPS_DIR = fileURLToPath(new URL("../../", import.meta.url));

const typescriptFilesUnder = (directory: string): string[] => {
  try {
    return readdirSync(directory, { recursive: true, encoding: "utf8" })
      .filter((entry) => entry.endsWith(".ts") && !entry.endsWith(".d.ts"))
      .map((entry) => `${directory}/${entry}`);
  } catch {
    return [];
  }
};

const serviceDirectories = (): string[] =>
  readdirSync(APPS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => typescriptFilesUnder(`${APPS_DIR}${name}/src/routes`).length > 0);

/**
 * Declared return types of exported service functions, keyed by name.
 *
 * Both forms this repo uses are read: `export const fn = async (...): Promise<T> =>`
 * and `export async function fn(...): Promise<T> {`. A function without an
 * explicit annotation is absent from the map and therefore never judged.
 */
const readDeclaredReturnTypes = (): Map<string, string> => {
  const types = new Map<string, string>();
  const arrowForm =
    /export const (\w+)\s*=\s*async\s*\((?:[^()]|\([^()]*\))*\)\s*:\s*Promise<([\s\S]+?)>\s*=>/g;
  const functionForm =
    /export async function (\w+)\s*\((?:[^()]|\([^()]*\))*\)\s*:\s*Promise<([\s\S]+?)>\s*\{/g;

  for (const service of serviceDirectories()) {
    for (const file of typescriptFilesUnder(`${APPS_DIR}${service}/src`)) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(arrowForm)) {
        types.set(match[1]!, match[2]!.replace(/\s+/g, " ").trim());
      }
      for (const match of source.matchAll(functionForm)) {
        types.set(match[1]!, match[2]!.replace(/\s+/g, " ").trim());
      }
    }
  }
  return types;
};

/** A plain `T[]` or `Array<T>` — not a union, not an object, not a tuple. */
const isBareArrayType = (returnType: string): boolean => {
  if (returnType.includes("|")) return false;
  return /^[A-Za-z_][\w.]*(?:<[^<>]*>)?\[\]$/.test(returnType) || /^Array<[^<>]*>$/.test(returnType);
};

const ROUTE_REGISTRATION =
  /app\.(?:get|post|put|patch|delete)\s*(?:<[\s\S]{0,600}?>)?\s*\(\s*[`"']([^`"'\n]+)[`"']/g;

type Route = { path: string; file: string; hasResponse: boolean; handler: string | undefined };

/**
 * Every route registration, paired with whether its `buildRouteSchema` declares a
 * `response` and which service function it returns directly.
 *
 * A registration is bounded by the next one, which keeps a handler's `return`
 * from being attributed to the route above it.
 */
const readRoutes = (): Route[] => {
  const routes: Route[] = [];

  for (const service of serviceDirectories()) {
    for (const file of typescriptFilesUnder(`${APPS_DIR}${service}/src/routes`)) {
      const source = readFileSync(file, "utf8");
      const matches = [...source.matchAll(ROUTE_REGISTRATION)];

      matches.forEach((match, index) => {
        const start = match.index!;
        const end = matches[index + 1]?.index ?? source.length;
        const block = source.slice(start, end);

        // Everything before the handler — where the schema is declared.
        const head = block.split(/async\s*\(/)[0] ?? "";
        if (!head.includes("buildRouteSchema")) return;

        routes.push({
          path: match[1]!,
          file: file.slice(APPS_DIR.length),
          hasResponse: /\bresponse\s*:/.test(head),
          handler: /return\s+(?:await\s+)?(\w+)\(/.exec(block)?.[1],
        });
      });
    }
  }
  return routes;
};

const declaredReturnTypes = readDeclaredReturnTypes();
const routes = readRoutes();

/** Routes whose handler directly returns a function declared to return an array. */
const arrayReturningRoutes = routes.filter((route) => {
  if (route.handler === undefined) return false;
  const returnType = declaredReturnTypes.get(route.handler);
  return returnType !== undefined && isBareArrayType(returnType);
});

describe("route response schemas ↔ handler return shapes", () => {
  it("finds the routes and return types to check", () => {
    // A regex that silently matched nothing would make this suite vacuously
    // green — the same failure mode outbox-dispatch-conformance guards against.
    expect(routes.length).toBeGreaterThan(300);
    expect(declaredReturnTypes.size).toBeGreaterThan(100);
    expect(arrayReturningRoutes.length).toBeGreaterThan(5);
  });

  it("classifies array and non-array return types correctly", () => {
    // The classifier is the whole check. If it drifts, the suite above still
    // passes while reporting nothing, so pin its behaviour explicitly.
    expect(isBareArrayType("BookingPaceItem[]")).toBe(true);
    expect(isBareArrayType("Array<PricingRule>")).toBe(true);
    expect(isBareArrayType("RateRecommendationListItem[]")).toBe(true);
    expect(isBareArrayType("{ items: SegmentAnalysisItem[] }")).toBe(false);
    expect(isBareArrayType("PricingRuleListItem | null")).toBe(false);
    expect(isBareArrayType("RevenueKpi")).toBe(false);
    expect(isBareArrayType("void")).toBe(false);
  });

  it("declares an explicit array response wherever the handler returns a bare array", () => {
    const offenders = arrayReturningRoutes.filter((route) => !route.hasResponse);

    const summary = offenders
      .map(
        (route) =>
          `  ✗ ${route.path} → ${route.handler}(): ${declaredReturnTypes.get(route.handler!)} — ${route.file}`,
      )
      .join("\n");

    expect(
      offenders.map((route) => route.path).sort(),
      `\nRoutes returning a bare array while relying on buildRouteSchema's default\n` +
        `object response schema. Each serializes its array to {"0":…,"1":…} and\n` +
        `renders in the UI as a single row whose columns are the array indices:\n${summary}\n\n` +
        `Add \`response: { 200: jsonArraySchema }\` to buildRouteSchema, importing\n` +
        `jsonArraySchema from "@tartware/openapi".\n`,
    ).toEqual([]);
  });
});
