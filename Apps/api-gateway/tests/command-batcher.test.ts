/**
 * Group-commit command ingestion.
 *
 * The batcher decides what reaches the database on the one path every write in
 * the system takes, so the properties asserted here are the ones whose failure
 * is silent or expensive: a duplicate that slips through creates a second copy
 * of a command, an outbox row written for a duplicate publishes it twice, and a
 * caller resolved before COMMIT turns a 202 into a lie.
 */

import { describe, expect, it, vi } from "vitest";

import { createCommandBatcher } from "../src/command-center/command-batcher.js";

type Captured = { sql: string; params: unknown[] };

const outboxRecord = (id: string, tenantId = "11111111-1111-1111-1111-111111111111") => ({
  eventId: id,
  tenantId,
  aggregateId: id,
  aggregateType: "command",
  eventType: "command.reservation.create",
  payload: { metadata: {}, payload: {} },
  headers: { "x-command-name": "reservation.create" },
  correlationId: undefined,
  partitionKey: tenantId,
  metadata: {},
});

const dispatchInput = (
  id: string,
  requestId: string,
  tenantId = "11111111-1111-1111-1111-111111111111",
) => ({
  id,
  commandName: "reservation.create",
  tenantId,
  targetService: "reservations-command-service",
  targetTopic: "commands.primary",
  correlationId: undefined,
  requestId,
  payloadHash: "hash",
  outboxEventId: id,
  routingMetadata: {},
  initiatedBy: null,
  metadata: {},
});

/**
 * Stands in for the pool: records every statement and answers the dedupe
 * lookup from `existingKeys`.
 */
const buildHarness = (existingKeys: string[] = []) => {
  const captured: Captured[] = [];
  let committed = false;

  const queryWithClient = vi.fn(async (_client: unknown, sql: string, params: unknown[] = []) => {
    captured.push({ sql, params });
    if (sql.includes("SELECT tenant_id, command_name, request_id")) {
      const rows = [];
      for (let i = 0; i < params.length; i += 3) {
        const key = `${params[i]} ${params[i + 1]} ${params[i + 2]}`;
        if (existingKeys.includes(key)) {
          rows.push({
            tenant_id: params[i],
            command_name: params[i + 1],
            request_id: params[i + 2],
          });
        }
      }
      return { rows };
    }
    return { rows: [] };
  });

  const withTransaction = vi.fn(async (fn: (client: unknown) => Promise<unknown>) => {
    const result = await fn({});
    committed = true;
    return result;
  });

  const batcher = createCommandBatcher({
    maxDelayMs: 1,
    maxBatchSize: 100,
    withTransaction: withTransaction as never,
    queryWithClient: queryWithClient as never,
    logger: { error: vi.fn() },
  });

  return {
    batcher,
    captured,
    queryWithClient,
    withTransaction,
    didCommit: () => committed,
    statement: (fragment: string) => captured.find((entry) => entry.sql.includes(fragment)),
  };
};

describe("createCommandBatcher", () => {
  it("writes one statement per table for the whole batch", async () => {
    const harness = buildHarness();

    const results = await Promise.all(
      ["a", "b", "c"].map((id) =>
        harness.batcher.submit(
          outboxRecord(`0000000${id === "a" ? 1 : id === "b" ? 2 : 3}-0000-4000-8000-000000000000`),
          dispatchInput(
            `0000000${id === "a" ? 1 : id === "b" ? 2 : 3}-0000-4000-8000-000000000000`,
            `req-${id}`,
          ),
        ),
      ),
    );

    expect(results).toEqual([true, true, true]);
    // One transaction, and one INSERT per table — not one per command.
    expect(harness.withTransaction).toHaveBeenCalledTimes(1);
    const outboxInserts = harness.captured.filter((entry) =>
      entry.sql.includes("INSERT INTO transactional_outbox"),
    );
    const dispatchInserts = harness.captured.filter((entry) =>
      entry.sql.includes("INSERT INTO command_dispatches"),
    );
    expect(outboxInserts).toHaveLength(1);
    expect(dispatchInserts).toHaveLength(1);
  });

  it("binds every row's parameters, not just the first", async () => {
    // The off-by-one this repo has hit twice: placeholders that drift bind each
    // row after the first to the wrong column.
    const harness = buildHarness();
    await Promise.all([
      harness.batcher.submit(
        outboxRecord("00000001-0000-4000-8000-000000000000"),
        dispatchInput("00000001-0000-4000-8000-000000000000", "req-a"),
      ),
      harness.batcher.submit(
        outboxRecord("00000002-0000-4000-8000-000000000000"),
        dispatchInput("00000002-0000-4000-8000-000000000000", "req-b"),
      ),
    ]);

    const insert = harness.statement("INSERT INTO transactional_outbox");
    expect(insert).toBeDefined();
    const placeholders = [...(insert as Captured).sql.matchAll(/\$(\d+)/g)].map((m) => Number(m[1]));
    // Contiguous 1..N with no gaps or repeats, and matching the parameter count.
    expect(Math.max(...placeholders)).toBe((insert as Captured).params.length);
    expect(new Set(placeholders).size).toBe((insert as Captured).params.length);
  });

  it("reports a duplicate as not inserted", async () => {
    const tenant = "11111111-1111-1111-1111-111111111111";
    const harness = buildHarness([`${tenant} reservation.create req-dup`]);

    const [fresh, duplicate] = await Promise.all([
      harness.batcher.submit(
        outboxRecord("00000001-0000-4000-8000-000000000000"),
        dispatchInput("00000001-0000-4000-8000-000000000000", "req-new"),
      ),
      harness.batcher.submit(
        outboxRecord("00000002-0000-4000-8000-000000000000"),
        dispatchInput("00000002-0000-4000-8000-000000000000", "req-dup"),
      ),
    ]);

    expect(fresh).toBe(true);
    expect(duplicate).toBe(false);
  });

  it("writes no outbox row for a duplicate, so it cannot publish twice", async () => {
    const tenant = "11111111-1111-1111-1111-111111111111";
    const harness = buildHarness([`${tenant} reservation.create req-dup`]);

    await Promise.all([
      harness.batcher.submit(
        outboxRecord("00000001-0000-4000-8000-000000000000"),
        dispatchInput("00000001-0000-4000-8000-000000000000", "req-new"),
      ),
      harness.batcher.submit(
        outboxRecord("00000002-0000-4000-8000-000000000000"),
        dispatchInput("00000002-0000-4000-8000-000000000000", "req-dup"),
      ),
    ]);

    const insert = harness.statement("INSERT INTO transactional_outbox") as Captured;
    // Only the fresh command's event id may appear.
    expect(insert.params).toContain("00000001-0000-4000-8000-000000000000");
    expect(insert.params).not.toContain("00000002-0000-4000-8000-000000000000");
  });

  it("skips both inserts when every command in the batch is a duplicate", async () => {
    const tenant = "11111111-1111-1111-1111-111111111111";
    const harness = buildHarness([`${tenant} reservation.create req-dup`]);

    const result = await harness.batcher.submit(
      outboxRecord("00000002-0000-4000-8000-000000000000"),
      dispatchInput("00000002-0000-4000-8000-000000000000", "req-dup"),
    );

    expect(result).toBe(false);
    expect(harness.statement("INSERT INTO transactional_outbox")).toBeUndefined();
    expect(harness.statement("INSERT INTO command_dispatches")).toBeUndefined();
  });

  it("resolves only after the transaction commits", async () => {
    // A 202 promises durability. Resolving before COMMIT would make it a lie.
    const harness = buildHarness();
    const pending = harness.batcher.submit(
      outboxRecord("00000001-0000-4000-8000-000000000000"),
      dispatchInput("00000001-0000-4000-8000-000000000000", "req-a"),
    );
    await pending;
    expect(harness.didCommit()).toBe(true);
  });

  it("rejects every caller when the batch fails, rather than losing one silently", async () => {
    const harness = buildHarness();
    harness.withTransaction.mockRejectedValueOnce(new Error("deadlock detected"));

    const results = await Promise.allSettled([
      harness.batcher.submit(
        outboxRecord("00000001-0000-4000-8000-000000000000"),
        dispatchInput("00000001-0000-4000-8000-000000000000", "req-a"),
      ),
      harness.batcher.submit(
        outboxRecord("00000002-0000-4000-8000-000000000000"),
        dispatchInput("00000002-0000-4000-8000-000000000000", "req-b"),
      ),
    ]);

    expect(results.every((entry) => entry.status === "rejected")).toBe(true);
  });

  it("inserts the outbox row before the dispatch row that references it", async () => {
    // command_dispatches.outbox_event_id is NOT NULL REFERENCES
    // transactional_outbox(event_id) — the other order fails the constraint.
    const harness = buildHarness();
    await harness.batcher.submit(
      outboxRecord("00000001-0000-4000-8000-000000000000"),
      dispatchInput("00000001-0000-4000-8000-000000000000", "req-a"),
    );

    const order = harness.captured.map((entry) =>
      entry.sql.includes("INSERT INTO transactional_outbox")
        ? "outbox"
        : entry.sql.includes("INSERT INTO command_dispatches")
          ? "dispatch"
          : "lookup",
    );
    expect(order.indexOf("outbox")).toBeLessThan(order.indexOf("dispatch"));
  });
});
