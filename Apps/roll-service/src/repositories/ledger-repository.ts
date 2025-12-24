import type { QueryResult, QueryResultRow } from "pg";

import { query } from "../lib/db.js";

export type RollComputationType = "EOD" | "CHECKOUT" | "CANCEL" | "UNKNOWN";

export type RollLedgerEntry = {
  tenantId: string;
  reservationId?: string;
  lifecycleEventId: string;
  rollType: RollComputationType;
  rollDate: string;
  occurredAt: Date;
  sourceEventType: string;
  payload: Record<string, unknown>;
};

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

const normalizePayload = (
  payload: Record<string, unknown> | undefined,
): string => JSON.stringify(payload ?? {});

const rowsMatch = (row: ExistingLedgerRow, entry: RollLedgerEntry): boolean => {
  const occurredAtMs = new Date(row.occurred_at).getTime();
  return (
    row.roll_type === entry.rollType &&
    row.roll_date === entry.rollDate &&
    Number.isFinite(occurredAtMs) &&
    occurredAtMs === entry.occurredAt.getTime() &&
    row.source_event_type === entry.sourceEventType &&
    (row.reservation_id ?? null) === (entry.reservationId ?? null) &&
    normalizePayload(row.event_payload ?? {}) ===
      normalizePayload(entry.payload)
  );
};

export const upsertRollLedgerEntry = async (
  entry: RollLedgerEntry,
  client?: QueryExecutor,
): Promise<"match" | "mismatch" | "missing"> => {
  const existingRow = await fetchExistingLedgerRow(
    entry.tenantId,
    entry.lifecycleEventId,
    client,
  );

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

type ShadowLedgerRow = {
  ledger_id: string;
  tenant_id: string;
  reservation_id: string | null;
  lifecycle_event_id: string;
  roll_type: string;
  roll_date: string;
  occurred_at: string;
  source_event_type: string;
  event_payload: Record<string, unknown> | null;
};

export type ShadowLedgerEntry = {
  ledgerId: string;
  tenantId: string;
  reservationId?: string;
  lifecycleEventId: string;
  rollType: string;
  rollDate: string;
  occurredAt: Date;
  sourceEventType: string;
  payload: Record<string, unknown>;
};

const toShadowLedgerEntry = (row: ShadowLedgerRow): ShadowLedgerEntry => ({
  ledgerId: row.ledger_id,
  tenantId: row.tenant_id,
  reservationId: row.reservation_id ?? undefined,
  lifecycleEventId: row.lifecycle_event_id,
  rollType: row.roll_type,
  rollDate: row.roll_date,
  occurredAt: new Date(row.occurred_at),
  sourceEventType: row.source_event_type,
  payload: row.event_payload ?? {},
});

export const fetchShadowLedgersByReservation = async (
  reservationId: string,
): Promise<ShadowLedgerEntry[]> => {
  const result = await runQuery<ShadowLedgerRow>(
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
      WHERE reservation_id = $1::uuid
      ORDER BY occurred_at ASC
    `,
    [reservationId],
  );

  return result.rows.map(toShadowLedgerEntry);
};
