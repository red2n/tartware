import { buildValuesRows } from "@tartware/config/sql-batch";
import type { Pool } from "pg";

/**
 * Shared idempotency callbacks for command-center consumers.
 *
 * Backed by the `command_idempotency` table, primary key
 * `(tenant_id, idempotency_key)`. `recordCommandIdempotency` uses
 * `ON CONFLICT DO NOTHING` so it is itself idempotent.
 */

export type IdempotencyCheckInput = {
  tenantId: string;
  idempotencyKey: string;
  commandName: string;
};

export type IdempotencyRecordInput = IdempotencyCheckInput & {
  commandId?: string;
  processedAt: Date;
};

export type IdempotencyHandlers = {
  checkIdempotency: (input: IdempotencyCheckInput) => Promise<boolean>;
  recordIdempotency: (input: IdempotencyRecordInput) => Promise<void>;
  /**
   * Record a whole Kafka batch's processed commands in one statement.
   *
   * A consumer draining thousands of commands a second cannot afford an insert
   * per message on top of the handler's own work. The batch is written when the
   * batch finishes, which is also when its offsets are committed — so a crash
   * replays exactly the commands that were never recorded.
   */
  recordIdempotencyBatch: (inputs: IdempotencyRecordInput[]) => Promise<void>;
};

/**
 * Build idempotency check + record callbacks bound to the provided pool.
 *
 * The returned object's keys (`checkIdempotency`, `recordIdempotency`) match
 * the parameter names on `createConsumerLifecycle`, so it can be spread
 * directly into the lifecycle config.
 */
export const createIdempotencyHandlers = (pool: Pool): IdempotencyHandlers => {
  const checkIdempotency = async (input: IdempotencyCheckInput): Promise<boolean> => {
    const { rows } = await pool.query<{ cnt: number }>(
      `SELECT 1 AS cnt
         FROM command_idempotency
        WHERE tenant_id = $1::uuid
          AND idempotency_key = $2
        LIMIT 1`,
      [input.tenantId, input.idempotencyKey],
    );
    return (rows.length ?? 0) > 0;
  };

  const recordIdempotency = async (input: IdempotencyRecordInput): Promise<void> => {
    await pool.query(
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

  const recordIdempotencyBatch = async (inputs: IdempotencyRecordInput[]): Promise<void> => {
    if (inputs.length === 0) {
      return;
    }
    await pool.query(
      `INSERT INTO command_idempotency (
         tenant_id, idempotency_key, command_name, command_id, processed_at
       ) VALUES ${buildValuesRows({
         rowCount: inputs.length,
         columnsPerRow: 5,
         scalarCount: 0,
         render: (p) => `(${p(1)}::uuid, ${p(2)}, ${p(3)}, ${p(4)}::uuid, ${p(5)})`,
       })}
       ON CONFLICT (tenant_id, idempotency_key) DO NOTHING`,
      inputs.flatMap((input) => [
        input.tenantId,
        input.idempotencyKey,
        input.commandName,
        input.commandId ?? null,
        input.processedAt,
      ]),
    );
  };

  return { checkIdempotency, recordIdempotency, recordIdempotencyBatch };
};
