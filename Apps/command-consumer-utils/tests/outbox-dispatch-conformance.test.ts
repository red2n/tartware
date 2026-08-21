/**
 * Outbox enqueue ↔ dispatcher conformance.
 *
 * A service writes an event by inserting a row into `transactional_outbox` inside
 * the business transaction. Delivery is a separate concern: a dispatcher polls the
 * table and claims rows *by `aggregate_type`*. If a service enqueues a type its own
 * dispatcher does not claim, the row is committed and then claimed by nobody — it
 * sits PENDING forever.
 *
 * Nothing else catches this. The command succeeds, the transaction commits, the API
 * returns 200, typecheck passes, `sql:contracts` passes, and the gateway and catalog
 * conformance suites pass. The only symptom is a consumer that stays quiet.
 *
 * It has shipped twice. `reservations-command-service` enqueued five aggregate types
 * and claimed one, so `group.created` never reached the notification-service handler
 * that turns it into GROUP_BOOKING_CONFIRMED — 16 rows were found sitting PENDING,
 * the oldest for a day. Core-service's `setting` events had no dispatcher at all.
 *
 * The check is deliberately literal-only on both sides. A version that resolved
 * identifiers and config lookups would have to evaluate the code to be right, and a
 * check that is sometimes wrong is worse than none — the lesson this repo recorded
 * when it threw away the fuzzy enum↔column matcher. So a service that enqueues a
 * non-literal `aggregateType` fails loudly here rather than being skipped.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const APPS_DIR = fileURLToPath(new URL("../../", import.meta.url));

/**
 * The name a dispatcher must give its claim list. Naming it in the source is what
 * makes this check possible without evaluating the code, so the convention is the
 * contract — see the comment beside each declaration.
 */
const DISPATCH_LIST_NAME = "DISPATCHED_AGGREGATE_TYPES";

/**
 * Aggregate types delivered without ever being claimed, with the mechanism that
 * delivers them instead. Polling is not the only valid pattern: the gateway
 * publishes a command inline on the request path and then settles its outbox row
 * by event id, so the row is a durability record rather than a queue entry.
 *
 * An entry here is a claim that some code calls `markOutboxDeliveredByEventId`,
 * and the test below verifies that rather than taking it on trust. Add to this
 * list only with the settling call to point at.
 */
const INLINE_SETTLED_AGGREGATE_TYPES = new Map<string, string>([
  [
    "command",
    "api-gateway/src/command-center/command-dispatch-service.ts publishes on the request path " +
      "and calls markOutboxDeliveredByEventId",
  ],
]);

const listTsFiles = (dir: string): string[] => {
  const out: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    if (entry === "node_modules" || entry === "dist") {
      continue;
    }
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...listTsFiles(full));
    } else if (entry.endsWith(".ts") && !entry.endsWith(".d.ts")) {
      out.push(full);
    }
  }
  return out;
};

const serviceDirs = (): string[] =>
  readdirSync(APPS_DIR)
    .map((entry) => join(APPS_DIR, entry))
    .filter((full) => {
      try {
        return statSync(join(full, "src")).isDirectory();
      } catch {
        return false;
      }
    });

type ServiceScan = {
  name: string;
  /** Aggregate types passed to an `enqueueOutboxRecord*` call, as string literals. */
  enqueued: Set<string>;
  /** Aggregate types named in a `DISPATCHED_AGGREGATE_TYPES` declaration. */
  dispatched: Set<string>;
  /** `aggregateType:` values this scan could not read as a literal. */
  unresolved: string[];
  /** True when the service polls the outbox at all. */
  hasDispatcher: boolean;
  /** True when the service settles outbox rows by event id after an inline publish. */
  settlesInline: boolean;
};

const scanService = (dir: string): ServiceScan => {
  const scan: ServiceScan = {
    name: dir.split("/").filter(Boolean).pop() ?? dir,
    enqueued: new Set(),
    dispatched: new Set(),
    unresolved: [],
    hasDispatcher: false,
    settlesInline: false,
  };

  for (const file of listTsFiles(join(dir, "src"))) {
    const source = readFileSync(file, "utf8");

    for (const match of source.matchAll(/aggregateType:\s*([^,\n]+)/g)) {
      const raw = match[1]!.trim().replace(/,$/, "");
      const literal = /^"([^"]+)"$/.exec(raw);
      if (literal) {
        scan.enqueued.add(literal[1]!);
      } else if (raw !== "string;" && !raw.startsWith("row.")) {
        // `string;` is the type declaration in the outbox package itself, and
        // `row.aggregate_type` is its row mapper — neither is an enqueue site.
        scan.unresolved.push(`${file.slice(dir.length + 1)}: aggregateType: ${raw}`);
      }
    }

    if (source.includes("claimOutboxBatch(")) {
      scan.hasDispatcher = true;
    }
    if (source.includes("markOutboxDeliveredByEventId")) {
      scan.settlesInline = true;
    }

    const declaration = new RegExp(`${DISPATCH_LIST_NAME}\\s*=\\s*\\[([^\\]]*)\\]`).exec(source);
    if (declaration) {
      for (const entry of declaration[1]!.matchAll(/"([^"]+)"/g)) {
        scan.dispatched.add(entry[1]!);
      }
    }
  }

  return scan;
};

const scans = serviceDirs()
  .map(scanService)
  .filter((scan) => scan.enqueued.size > 0 || scan.hasDispatcher || scan.settlesInline);

describe("outbox enqueue ↔ dispatcher", () => {
  it("finds the enqueue sites and dispatchers it is meant to be scanning", () => {
    // Self-test: a scanner that silently matches nothing reports green forever.
    const enqueuers = scans.filter((scan) => scan.enqueued.size > 0);
    const dispatchers = scans.filter((scan) => scan.hasDispatcher);

    expect(
      enqueuers.length,
      "no service appears to enqueue outbox rows — the aggregateType pattern stopped matching",
    ).toBeGreaterThan(0);
    expect(
      dispatchers.length,
      "no service appears to claim outbox rows — the claimOutboxBatch pattern stopped matching",
    ).toBeGreaterThan(0);
  });

  it("reads every aggregateType as a literal", () => {
    const unresolved = scans.flatMap((scan) => scan.unresolved.map((u) => `[${scan.name}] ${u}`));

    expect(
      unresolved,
      `An aggregateType this check cannot read is an aggregateType it cannot verify. Pass a string ` +
        `literal at the enqueue site rather than a constant or config lookup — the dispatch list is ` +
        `the place to name it once.\n\n${unresolved.join("\n")}`,
    ).toEqual([]);
  });

  it("declares a dispatch list for every service that claims outbox rows", () => {
    const missing = scans
      .filter((scan) => scan.hasDispatcher && scan.dispatched.size === 0)
      .map((scan) => scan.name);

    expect(
      missing,
      `These services poll the outbox but do not declare \`${DISPATCH_LIST_NAME}\`, so what they ` +
        `claim cannot be checked: ${missing.join(", ")}`,
    ).toEqual([]);
  });

  it("keeps the inline-settled exemptions honest", () => {
    // An exemption claims delivery happens without claiming. If nothing settles by
    // event id any more, the exemption has outlived its mechanism and is now hiding
    // exactly the defect this file exists to catch.
    if (INLINE_SETTLED_AGGREGATE_TYPES.size > 0) {
      expect(
        scans.some((scan) => scan.settlesInline),
        `${[...INLINE_SETTLED_AGGREGATE_TYPES.keys()].join(", ")} are exempt on the grounds that ` +
          `something publishes them inline and settles by event id, but no service calls ` +
          `markOutboxDeliveredByEventId any more. Re-check the exemption.`,
      ).toBe(true);
    }

    // And an exemption for a type nobody enqueues is dead weight that will read as
    // permission next time someone adds that name.
    const enqueuedAnywhere = new Set(scans.flatMap((scan) => [...scan.enqueued]));
    const unused = [...INLINE_SETTLED_AGGREGATE_TYPES.keys()].filter(
      (type) => !enqueuedAnywhere.has(type),
    );
    expect(unused, `Exempted aggregate types nobody enqueues: ${unused.join(", ")}`).toEqual([]);
  });

  it("dispatches every aggregate type it enqueues", () => {
    const stranded: string[] = [];

    for (const scan of scans) {
      if (!scan.hasDispatcher) {
        // A service may legitimately enqueue for another service's dispatcher, but
        // then some service must claim the type — checked below, across all scans.
        continue;
      }
      for (const type of scan.enqueued) {
        if (!scan.dispatched.has(type) && !INLINE_SETTLED_AGGREGATE_TYPES.has(type)) {
          stranded.push(`[${scan.name}] enqueues "${type}" but its dispatcher does not claim it`);
        }
      }
    }

    const claimedAnywhere = new Set(scans.flatMap((scan) => [...scan.dispatched]));
    for (const scan of scans) {
      if (scan.hasDispatcher) {
        continue;
      }
      for (const type of scan.enqueued) {
        if (!claimedAnywhere.has(type) && !INLINE_SETTLED_AGGREGATE_TYPES.has(type)) {
          stranded.push(`[${scan.name}] enqueues "${type}" and no dispatcher anywhere claims it`);
        }
      }
    }

    expect(
      stranded,
      `Outbox rows of these aggregate types are written inside a committed transaction and then ` +
        `claimed by nobody. The write looks successful; the event never arrives.\n\n${stranded.join("\n")}`,
    ).toEqual([]);
  });
});
