import assert from "node:assert/strict";

import type { QueryResult, QueryResultRow } from "pg";

import { runTest } from "../../tests/helpers/run-test.js";
import type { QueryExecutor } from "../checkpoint-repository.js";
import {
  GLOBAL_TENANT_SENTINEL,
  getBackfillCheckpoint,
  upsertBackfillCheckpoint,
} from "../checkpoint-repository.js";

type QueryCall = {
  text: string;
  params: unknown[];
};

type MockCheckpointRow = {
  tenant_id: string;
  last_event_id: string | null;
  last_event_created_at: Date | null;
};

const buildQueryStub = (rows: MockCheckpointRow[]) => {
  const calls: QueryCall[] = [];
  const response: QueryResult<MockCheckpointRow> = {
    command: "SELECT",
    rowCount: rows.length,
    oid: 0,
    fields: [],
    rows,
  };
  const stub: QueryExecutor = {
    query: <TRow extends QueryResultRow = QueryResultRow>(
      text: string,
      params: unknown[],
    ) => {
      calls.push({ text, params });
      return Promise.resolve(response as unknown as QueryResult<TRow>);
    },
  };
  return {
    calls,
    stub,
  };
};

await runTest(
  "getBackfillCheckpoint returns structured checkpoint when row exists",
  async () => {
    const checkpointDate = new Date("2025-01-01T00:00:00.000Z");
    const { stub } = buildQueryStub([
      {
        tenant_id: GLOBAL_TENANT_SENTINEL,
        last_event_id: "00000000-0000-0000-0000-000000000001",
        last_event_created_at: checkpointDate,
      },
    ]);

    const result = await getBackfillCheckpoint(GLOBAL_TENANT_SENTINEL, stub);

    assert.deepEqual(result, {
      tenantId: GLOBAL_TENANT_SENTINEL,
      lastEventId: "00000000-0000-0000-0000-000000000001",
      lastEventCreatedAt: checkpointDate,
    });
  },
);

await runTest(
  "getBackfillCheckpoint returns null when no rows found",
  async () => {
    const { stub } = buildQueryStub([]);

    const result = await getBackfillCheckpoint(GLOBAL_TENANT_SENTINEL, stub);
    assert.equal(result, null);
  },
);

await runTest(
  "upsertBackfillCheckpoint writes ISO timestamp via provided client",
  async () => {
    const { stub, calls } = buildQueryStub([]);
    const checkpointDate = new Date("2025-02-02T12:34:56.000Z");

    await upsertBackfillCheckpoint(
      {
        tenantId: GLOBAL_TENANT_SENTINEL,
        lastEventId: "00000000-0000-0000-0000-000000000002",
        lastEventCreatedAt: checkpointDate,
      },
      stub,
    );

    assert.equal(calls.length, 1);
    const [firstCall] = calls;
    assert.ok(firstCall, "expected a query invocation");
    assert.equal(
      firstCall.params[2],
      checkpointDate.toISOString(),
      "Timestamp should be serialized to ISO string",
    );
  },
);
