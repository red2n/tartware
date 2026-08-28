import { buildValuesRows, maxRowsPerBatch } from "@tartware/config/sql-batch";
import type { BatchCommandResult, BatchItemResult } from "@tartware/schemas/events/commands/batch";
import type { Pool } from "pg";

import type { BatchResultStore, BatchRunContext } from "./batch-runner.js";
import type { CommandError } from "./command-utils.js";

/**
 * Postgres-backed store for {@link runBatchCommand}, over `command_batches` and
 * `command_batch_items`.
 *
 * Separate from the runner so the runner has no database handle of its own:
 * the orchestration is testable without Postgres, and a caller that wants the
 * aggregate without persisting it can leave the store out.
 */

const ITEM_COLUMNS_PER_ROW = 7;

/**
 * A run with nothing failed or skipped is COMPLETED; anything else is PARTIAL.
 *
 * A dry run is the exception: every item comes back SKIPPED by construction, so
 * reporting it PARTIAL would say the run went badly when it did exactly what it
 * was asked to do.
 */
const deriveStatus = (result: BatchCommandResult): "COMPLETED" | "PARTIAL" => {
  if (result.failed > 0) return "PARTIAL";
  if (result.dry_run) return "COMPLETED";
  return result.skipped > 0 ? "PARTIAL" : "COMPLETED";
};

type BatchRow = {
  batch_id: string;
  command_name: string;
  status: string;
  total: number;
  succeeded: number;
  failed: number;
  skipped: number;
  dry_run: boolean;
  started_at: Date;
  completed_at: Date | null;
};

type ItemRow = {
  item_index: number;
  target_id: string | null;
  outcome: BatchItemResult["outcome"];
  event_id: string | null;
  error_code: string | null;
  error_message: string | null;
};

export const createBatchResultStore = (pool: Pool): BatchResultStore => {
  const loadFinishedResult = async (
    tenantId: string,
    batchId: string,
  ): Promise<{ running: boolean; result: BatchCommandResult | null }> => {
    const { rows } = await pool.query<BatchRow>(
      `SELECT batch_id, command_name, status, total, succeeded, failed, skipped,
              dry_run, started_at, completed_at
         FROM command_batches
        WHERE batch_id = $1::uuid AND tenant_id = $2::uuid
        LIMIT 1`,
      [batchId, tenantId],
    );
    const batch = rows[0];
    if (!batch) return { running: false, result: null };
    if (batch.status === "RUNNING") return { running: true, result: null };

    const { rows: itemRows } = await pool.query<ItemRow>(
      `SELECT item_index, target_id, outcome, event_id, error_code, error_message
         FROM command_batch_items
        WHERE batch_id = $1::uuid AND tenant_id = $2::uuid
        ORDER BY item_index`,
      [batchId, tenantId],
    );

    return {
      running: false,
      result: {
        batch_id: batch.batch_id,
        command_name: batch.command_name,
        total: batch.total,
        succeeded: batch.succeeded,
        failed: batch.failed,
        skipped: batch.skipped,
        dry_run: batch.dry_run,
        started_at: batch.started_at,
        completed_at: batch.completed_at ?? batch.started_at,
        items: itemRows.map((row) => ({
          index: row.item_index,
          target_id: row.target_id ?? undefined,
          outcome: row.outcome,
          event_id: row.event_id ?? undefined,
          error_code: row.error_code ?? undefined,
          error_message: row.error_message ?? undefined,
        })),
      },
    };
  };

  return {
    openBatch: async (context, input) => {
      const { rowCount } = await pool.query(
        `INSERT INTO command_batches (
           batch_id, tenant_id, property_id, command_name, status,
           total, dry_run, correlation_id, actor_id
         ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4, 'RUNNING', $5, $6, $7, $8::uuid)
         ON CONFLICT (batch_id) DO NOTHING`,
        [
          context.batchId,
          context.tenantId,
          context.propertyId ?? null,
          context.commandName,
          input.total,
          input.dryRun,
          context.correlationId ?? null,
          context.actorId ?? null,
        ],
      );

      if (rowCount === 1) return { claimed: true };

      // The id was taken. Either this batch already ran — in which case the
      // caller gets its stored result instead of running it again — or it is
      // running now, which the runner refuses.
      const existing = await loadFinishedResult(context.tenantId, context.batchId);
      return { claimed: false, existing: existing.result };
    },

    recordItems: async (context: BatchRunContext, items: BatchItemResult[]) => {
      if (items.length === 0) return;

      const perStatement = Math.min(items.length, maxRowsPerBatch(ITEM_COLUMNS_PER_ROW, 2));

      for (let offset = 0; offset < items.length; offset += perStatement) {
        const chunk = items.slice(offset, offset + perStatement);
        const sql = `
          INSERT INTO command_batch_items (
            batch_id, tenant_id, item_index, target_id, outcome,
            event_id, error_code, error_message, metadata
          ) VALUES ${buildValuesRows({
            rowCount: chunk.length,
            columnsPerRow: ITEM_COLUMNS_PER_ROW,
            scalarCount: 2,
            render: (p) =>
              `($1::uuid, $2::uuid, ${p(1)}, ${p(2)}::uuid, ${p(3)}::command_batch_item_outcome, ${p(4)}::uuid, ${p(5)}, ${p(6)}, ${p(7)}::jsonb)`,
          })}
          ON CONFLICT (batch_id, item_index) DO NOTHING`;

        const params: unknown[] = [context.batchId, context.tenantId];
        for (const item of chunk) {
          params.push(
            item.index,
            item.target_id ?? null,
            item.outcome,
            item.event_id ?? null,
            item.error_code ?? null,
            item.error_message ?? null,
            "{}",
          );
        }

        await pool.query(sql, params);
      }
    },

    closeBatch: async (context, result) => {
      await pool.query(
        `UPDATE command_batches
            SET status = $3::command_batch_status,
                succeeded = $4,
                failed = $5,
                skipped = $6,
                completed_at = $7,
                updated_at = NOW()
          WHERE batch_id = $1::uuid AND tenant_id = $2::uuid`,
        [
          context.batchId,
          context.tenantId,
          deriveStatus(result),
          result.succeeded,
          result.failed,
          result.skipped,
          result.completed_at,
        ],
      );
    },

    failBatch: async (context, error: CommandError) => {
      await pool.query(
        `UPDATE command_batches
            SET status = 'FAILED',
                error_code = $3,
                error_message = $4,
                completed_at = NOW(),
                updated_at = NOW()
          WHERE batch_id = $1::uuid AND tenant_id = $2::uuid`,
        [context.batchId, context.tenantId, error.code, error.message],
      );
    },
  };
};
