import assert from "node:assert/strict";

import type { QueryResult, QueryResultRow } from "pg";

import { runTest } from "../../tests/helpers/run-test.js";
import { upsertConsumerOffset } from "../consumer-offset-repository.js";

type ConsumerQueryExecutor = NonNullable<Parameters<typeof upsertConsumerOffset>[1]>;

const buildQueryRecorder = () => {
  const calls: Array<{ text: string; params: unknown[] }> = [];
  const response: QueryResult = {
    command: "INSERT",
    rowCount: 0,
    oid: 0,
    fields: [],
    rows: [],
  };
  const stub: ConsumerQueryExecutor = {
    query: <TRow extends QueryResultRow = QueryResultRow>(text: string, params: unknown[]) => {
      calls.push({ text, params });
      return Promise.resolve(response as unknown as QueryResult<TRow>);
    },
  };
  return {
    calls,
    stub,
  };
};

await runTest("upsertConsumerOffset normalizes optional fields", async () => {
  const { stub, calls } = buildQueryRecorder();

  await upsertConsumerOffset(
    {
      consumerGroup: "roll-service-shadow",
      topic: "reservations.events",
      partition: 2,
      offset: 123n,
    },
    stub,
  );

  assert.equal(calls.length, 1);
  const firstCall = calls[0];
  assert.ok(firstCall, "expected query invocation");
  const params = firstCall.params;
  assert.equal(params[4], null, "high watermark should default to null");
  assert.equal(params[5], null, "eventId should default to null");
  assert.equal(params[6], null, "eventCreatedAt should default to null");
});

await runTest(
  "upsertConsumerOffset serializes timestamps and accepts client overrides",
  async () => {
    const { stub, calls } = buildQueryRecorder();
    const eventCreatedAt = new Date("2025-03-03T08:00:00Z");

    await upsertConsumerOffset(
      {
        consumerGroup: "roll-service-shadow",
        topic: "reservations.events",
        partition: 0,
        offset: "456",
        highWatermark: 789,
        eventId: "00000000-0000-0000-0000-000000000003",
        eventCreatedAt,
      },
      stub,
    );

    assert.equal(calls.length, 1);
    const firstCall = calls[0];
    assert.ok(firstCall, "expected query invocation");
    const params = firstCall.params;
    assert.equal(params[3], "456");
    assert.equal(params[4], 789);
    assert.equal(params[5], "00000000-0000-0000-0000-000000000003");
    assert.equal(params[6], eventCreatedAt.toISOString());
  },
);
