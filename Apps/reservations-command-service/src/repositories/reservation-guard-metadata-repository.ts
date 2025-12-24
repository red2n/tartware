import type { PoolClient, QueryResult, QueryResultRow } from "pg";

import { query } from "../lib/db.js";

type GuardMetadataRow = {
  lock_id: string | null;
  status: string;
  metadata: Record<string, unknown> | null;
  updated_at: Date;
};

export type ReservationGuardMetadata = {
  lockId: string | null;
  status: string;
  metadata: Record<string, unknown>;
  updatedAt: Date;
};

const runQuery = async <TRow extends QueryResultRow>(
  sql: string,
  params: unknown[],
  client?: PoolClient,
): Promise<QueryResult<TRow>> => {
  if (client) {
    return client.query<TRow>(sql, params);
  }
  return query<TRow>(sql, params);
};

export const upsertReservationGuardMetadata = async (
  input: {
    tenantId: string;
    reservationId: string;
    lockId?: string | null;
    status: string;
    metadata?: Record<string, unknown>;
  },
  client?: PoolClient,
): Promise<void> => {
  await runQuery(
    `
      INSERT INTO reservation_guard_locks (
        tenant_id,
        reservation_id,
        lock_id,
        status,
        metadata,
        updated_at
      ) VALUES (
        $1::uuid,
        $2::uuid,
        $3::uuid,
        $4,
        $5::jsonb,
        NOW()
      )
      ON CONFLICT (tenant_id, reservation_id) DO UPDATE
      SET
        lock_id = EXCLUDED.lock_id,
        status = EXCLUDED.status,
        metadata = EXCLUDED.metadata,
        updated_at = NOW()
    `,
    [
      input.tenantId,
      input.reservationId,
      input.lockId ?? null,
      input.status,
      JSON.stringify(input.metadata ?? {}),
    ],
    client,
  );
};

export const getReservationGuardMetadata = async (
  tenantId: string,
  reservationId: string,
  client?: PoolClient,
): Promise<ReservationGuardMetadata | null> => {
  const result = await runQuery<GuardMetadataRow>(
    `
      SELECT lock_id, status, metadata, updated_at
      FROM reservation_guard_locks
      WHERE tenant_id = $1::uuid
        AND reservation_id = $2::uuid
      LIMIT 1
    `,
    [tenantId, reservationId],
    client,
  );

  const row = result.rows[0];
  if (!row) {
    return null;
  }

  return {
    lockId: row.lock_id,
    status: row.status,
    metadata: row.metadata ?? {},
    updatedAt: row.updated_at,
  };
};
