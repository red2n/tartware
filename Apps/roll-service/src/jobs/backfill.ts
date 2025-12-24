import { performance } from "node:perf_hooks";

import type { FastifyBaseLogger } from "fastify";

import { query, withTransaction } from "../lib/db.js";
import {
  backfillBatchDurationHistogram,
  backfillBatchesCounter,
  backfillCheckpointGauge,
  backfillErrorsCounter,
  backfillRowsCounter,
  recordReplayDrift,
} from "../lib/metrics.js";
import {
  GLOBAL_TENANT_SENTINEL,
  getBackfillCheckpoint,
  upsertBackfillCheckpoint,
} from "../repositories/checkpoint-repository.js";
import { upsertRollLedgerEntry } from "../repositories/ledger-repository.js";
import {
  buildLedgerEntryFromLifecycleRow,
  type LifecycleRow,
} from "../services/roll-ledger-builder.js";

type LifecycleRowResult = LifecycleRow;

const fetchLifecycleBatch = async (
  after: Date | null,
  limit: number,
): Promise<LifecycleRowResult[]> => {
  const result = await query<LifecycleRowResult>(
    `
      SELECT
        event_id,
        tenant_id,
        reservation_id,
        command_name,
        current_state,
        metadata,
        created_at
      FROM reservation_command_lifecycle
      WHERE created_at > COALESCE($1::timestamptz, '1970-01-01'::timestamptz)
      ORDER BY created_at ASC
      LIMIT $2
    `,
    [after ? after.toISOString() : null, limit],
  );

  return result.rows;
};

type BackfillJobOptions = {
  batchSize: number;
  intervalMs: number;
};

export const buildBackfillJob = (
  logger: FastifyBaseLogger,
  options: BackfillJobOptions,
) => {
  let timer: NodeJS.Timeout | null = null;
  let running = false;
  let inFlight = false;

  const processBatch = async () => {
    const startedAt = performance.now();
    const checkpoint = await getBackfillCheckpoint();
    if (checkpoint?.lastEventCreatedAt) {
      backfillCheckpointGauge.set(
        checkpoint.lastEventCreatedAt.getTime() / 1000,
      );
    }

    const rows = await fetchLifecycleBatch(
      checkpoint?.lastEventCreatedAt ?? null,
      options.batchSize,
    );

    if (rows.length === 0) {
      logger.debug("No lifecycle rows available for roll backfill");
      backfillBatchDurationHistogram.observe(
        (performance.now() - startedAt) / 1000,
      );
      return;
    }

    await withTransaction(async (client) => {
      for (const row of rows) {
        const ledgerEntry = buildLedgerEntryFromLifecycleRow(row);
        const driftStatus = await upsertRollLedgerEntry(ledgerEntry, client);
        recordReplayDrift(driftStatus);
      }

      const lastRow = rows[rows.length - 1];
      if (!lastRow) {
        logger.error(
          { rowsProcessed: rows.length },
          "Expected at least one lifecycle row in backfill batch",
        );
        return;
      }
      await upsertBackfillCheckpoint(
        {
          tenantId: GLOBAL_TENANT_SENTINEL,
          lastEventId: lastRow.event_id,
          lastEventCreatedAt: lastRow.created_at,
        },
        client,
      );

      backfillCheckpointGauge.set(lastRow.created_at.getTime() / 1000);
    });

    backfillRowsCounter.inc(rows.length);
    backfillBatchesCounter.inc();
    backfillBatchDurationHistogram.observe(
      (performance.now() - startedAt) / 1000,
    );

    logger.info(
      { processed: rows.length },
      "Roll backfill batch persisted to shadow ledger",
    );
  };

  const runOnce = async () => {
    if (inFlight) {
      logger.warn("Backfill batch already running; skipping tick");
      return;
    }
    inFlight = true;
    try {
      await processBatch();
    } catch (error) {
      backfillErrorsCounter.inc();
      logger.error(error, "Roll backfill batch failed");
    } finally {
      inFlight = false;
    }
  };

  return {
    start: async () => {
      if (running) {
        return;
      }
      running = true;
      await runOnce();
      timer = setInterval(() => {
        void runOnce();
      }, options.intervalMs);
      timer.unref?.();
      logger.info(
        {
          intervalMs: options.intervalMs,
          batchSize: options.batchSize,
        },
        "Roll backfill job scheduled",
      );
    },
    stop: async () => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
      running = false;
      await Promise.resolve();
    },
    runOnce,
  };
};
