/**
 * DEV DOC
 * Module: events/commands/batch.ts
 * Description: The one batch command envelope — a domain-free `BatchCommand<T>` shape, its per-item result contract, and the factory that stamps a concrete batch command out of an item schema
 * Primary exports: buildBatchCommandSchema, BatchCommandResultSchema, BatchItemResultSchema, BatchItemOutcomeEnum
 * @category commands
 * Ownership: Schema package
 */

import { z } from "zod";

/**
 * Ceiling on items in a single batch.
 *
 * A batch arrives as one Kafka message and is processed by one consumer in
 * partition order, so its whole run time is head-of-line blocking for every
 * command queued behind it. 500 targets at ~30ms each is ~15s of stall, which
 * is already more than anyone should want; larger jobs belong in several
 * batches, not a bigger one.
 */
export const BATCH_MAX_ITEMS = 500;

/**
 * What happened to one target.
 *
 * `SKIPPED` is not a soft failure — it means the runner deliberately did not
 * attempt the item: `dry_run` was set, or an earlier item failed with
 * `continue_on_error: false`. An item the handler attempted and refused is
 * `FAILED`, with the refusal's code.
 */
export const BatchItemOutcomeEnum = z.enum(["SUCCEEDED", "FAILED", "SKIPPED"]);

export type BatchItemOutcome = z.infer<typeof BatchItemOutcomeEnum>;

/**
 * Fields every batch command carries, whatever its domain.
 *
 * Held as a raw shape rather than a schema so {@link buildBatchCommandSchema}
 * can spread it beside the caller's own fields — the same way the reversal
 * commands share `reversalBase`.
 */
const batchEnvelopeBase = {
	/**
	 * Client-supplied batch identifier. Supply it to make the batch replayable:
	 * the runner keys its result rows on this, so a redelivered batch reports
	 * against the same row rather than opening a second one. Generated when
	 * absent.
	 */
	batch_id: z.string().uuid().optional(),
	property_id: z.string().uuid().optional(),
	/**
	 * Keep going after an item fails.
	 *
	 * Default true, because the alternative is worse for the operation these
	 * commands exist to serve: a mass cancel of 200 bookings that stops at item
	 * 3 leaves the operator with 197 unknown outcomes and no way to tell which.
	 * Set false only when the items are genuinely dependent on each other.
	 */
	continue_on_error: z.boolean().default(true),
	/**
	 * Resolve and validate every item, change nothing, and report the outcome
	 * each item would have had. Every item comes back `SKIPPED`.
	 */
	dry_run: z.boolean().default(false),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
};

/**
 * Build a concrete batch command schema from the schema of a single item.
 *
 * The envelope is deliberately thin: it names the targets and how to treat a
 * failure, and nothing else. Anything that applies to the whole batch — a
 * reason code, an effective date — belongs in `extraFields`, stated once,
 * rather than repeated on every item.
 *
 * @example
 * const MassCancelSchema = buildBatchCommandSchema(
 *   z.object({ reservation_id: z.string().uuid() }),
 *   { reason_code: z.string().min(1) },
 * );
 */
export const buildBatchCommandSchema = <
	ItemSchema extends z.ZodTypeAny,
	Extra extends z.ZodRawShape = Record<string, never>,
>(
	itemSchema: ItemSchema,
	extraFields?: Extra,
) =>
	z.object({
		...batchEnvelopeBase,
		...((extraFields ?? {}) as Extra),
		items: z.array(itemSchema).min(1).max(BATCH_MAX_ITEMS),
	});

/**
 * The outcome of one target.
 *
 * `index` is the item's position in the request array and is what ties a result
 * back to what was asked for: `target_id` can be absent when the item was
 * rejected before a target could be resolved.
 */
export const BatchItemResultSchema = z.object({
	index: z.number().int().nonnegative(),
	target_id: z.string().optional(),
	outcome: BatchItemOutcomeEnum,
	/**
	 * The event the successful item enqueued, so a caller can follow the item
	 * into `reservation_command_lifecycle` and downstream.
	 */
	event_id: z.string().uuid().optional(),
	/** `CommandError.code` from the refusal — machine-readable, not prose. */
	error_code: z.string().max(100).optional(),
	error_message: z.string().max(2000).optional(),
});

export type BatchItemResult = z.infer<typeof BatchItemResultSchema>;

/**
 * The aggregate a batch run produces.
 *
 * `succeeded + failed + skipped === total` always holds: every requested item
 * is accounted for exactly once, which is the property that makes the result
 * usable as an operator's record of what happened.
 */
export const BatchCommandResultSchema = z.object({
	batch_id: z.string().uuid(),
	command_name: z.string().max(150),
	total: z.number().int().nonnegative(),
	succeeded: z.number().int().nonnegative(),
	failed: z.number().int().nonnegative(),
	skipped: z.number().int().nonnegative(),
	dry_run: z.boolean(),
	started_at: z.coerce.date(),
	completed_at: z.coerce.date(),
	items: z.array(BatchItemResultSchema),
});

export type BatchCommandResult = z.infer<typeof BatchCommandResultSchema>;
