import { query } from "../lib/db.js";

/**
 * Check whether a command with the given idempotency key has already been
 * processed for this tenant. Uses the `command_idempotency` table with a
 * `(tenant_id, idempotency_key)` primary key for O(1) dedup lookups.
 *
 * @returns `true` if the command is a duplicate (already processed)
 */
export const checkCommandIdempotency = async (input: {
  tenantId: string;
  idempotencyKey: string;
  commandName: string;
}): Promise<boolean> => {
  const { rows } = await query<{ cnt: number }>(
    `SELECT 1 AS cnt
     FROM command_idempotency
     WHERE tenant_id = $1::uuid
       AND idempotency_key = $2
     LIMIT 1`,
    [input.tenantId, input.idempotencyKey],
  );
  return (rows.length ?? 0) > 0;
};

/**
 * Record that a command was successfully processed, preventing future
 * duplicate processing. Uses `ON CONFLICT DO NOTHING` so it is itself
 * idempotent — safe to call multiple times for the same key.
 */
export const recordCommandIdempotency = async (input: {
  tenantId: string;
  idempotencyKey: string;
  commandName: string;
  commandId?: string;
  processedAt: Date;
}): Promise<void> => {
  await query(
    `INSERT INTO command_idempotency (
       tenant_id, idempotency_key, command_name, command_id, processed_at
     ) VALUES ($1::uuid, $2, $3, $4::uuid, $5)
     ON CONFLICT (tenant_id, idempotency_key) DO NOTHING`,
    [
      input.tenantId,
      input.idempotencyKey,
      input.commandName,
      input.commandId ?? null,
      input.processedAt,
    ],
  );
};
