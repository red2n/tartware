/**
 * DEV DOC
 * Module: api/command-batch-rows.ts
 * Purpose: Raw PostgreSQL row shapes for `command_batches` and
 *          `command_batch_items`, the two tables a batch command's results live
 *          in once the 202 has been returned.
 * Ownership: Schema package (single source of truth)
 *
 * These shapes were declared in `Apps/command-center-shared/src/repositories/`
 * and used from two files there, which is the schema-first rule's exact
 * prohibition: a domain type in `Apps/` is a shape only one service can see, so
 * the next reader of these tables writes a second, slightly different copy. The
 * audit that found them found nineteen tables with no type in `schema/` at all;
 * these two are the pair that had one in the wrong place.
 *
 * They are TypeScript types rather than zod objects, matching
 * `reservation-rows.ts`: this is what `pg` hands back, before any API-level
 * mapping, and validating a row the database just produced buys nothing. The
 * outcome literal is the one exception — it is pinned to `BatchItemOutcome` so
 * the read side and the batch envelope cannot drift apart.
 */

import type { BatchItemOutcome } from "../events/commands/batch.js";

/**
 * Lifecycle of a batch run, matching the `command_batch_status` enum.
 *
 * PARTIAL is the state that matters and the reason a batch is not a
 * transaction: the runner opens no transaction around the batch, so item 7
 * failing leaves 1–6 applied and durable, and the run has to be able to say so.
 */
export const COMMAND_BATCH_STATUSES = [
	"RUNNING",
	"COMPLETED",
	"PARTIAL",
	"FAILED",
] as const;

export type CommandBatchStatus = (typeof COMMAND_BATCH_STATUSES)[number];

/** One batch run, as `command_batches` stores it. */
export type CommandBatchRow = {
	batch_id: string;
	command_name: string;
	status: CommandBatchStatus;
	total: number;
	succeeded: number;
	failed: number;
	skipped: number;
	dry_run: boolean;
	property_id: string | null;
	correlation_id: string | null;
	error_code: string | null;
	error_message: string | null;
	started_at: Date;
	completed_at: Date | null;
};

/**
 * One requested item's outcome, as `command_batch_items` stores it.
 *
 * `item_index` is the position in the request array, which is what ties a
 * result back to what was asked for — `target_id` is null when the item was
 * refused before a target could be resolved.
 */
export type CommandBatchItemRow = {
	item_index: number;
	target_id: string | null;
	outcome: BatchItemOutcome;
	event_id: string | null;
	error_code: string | null;
	error_message: string | null;
	duration_ms: number | null;
};

/** A run with its items, which is how the batch read endpoint returns one. */
export type CommandBatchDetail = CommandBatchRow & {
	items: CommandBatchItemRow[];
};
