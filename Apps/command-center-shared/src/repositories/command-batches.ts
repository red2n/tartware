import type {
  BatchCommandResult,
  CommandBatchDetail,
  CommandBatchItemRow,
  CommandBatchRow,
  QueryExecutor,
} from "@tartware/schemas";

// The three row shapes above used to be declared in this file and read from
// two others, which is a domain type living in Apps/ — see
// schema/src/api/command-batch-rows.ts for why they moved. Re-exported so the
// callers that already import them from this repository keep working; new
// readers should take them from @tartware/schemas directly.
export type { CommandBatchDetail, CommandBatchItemRow, CommandBatchRow };

/**
 * Read side of the batch result tables.
 *
 * A batch command is accepted with 202 and runs asynchronously, so its per-item
 * outcomes cannot come back in the response. This is where the operator gets
 * them afterwards — which of the two hundred bookings did not cancel, and why.
 *
 * Read-only on purpose: the rows are written by the runner in the service that
 * owns the domain (`@tartware/command-consumer-utils/batch-repository`), and a
 * second writer is how the counts start disagreeing with the item rows.
 */

const FIND_BATCH_SQL = `
  SELECT batch_id, command_name, status, total, succeeded, failed, skipped,
         dry_run, property_id, correlation_id, error_code, error_message,
         started_at, completed_at
    FROM command_batches
   WHERE batch_id = $1::uuid
     AND tenant_id = $2::uuid
   LIMIT 1
`;

const FIND_BATCH_ITEMS_SQL = `
  SELECT item_index, target_id, outcome, event_id, error_code, error_message, duration_ms
    FROM command_batch_items
   WHERE batch_id = $1::uuid
     AND tenant_id = $2::uuid
   ORDER BY item_index
`;

const LIST_BATCHES_SQL = `
  SELECT batch_id, command_name, status, total, succeeded, failed, skipped,
         dry_run, property_id, correlation_id, error_code, error_message,
         started_at, completed_at
    FROM command_batches
   WHERE tenant_id = $1::uuid
     AND ($2::text IS NULL OR command_name = $2::text)
     AND ($3::uuid IS NULL OR property_id = $3::uuid)
   ORDER BY started_at DESC
   LIMIT $4
`;

export type ListCommandBatchesInput = {
  tenantId: string;
  commandName?: string;
  propertyId?: string;
  limit?: number;
};

export const createCommandBatchRepository = (query: QueryExecutor) => {
  const findCommandBatch = async (
    tenantId: string,
    batchId: string,
  ): Promise<CommandBatchDetail | null> => {
    const { rows } = await query<CommandBatchRow>(FIND_BATCH_SQL, [batchId, tenantId]);
    const batch = rows[0];
    if (!batch) return null;

    const { rows: items } = await query<CommandBatchItemRow>(FIND_BATCH_ITEMS_SQL, [
      batchId,
      tenantId,
    ]);
    return { ...batch, items };
  };

  const listCommandBatches = async (input: ListCommandBatchesInput): Promise<CommandBatchRow[]> => {
    const { rows } = await query<CommandBatchRow>(LIST_BATCHES_SQL, [
      input.tenantId,
      input.commandName ?? null,
      input.propertyId ?? null,
      Math.min(input.limit ?? 50, 200),
    ]);
    return rows;
  };

  return { findCommandBatch, listCommandBatches };
};

export type { BatchCommandResult };
