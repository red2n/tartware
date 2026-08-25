/**
 * A handler that sends its own reply must `return` it.
 *
 * Fastify treats an async handler's resolved value as the payload to send. So
 * this shape:
 *
 *   reply.notFound("PRICING_RULE_NOT_FOUND");
 *   return;
 *
 * sends the 404, then resolves with `undefined`, and Fastify tries to send
 * *again* on a socket whose headers are already written. It logs "Reply was
 * already sent, did you forget to `return reply`?" and then throws
 * `ERR_HTTP_HEADERS_SENT` — which is **not** caught by the route's error
 * handler, because it happens after the reply lifecycle has ended. The
 * exception reaches the process and the service exits.
 *
 * Measured 2026-08-24, and it is worse than it sounds: one authenticated
 * `GET /v1/revenue/pricing-rules/<any-unknown-uuid>` returned 404 and then took
 * revenue-service down — health 200 → connection refused. The same shape on
 * `GET /v1/billing/invoices/<unknown>` did it to billing-service. Ten call sites
 * across four services were in that state, every one of them on the most
 * ordinary path a client has: asking for a record that is not there.
 *
 * `run-api-tests.sh` never hit them because it only requests ids it just
 * created. `smoke-revenue.sh`'s "unknown pricing rule id → not found" assertion
 * found it on its first run. See ui-gaps/05-revenue-module-status.md.
 *
 * The fix is one token — `return reply.notFound(...)` — and the rule this
 * asserts is simply that nothing writes the broken shape again.
 *
 * **Detection is exact, not heuristic.** It matches a `reply.<sender>(…)`
 * statement followed immediately by a bare `return;`, which is unambiguous: the
 * reply was sent and the handler then resolves with `undefined`. A handler that
 * returns the reply, returns a value, or falls off the end without sending is
 * not matched. There is no judgement call here and therefore no wolf to cry.
 */

import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const APPS_DIR = fileURLToPath(new URL("../../", import.meta.url));

/** Methods on `reply` that write a response. */
const SENDERS = [
  "notFound",
  "badRequest",
  "conflict",
  "forbidden",
  "unauthorized",
  "internalServerError",
  "gone",
  "unprocessableEntity",
  "tooManyRequests",
  "send",
  "code",
  "status",
].join("|");

/** `reply.<sender>(…)[.chained(…)] ;` on one statement, then a bare `return;`. */
const UNRETURNED_REPLY = new RegExp(
  String.raw`reply\.(?:${SENDERS})\s*\((?:[^()]|\([^()]*\))*\)` +
    String.raw`(?:\.[a-zA-Z]+\((?:[^()]|\([^()]*\))*\))*\s*;\s*\n\s*return\s*;`,
  "g",
);

const typescriptFilesUnder = (directory: string): string[] => {
  try {
    return readdirSync(directory, { recursive: true, encoding: "utf8" })
      .filter((entry) => entry.endsWith(".ts") && !entry.endsWith(".d.ts"))
      .map((entry) => `${directory}/${entry}`);
  } catch {
    return [];
  }
};

const serviceSourceFiles = (): string[] =>
  readdirSync(APPS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .flatMap((entry) => typescriptFilesUnder(`${APPS_DIR}${entry.name}/src`));

const sourceFiles = serviceSourceFiles();

type Offender = { file: string; line: number; statement: string };

const findUnreturnedReplies = (): Offender[] => {
  const offenders: Offender[] = [];
  for (const file of sourceFiles) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(UNRETURNED_REPLY)) {
      offenders.push({
        file: file.slice(APPS_DIR.length),
        line: source.slice(0, match.index!).split("\n").length,
        statement: match[0].split("\n")[0]!.trim(),
      });
    }
  }
  return offenders;
};

describe("route handlers ↔ reply lifecycle", () => {
  it("finds the source files to check", () => {
    // A glob that silently matched nothing would make this suite vacuously green.
    expect(sourceFiles.length).toBeGreaterThan(200);
    expect(sourceFiles.some((file) => file.includes("/routes/"))).toBe(true);
  });

  it("recognises the crashing shape and leaves correct code alone", () => {
    // Pin the matcher against the exact defect and its fix, so a regex that
    // drifts into matching nothing fails here rather than reporting green.
    const crashing = `
      if (!rule) {
        reply.notFound("PRICING_RULE_NOT_FOUND");
        return;
      }`;
    const fixed = `
      if (!rule) {
        return reply.notFound("PRICING_RULE_NOT_FOUND");
      }`;
    const chained = `
        reply.status(201).send({ data: created });
        return;`;
    const returningAValue = `
        reply.header("x-total", count);
        return rows;`;

    expect([...crashing.matchAll(UNRETURNED_REPLY)]).toHaveLength(1);
    expect([...chained.matchAll(UNRETURNED_REPLY)]).toHaveLength(1);
    expect([...fixed.matchAll(UNRETURNED_REPLY)]).toHaveLength(0);
    expect([...returningAValue.matchAll(UNRETURNED_REPLY)]).toHaveLength(0);
  });

  it("returns every reply it sends", () => {
    const offenders = findUnreturnedReplies();

    const summary = offenders
      .map((offender) => `  ✗ ${offender.file}:${offender.line}  ${offender.statement}`)
      .join("\n");

    expect(
      offenders.map((offender) => `${offender.file}:${offender.line}`).sort(),
      `\nHandlers that send a reply and then resolve with \`undefined\`. Fastify\n` +
        `tries to send a second time on an already-written socket, throws\n` +
        `ERR_HTTP_HEADERS_SENT outside the route error handler, and the process\n` +
        `exits — a single request for a missing record kills the service:\n${summary}\n\n` +
        `Return the reply instead: \`return reply.notFound(...)\`.\n`,
    ).toEqual([]);
  });
});
