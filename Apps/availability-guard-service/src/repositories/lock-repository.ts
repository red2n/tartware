import type { PoolClient } from "pg";

import { query } from "../lib/db.js";
import type { BulkReleaseInput, LockRoomInput, ReleaseLockInput } from "../types/lock-types.js";

export type InventoryLock = {
  id: string;
  tenant_id: string;
  reservation_id: string | null;
  room_type_id: string;
  room_id: string | null;
  stay_start: Date;
  stay_end: Date;
  expires_at: Date | null;
  status: "ACTIVE" | "RELEASED";
  created_at: Date;
  updated_at: Date;
};

const ACTIVE_STATUSES = ["ACTIVE"] as const;

export const findConflictingLock = async (
  client: PoolClient,
  input: LockRoomInput,
  excludeLockId?: string,
): Promise<InventoryLock | null> => {
  const result = await client.query<InventoryLock>(
    `
      SELECT *
      FROM inventory_locks_shadow
      WHERE tenant_id = $1
        AND status = ANY($2)
        AND (expires_at IS NULL OR expires_at > NOW())
        AND (
          (room_id IS NOT NULL AND room_id = $3)
          OR (room_id IS NULL AND $3 IS NULL AND room_type_id = $4)
        )
        AND NOT ($6 <= stay_start OR $5 >= stay_end)
        AND (id <> $7 OR $7 IS NULL)
      ORDER BY created_at ASC
      LIMIT 1
      FOR UPDATE;
    `,
    [
      input.tenantId,
      ACTIVE_STATUSES,
      input.roomId ?? null,
      input.roomTypeId,
      input.stayStart,
      input.stayEnd,
      excludeLockId ?? null,
    ],
  );
  return result.rows[0] ?? null;
};

export const insertLock = async (
  client: PoolClient,
  input: LockRoomInput & {
    lockId: string;
    expiresAt: Date | null;
    ttlSeconds: number | undefined;
  },
): Promise<InventoryLock> => {
  const result = await client.query<InventoryLock>(
    `
      INSERT INTO inventory_locks_shadow (
        id,
        tenant_id,
        reservation_id,
        room_type_id,
        room_id,
        stay_start,
        stay_end,
        reason,
        correlation_id,
        expires_at,
        ttl_seconds,
        metadata,
        status
      ) VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9,
        $10, $11, $12, 'ACTIVE'
      )
      ON CONFLICT (id) DO UPDATE
      SET
        tenant_id = EXCLUDED.tenant_id,
        reservation_id = EXCLUDED.reservation_id,
        room_type_id = EXCLUDED.room_type_id,
        room_id = EXCLUDED.room_id,
        stay_start = EXCLUDED.stay_start,
        stay_end = EXCLUDED.stay_end,
        reason = EXCLUDED.reason,
        correlation_id = EXCLUDED.correlation_id,
        expires_at = EXCLUDED.expires_at,
        ttl_seconds = EXCLUDED.ttl_seconds,
        metadata = EXCLUDED.metadata,
        status = 'ACTIVE',
        release_reason = NULL,
        updated_at = NOW()
      RETURNING *;
    `,
    [
      input.lockId,
      input.tenantId,
      input.reservationId,
      input.roomTypeId,
      input.roomId ?? null,
      input.stayStart,
      input.stayEnd,
      input.reason,
      input.correlationId ?? null,
      input.expiresAt,
      input.ttlSeconds ?? undefined,
      input.metadata ?? {},
    ],
  );
  const lock = result.rows[0];
  if (!lock) {
    throw new Error("Failed to insert inventory lock");
  }
  return lock;
};

export const releaseLockRecord = async (
  client: PoolClient,
  input: ReleaseLockInput & { releasedAt: Date },
): Promise<InventoryLock | null> => {
  const result = await client.query<InventoryLock>(
    `
      UPDATE inventory_locks_shadow
      SET
        status = 'RELEASED',
        release_reason = $3,
        updated_at = $4,
        metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
          'releasedAt', $4,
          'correlationId', $5
        )
      WHERE id = $1
        AND tenant_id = $2
      RETURNING *;
    `,
    [input.lockId, input.tenantId, input.reason, input.releasedAt, input.correlationId ?? null],
  );
  return result.rows[0] ?? null;
};

export const bulkReleaseLocks = async (
  input: BulkReleaseInput & { releasedAt: Date },
): Promise<number> => {
  const result = await query(
    `
      UPDATE inventory_locks_shadow
      SET
        status = 'RELEASED',
        release_reason = $3,
        updated_at = $4
      WHERE tenant_id = $1
        AND id = ANY($2)
    `,
    [input.tenantId, input.lockIds, input.reason, input.releasedAt],
  );
  return Number(result.rowCount ?? 0);
};
