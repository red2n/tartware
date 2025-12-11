import { reliabilityConfig } from "../config.js";
import { query } from "../lib/db.js";

export type IdempotencyStatus = "PENDING" | "ACKED" | "FAILED";

export interface IdempotencyRecord {
  id: string;
  tenant_id: string;
  idempotency_key: string;
  command_type: string;
  resource_id: string | null;
  status: IdempotencyStatus;
  payload: Record<string, unknown> | null;
  response: Record<string, unknown> | null;
  event_id: string | null;
  correlation_id: string | null;
  last_error: string | null;
  attempt_count: number;
  max_attempts: number;
  last_attempt_at: string | null;
  next_retry_at: string | null;
  locked_by: string | null;
  locked_at: string | null;
  created_at: string;
  updated_at: string;
}

const recordFromRow = (row: Record<string, unknown>): IdempotencyRecord =>
  row as IdempotencyRecord;

export const findIdempotencyRecord = async (
  tenantId: string,
  key: string,
): Promise<IdempotencyRecord | null> => {
  const { rows } = await query<IdempotencyRecord>(
    `
      SELECT *
      FROM reservation_command_idempotency
      WHERE tenant_id = $1 AND idempotency_key = $2
      LIMIT 1
    `,
    [tenantId, key],
  );
  return rows[0] ? recordFromRow(rows[0]) : null;
};

export const createPendingIdempotencyRecord = async (params: {
  tenantId: string;
  key: string;
  commandType: string;
  payload: Record<string, unknown>;
  correlationId?: string;
  resourceId?: string;
}): Promise<IdempotencyRecord> => {
  const {
    tenantId,
    key,
    commandType,
    payload,
    correlationId,
    resourceId,
  } = params;
  const { rows } = await query<IdempotencyRecord>(
    `
      INSERT INTO reservation_command_idempotency (
        tenant_id,
        idempotency_key,
        command_type,
        resource_id,
        payload,
        correlation_id,
        status,
        max_attempts
      )
      VALUES ($1, $2, $3, $4, $5::jsonb, $6, 'PENDING', $7)
      ON CONFLICT (tenant_id, idempotency_key)
      DO UPDATE SET
        payload = EXCLUDED.payload,
        command_type = EXCLUDED.command_type,
        correlation_id = COALESCE(EXCLUDED.correlation_id, reservation_command_idempotency.correlation_id),
        resource_id = COALESCE(EXCLUDED.resource_id, reservation_command_idempotency.resource_id),
        status = 'PENDING',
        last_error = NULL,
        response = NULL,
        event_id = NULL,
        next_retry_at = NULL,
        locked_at = NULL,
        locked_by = NULL,
        updated_at = NOW()
      RETURNING *
    `,
    [
      tenantId,
      key,
      commandType,
      resourceId ?? null,
      JSON.stringify(payload),
      correlationId ?? null,
      reliabilityConfig.defaultMaxAttempts,
    ],
  );
  return recordFromRow(rows[0]);
};

export const markIdempotencyRecordAcked = async (
  recordId: string,
  eventId: string,
  response: Record<string, unknown>,
): Promise<void> => {
  await query(
    `
      UPDATE reservation_command_idempotency
      SET status = 'ACKED',
          event_id = $2,
          response = $3::jsonb,
          last_error = NULL,
          attempt_count = attempt_count + 1,
          last_attempt_at = NOW(),
          next_retry_at = NULL,
          locked_at = NULL,
          locked_by = NULL
      WHERE id = $1
    `,
    [recordId, eventId, JSON.stringify(response)],
  );
};

export const markIdempotencyRecordFailed = async (
  record: Pick<IdempotencyRecord, "id" | "attempt_count" | "max_attempts">,
  error: unknown,
): Promise<void> => {
  const attemptNumber = record.attempt_count + 1;
  const shouldRetry = attemptNumber < record.max_attempts;
  const exponentialFactor = Math.min(record.attempt_count, 10);
  const delayMs =
    reliabilityConfig.retryBaseDelayMs * 2 ** exponentialFactor;
  const nextRetryDelay = Math.min(delayMs, reliabilityConfig.retryMaxBackoffMs);
  const nextRetryAt =
    shouldRetry && nextRetryDelay > 0
      ? new Date(Date.now() + nextRetryDelay)
      : null;

  await query(
    `
      UPDATE reservation_command_idempotency
      SET status = 'FAILED',
          last_error = $2,
          attempt_count = $3,
          last_attempt_at = NOW(),
          next_retry_at = $4,
          locked_at = NULL,
          locked_by = NULL
      WHERE id = $1
    `,
    [
      record.id,
      error instanceof Error ? error.message : String(error),
      attemptNumber,
      nextRetryAt ? nextRetryAt.toISOString() : null,
    ],
  );
};

export const claimRetryBatch = async (
  workerId: string,
  limit: number,
): Promise<IdempotencyRecord[]> => {
  const { rows } = await query<IdempotencyRecord>(
    `
      WITH candidate AS (
        SELECT id
        FROM reservation_command_idempotency
        WHERE status = 'FAILED'
          AND next_retry_at IS NOT NULL
          AND next_retry_at <= NOW()
          AND attempt_count < max_attempts
        ORDER BY next_retry_at ASC
        LIMIT $2
        FOR UPDATE SKIP LOCKED
      )
      UPDATE reservation_command_idempotency rc
      SET locked_by = $1,
          locked_at = NOW(),
          status = 'PENDING'
      FROM candidate
      WHERE rc.id = candidate.id
      RETURNING rc.*
    `,
    [workerId, limit],
  );
  return rows.map(recordFromRow);
};
