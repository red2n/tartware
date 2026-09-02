import type { GuardMetadataRow, ReservationGuardMetadata } from "@tartware/schemas";
import type { PoolClient, QueryResult, QueryResultRow } from "pg";

import { query } from "../lib/db.js";

export type { ReservationGuardMetadata };

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

/**
 * Record the guard lock held for one room of a booking.
 *
 * Keyed by `(tenant, reservation, room_sequence)` rather than by reservation:
 * a three-room booking holds three locks, and a release that only knew about
 * one of them would leak the other two until their TTL expired.
 */
export const upsertReservationGuardMetadata = async (
  input: {
    tenantId: string;
    reservationId: string;
    /** Room of the booking this lock holds; 1 for a single-room stay. */
    roomSequence?: number;
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
        room_sequence,
        lock_id,
        status,
        metadata,
        updated_at
      ) VALUES (
        $1::uuid,
        $2::uuid,
        $3::int,
        $4::uuid,
        $5,
        $6::jsonb,
        NOW()
      )
      ON CONFLICT (tenant_id, reservation_id, room_sequence) DO UPDATE
      SET
        lock_id = EXCLUDED.lock_id,
        status = EXCLUDED.status,
        metadata = EXCLUDED.metadata,
        updated_at = NOW()
    `,
    [
      input.tenantId,
      input.reservationId,
      input.roomSequence ?? 1,
      input.lockId ?? null,
      input.status,
      JSON.stringify(input.metadata ?? {}),
    ],
    client,
  );
};

const toGuardMetadata = (row: GuardMetadataRow): ReservationGuardMetadata => ({
  lockId: row.lock_id,
  status: row.status,
  roomSequence: row.room_sequence,
  metadata: row.metadata ?? {},
  updatedAt: row.updated_at,
});

/**
 * Every guard lock a booking holds, in room order. Release paths must walk all
 * of them — a multi-room booking that released only the first room would keep
 * the rest of its inventory held.
 */
export const listReservationGuardMetadata = async (
  tenantId: string,
  reservationId: string,
  client?: PoolClient,
): Promise<ReservationGuardMetadata[]> => {
  const result = await runQuery<GuardMetadataRow>(
    `
      SELECT lock_id, status, room_sequence, metadata, updated_at
      FROM reservation_guard_locks
      WHERE tenant_id = $1::uuid
        AND reservation_id = $2::uuid
      ORDER BY room_sequence
    `,
    [tenantId, reservationId],
    client,
  );

  return result.rows.map(toGuardMetadata);
};

/**
 * The lock on the booking's first room. Kept for callers that only ever deal
 * with single-room stays; anything that releases should use
 * {@link listReservationGuardMetadata} instead.
 */
export const getReservationGuardMetadata = async (
  tenantId: string,
  reservationId: string,
  client?: PoolClient,
): Promise<ReservationGuardMetadata | null> => {
  const result = await runQuery<GuardMetadataRow>(
    `
      SELECT lock_id, status, room_sequence, metadata, updated_at
      FROM reservation_guard_locks
      WHERE tenant_id = $1::uuid
        AND reservation_id = $2::uuid
      ORDER BY room_sequence
      LIMIT 1
    `,
    [tenantId, reservationId],
    client,
  );

  const row = result.rows[0];
  return row ? toGuardMetadata(row) : null;
};
