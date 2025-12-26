import {
  Counter,
  collectDefaultMetrics,
  Gauge,
  Histogram,
  Registry,
} from "prom-client";

export const metricsRegistry = new Registry();

collectDefaultMetrics({ register: metricsRegistry });

export const replayDeltaCounter = new Counter({
  name: "roll_service_shadow_replay_delta_total",
  help: "Count of mismatched roll entries detected in shadow mode",
  registers: [metricsRegistry],
});

const replayMatchesCounter = new Counter({
  name: "roll_service_replay_matches_total",
  help: "Shadow ledger entries that already matched the derived lifecycle replay",
  registers: [metricsRegistry],
});

const replayMismatchesCounter = new Counter({
  name: "roll_service_replay_mismatches_total",
  help: "Shadow ledger entries that were updated to fix a drift",
  registers: [metricsRegistry],
});

const replayMissingCounter = new Counter({
  name: "roll_service_replay_missing_total",
  help: "Lifecycle events that had no prior shadow ledger entry",
  registers: [metricsRegistry],
});

export const processingLagGauge = new Gauge({
  name: "roll_service_processing_lag_seconds",
  help: "Kafka consumer lag for the roll service shadow consumer",
  labelNames: ["topic", "partition"],
  registers: [metricsRegistry],
});

export const batchDurationHistogram = new Histogram({
  name: "roll_service_batch_duration_seconds",
  help: "Duration of lifecycle batch processing",
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5],
  registers: [metricsRegistry],
});

export const backfillBatchesCounter = new Counter({
  name: "roll_service_backfill_batches_total",
  help: "Number of backfill batches executed",
  registers: [metricsRegistry],
});

export const backfillRowsCounter = new Counter({
  name: "roll_service_backfill_rows_total",
  help: "Total lifecycle rows replayed into the shadow ledger",
  registers: [metricsRegistry],
});

export const backfillErrorsCounter = new Counter({
  name: "roll_service_backfill_errors_total",
  help: "Count of backfill batches that failed",
  registers: [metricsRegistry],
});

export const backfillBatchDurationHistogram = new Histogram({
  name: "roll_service_backfill_batch_duration_seconds",
  help: "Duration of reservation lifecycle backfill batches",
  buckets: [0.1, 0.25, 0.5, 1, 2, 5, 10],
  registers: [metricsRegistry],
});

export const backfillCheckpointGauge = new Gauge({
  name: "roll_service_backfill_checkpoint_timestamp",
  help: "Unix timestamp (seconds) of the last lifecycle row processed via backfill",
  registers: [metricsRegistry],
});

export const consumerOffsetGauge = new Gauge({
  name: "roll_service_consumer_offset",
  help: "Latest offset persisted for the roll-service Kafka consumer",
  labelNames: ["topic", "partition"],
  registers: [metricsRegistry],
});

export const consumerEventTimestampGauge = new Gauge({
  name: "roll_service_consumer_event_timestamp",
  help: "Unix timestamp (seconds) of the last lifecycle event processed per partition",
  labelNames: ["topic", "partition"],
  registers: [metricsRegistry],
});

export const consumerTimestampDriftGauge = new Gauge({
  name: "roll_service_consumer_timestamp_drift_seconds",
  help: "Difference between wall-clock time and the last processed event timestamp per partition",
  labelNames: ["topic", "partition"],
  registers: [metricsRegistry],
});

export const lifecycleEventsCounter = new Counter({
  name: "roll_service_lifecycle_events_total",
  help: "Lifecycle events handled by the roll service consumer partitioned by result",
  labelNames: ["result"],
  registers: [metricsRegistry],
});

export const lifecycleEventDurationHistogram = new Histogram({
  name: "roll_service_lifecycle_event_duration_seconds",
  help: "Per-event processing duration for lifecycle records",
  buckets: [0.0025, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5],
  registers: [metricsRegistry],
});

export const lifecycleBatchFailuresCounter = new Counter({
  name: "roll_service_lifecycle_batch_failures_total",
  help: "Count of Kafka batches that failed before all offsets were committed",
  registers: [metricsRegistry],
});

export type ReplayDriftStatus = "match" | "mismatch" | "missing";

export const recordReplayDrift = (status: ReplayDriftStatus): void => {
  if (status === "match") {
    replayMatchesCounter.inc();
  } else if (status === "mismatch") {
    replayMismatchesCounter.inc();
    replayDeltaCounter.inc();
  } else {
    replayMissingCounter.inc();
  }
};
