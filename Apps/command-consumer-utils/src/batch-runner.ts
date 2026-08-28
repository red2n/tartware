import type {
  BatchCommandResult,
  BatchItemOutcome,
  BatchItemResult,
} from "@tartware/schemas/events/commands/batch";

import { CommandError } from "./command-utils.js";

/**
 * The one place a batch command is executed.
 *
 * Every mass operation in the product — mass cancel, mass check-in, mass
 * update, and the group bulk actions WS-15 adds later — runs through this. The
 * alternative, which this repository already had three examples of
 * (`batchNoShowSweep`, `groupCheckIn`, `waitlistExpireSweep`), is a separate
 * loop per operation, each with its own idea of what a partial failure means
 * and its own result shape, none of which survive the consumer.
 *
 * ## One transaction per target, and no transaction around the batch
 *
 * The runner never opens a transaction. Each item's handler owns its own, so
 * item 7 failing leaves items 1–6 applied and durable. That is deliberate: a
 * mass cancel of 200 bookings across 200 folios cannot be one transaction
 * without holding row locks on all of them for the length of the run, and an
 * operator who cancelled 200 rooms would rather know that 199 went through than
 * have the lot silently rolled back. The price is that a batch is *not* atomic,
 * which is why the per-item record exists.
 */

/** Identity of a single batch run. */
export interface BatchRunContext {
  tenantId: string;
  commandName: string;
  batchId: string;
  propertyId?: string;
  correlationId?: string;
  actorId?: string;
}

/** What a handler reports back about one item it applied. */
export interface BatchItemApplied {
  /** The entity acted on, recorded so a result row can be traced to it. */
  targetId?: string;
  /** Event the item enqueued, for following it downstream. */
  eventId?: string;
  metadata?: Record<string, unknown>;
}

/** The envelope fields the runner reads. Matches `buildBatchCommandSchema`. */
export interface BatchEnvelope<TItem> {
  items: TItem[];
  continue_on_error: boolean;
  dry_run: boolean;
  batch_id?: string;
}

export interface BatchRunHandlers<TItem> {
  /**
   * The entity this item targets, read from the item itself before anything is
   * attempted.
   *
   * Without it a failed item records no `target_id` — the handler throws before
   * it can report one — and the operator reading the results sees "item 1
   * failed" with no way to tell which booking that was without re-deriving it
   * from the request they sent. The index alone is not an answer at 3am.
   */
  targetIdOf?: (item: TItem, index: number) => string | undefined;
  /**
   * Apply one item. Owns its own transaction. Throw a {@link CommandError} to
   * fail the item with a machine-readable code; any other throw is recorded as
   * `BATCH_ITEM_ERROR`.
   */
  applyItem: (item: TItem, index: number) => Promise<BatchItemApplied>;
  /**
   * Optional read-only check used *instead of* `applyItem` when `dry_run` is
   * set.
   *
   * Dry run is not a flag passed into `applyItem` for the operator to trust the
   * handler with: a handler that forgets to honour it writes anyway, and the
   * one thing a dry run must never do is change something. Here the writing
   * function is simply not called, so a dry run cannot write however the
   * handler is written. A handler that supplies no validator reports every item
   * `SKIPPED`, which is honest — it means the run checked nothing.
   */
  validateItem?: (item: TItem, index: number) => Promise<BatchItemApplied>;
}

/**
 * Persistence for batch results. Injected so the runner can be tested without a
 * database, and so a caller that does not want results stored can pass nothing.
 */
export interface BatchResultStore {
  /**
   * Claim the batch id. Returns the already-finished result when this batch has
   * run before, which is what makes a redelivered batch safe.
   */
  openBatch: (
    context: BatchRunContext,
    input: { total: number; dryRun: boolean },
  ) => Promise<{ claimed: true } | { claimed: false; existing: BatchCommandResult | null }>;
  recordItems: (context: BatchRunContext, items: BatchItemResult[]) => Promise<void>;
  closeBatch: (context: BatchRunContext, result: BatchCommandResult) => Promise<void>;
  failBatch: (context: BatchRunContext, error: CommandError) => Promise<void>;
}

/** Raised when the same `batch_id` is already being run. */
export class BatchAlreadyRunningError extends CommandError {
  constructor(batchId: string) {
    super(
      "BATCH_ALREADY_RUNNING",
      `Batch ${batchId} is already running. Re-run with a new batch_id; a run killed mid-flight leaves its row RUNNING and its applied items in place.`,
      false,
    );
  }
}

const toItemFailure = (error: unknown): { code: string; message: string } => {
  if (error instanceof CommandError) {
    return { code: error.code, message: error.message };
  }
  return {
    code: "BATCH_ITEM_ERROR",
    message: error instanceof Error ? error.message : String(error),
  };
};

/**
 * Run one batch command.
 *
 * Every requested item appears exactly once in the result, whatever happened to
 * it — `succeeded + failed + skipped === total` is the property that makes the
 * result usable as the operator's record of the run.
 */
export const runBatchCommand = async <TItem>(
  context: BatchRunContext,
  envelope: BatchEnvelope<TItem>,
  handlers: BatchRunHandlers<TItem>,
  store?: BatchResultStore,
): Promise<BatchCommandResult> => {
  const startedAt = new Date();
  const total = envelope.items.length;

  if (store) {
    const claim = await store.openBatch(context, { total, dryRun: envelope.dry_run });
    if (!claim.claimed) {
      if (claim.existing) {
        // Already finished. Returning the stored result rather than re-running
        // is the whole point of a client-supplied batch_id: a Kafka
        // redelivery must not cancel two hundred bookings a second time.
        return claim.existing;
      }
      throw new BatchAlreadyRunningError(context.batchId);
    }
  }

  const results: BatchItemResult[] = [];
  let succeeded = 0;
  let failed = 0;
  let skipped = 0;
  let stopped = false;

  try {
    for (const [index, item] of envelope.items.entries()) {
      if (stopped) {
        skipped += 1;
        results.push({
          index,
          outcome: "SKIPPED" satisfies BatchItemOutcome,
          error_code: "BATCH_STOPPED_EARLIER",
          error_message: "Not attempted: an earlier item failed and continue_on_error was false.",
        });
        continue;
      }

      const runItem = envelope.dry_run ? handlers.validateItem : handlers.applyItem;
      if (!runItem) {
        skipped += 1;
        results.push({
          index,
          outcome: "SKIPPED" satisfies BatchItemOutcome,
          error_code: "DRY_RUN_NOT_SUPPORTED",
          error_message: `${context.commandName} has no dry-run validator, so nothing was checked.`,
        });
        continue;
      }

      try {
        const applied = await runItem(item, index);
        // A dry run validated the item; it did not do it.
        if (envelope.dry_run) {
          skipped += 1;
          results.push({
            index,
            target_id: applied.targetId,
            outcome: "SKIPPED" satisfies BatchItemOutcome,
          });
        } else {
          succeeded += 1;
          results.push({
            index,
            target_id: applied.targetId,
            event_id: applied.eventId,
            outcome: "SUCCEEDED" satisfies BatchItemOutcome,
          });
        }
      } catch (error) {
        const failure = toItemFailure(error);
        failed += 1;
        results.push({
          index,
          target_id: handlers.targetIdOf?.(item, index),
          outcome: "FAILED" satisfies BatchItemOutcome,
          error_code: failure.code,
          error_message: failure.message,
        });
        if (!envelope.continue_on_error) {
          stopped = true;
        }
      }
    }

    const result: BatchCommandResult = {
      batch_id: context.batchId,
      command_name: context.commandName,
      total,
      succeeded,
      failed,
      skipped,
      dry_run: envelope.dry_run,
      started_at: startedAt,
      completed_at: new Date(),
      items: results,
    };

    if (store) {
      await store.recordItems(context, results);
      await store.closeBatch(context, result);
    }

    return result;
  } catch (error) {
    // Something outside an individual item came apart — the iteration itself,
    // or the write of the results. An item refusing is caught above and never
    // reaches here.
    //
    // The store write is inside this try on purpose: a batch whose items all
    // applied but whose `closeBatch` failed would otherwise sit RUNNING
    // forever, and every replay of that batch_id would be refused as already
    // running. Marking it FAILED is the honest state — the items did apply,
    // and the row says the run did not finish cleanly.
    if (store) {
      await store.failBatch(
        context,
        error instanceof CommandError
          ? error
          : new CommandError(
              "BATCH_RUN_ERROR",
              error instanceof Error ? error.message : String(error),
              false,
            ),
      );
    }
    throw error;
  }
};
