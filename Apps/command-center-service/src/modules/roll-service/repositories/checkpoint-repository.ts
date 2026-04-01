import type { QueryResult, QueryResultRow } from "pg";

import { query } from "../lib/db.js";

export type QueryExecutor = {
  query: <TRow extends QueryResultRow = QueryResultRow>(
    text: string,
    params: unknown[],
  ) => Promise<QueryResult<TRow>>;
};

const runQuery = async <TRow extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[],
  client?: QueryExecutor,
): Promise<QueryResult<TRow>> => {
  if (client) {
    return client.query<TRow>(text, params);
  }
  return query<TRow>(text, params);
};

export const GLOBAL_TENANT_SENTINEL = "00000000-0000-0000-0000-000000000000";

export type BackfillCheckpoint = {
  tenantId: string;
  lastEventId: string | null;
  lastEventCreatedAt: Date | null;
};

type CheckpointRow = {
  tenant_id: string;
  last_event_id: string | null;
  last_event_created_at: Date | null;
};

export const getBackfillCheckpoint = async (
  tenantId = GLOBAL_TENANT_SENTINEL,
  client?: QueryExecutor,
): Promise<BackfillCheckpoint | null> => {
  const result = await runQuery<CheckpointRow>(
    `
      SELECT tenant_id, last_event_id, last_event_created_at
      FROM roll_service_backfill_checkpoint
      WHERE tenant_id = $1::uuid
    `,
    [tenantId],
    client,
  );

  const row = result.rows[0];
  if (!row) {
    return null;
  }
  return {
    tenantId: row.tenant_id,
    lastEventId: row.last_event_id ?? null,
    lastEventCreatedAt: row.last_event_created_at ?? null,
  };
};

type BackfillCheckpointInput = {
  tenantId: string;
  lastEventId: string;
  lastEventCreatedAt: Date;
};

export const upsertBackfillCheckpoint = async (
  input: BackfillCheckpointInput,
  client?: QueryExecutor,
): Promise<void> => {
  await runQuery(
    `
      INSERT INTO roll_service_backfill_checkpoint (
        tenant_id,
        last_event_id,
        last_event_created_at,
        updated_at
      )
      VALUES ($1::uuid, $2::uuid, $3::timestamptz, NOW())
      ON CONFLICT (tenant_id) DO UPDATE
      SET
        last_event_id = EXCLUDED.last_event_id,
        last_event_created_at = EXCLUDED.last_event_created_at,
        updated_at = NOW()
    `,
    [input.tenantId, input.lastEventId, input.lastEventCreatedAt.toISOString()],
    client,
  );
};
