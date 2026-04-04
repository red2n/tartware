import type { RollLedgerEntry, ShadowLedgerRow } from "@tartware/schemas";
import type { QueryResult, QueryResultRow } from "pg";

import { query } from "../lib/db.js";

type QueryExecutor = {
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

const toJson = (value: Record<string, unknown>) => JSON.stringify(value ?? {});

type ExistingLedgerRow = ShadowLedgerRow;

const fetchExistingLedgerRow = async (
  tenantId: string,
  lifecycleEventId: string,
  client?: QueryExecutor,
): Promise<ExistingLedgerRow | null> => {
  const result = await runQuery<ExistingLedgerRow>(
    `
      SELECT
        ledger_id,
        tenant_id,
        reservation_id,
        lifecycle_event_id,
        roll_type,
        roll_date,
        occurred_at,
        source_event_type,
        event_payload
      FROM roll_service_shadow_ledgers
      WHERE tenant_id = $1::uuid
        AND lifecycle_event_id = $2::uuid
      LIMIT 1
    `,
    [tenantId, lifecycleEventId],
    client,
  );
  return result.rows[0] ?? null;
};

const normalizePayload = (payload: Record<string, unknown> | undefined): string =>
  JSON.stringify(payload ?? {});

const rowsMatch = (row: ExistingLedgerRow, entry: RollLedgerEntry): boolean => {
  const occurredAtMs = new Date(row.occurred_at).getTime();
  return (
    row.roll_type === entry.rollType &&
    row.roll_date === entry.rollDate &&
    Number.isFinite(occurredAtMs) &&
    occurredAtMs === entry.occurredAt.getTime() &&
    row.source_event_type === entry.sourceEventType &&
    (row.reservation_id ?? null) === (entry.reservationId ?? null) &&
    normalizePayload(row.event_payload ?? {}) === normalizePayload(entry.payload)
  );
};

export const upsertRollLedgerEntry = async (
  entry: RollLedgerEntry,
  client?: QueryExecutor,
): Promise<"match" | "mismatch" | "missing"> => {
  const existingRow = await fetchExistingLedgerRow(entry.tenantId, entry.lifecycleEventId, client);

  let driftStatus: "match" | "mismatch" | "missing" = "missing";
  if (existingRow) {
    driftStatus = rowsMatch(existingRow, entry) ? "match" : "mismatch";
  }

  await runQuery(
    `
      INSERT INTO roll_service_shadow_ledgers (
        tenant_id,
        reservation_id,
        lifecycle_event_id,
        roll_type,
        roll_date,
        occurred_at,
        source_event_type,
        event_payload
      ) VALUES (
        $1::uuid,
        $2::uuid,
        $3::uuid,
        $4,
        $5::date,
        $6::timestamptz,
        $7,
        $8::jsonb
      )
      ON CONFLICT (tenant_id, lifecycle_event_id) DO UPDATE
      SET
        roll_type = EXCLUDED.roll_type,
        roll_date = EXCLUDED.roll_date,
        occurred_at = EXCLUDED.occurred_at,
        source_event_type = EXCLUDED.source_event_type,
        event_payload = EXCLUDED.event_payload,
        updated_at = NOW()
    `,
    [
      entry.tenantId,
      entry.reservationId ?? null,
      entry.lifecycleEventId,
      entry.rollType,
      entry.rollDate,
      entry.occurredAt.toISOString(),
      entry.sourceEventType,
      toJson(entry.payload),
    ],
    client,
  );

  return driftStatus;
};
