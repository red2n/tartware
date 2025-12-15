import {
  Counter,
  collectDefaultMetrics,
  Gauge,
  Histogram,
  Registry,
} from "prom-client";

/**
 * Shared Prometheus registry exposed via the /metrics endpoint.
 */
export const metricsRegistry = new Registry();

collectDefaultMetrics({
  register: metricsRegistry,
});

const retryCounter = new Counter({
  name: "reservation_event_retries_total",
  help: "Number of retry attempts performed by the reservation event handler",
  labelNames: ["reason"] as const,
  registers: [metricsRegistry],
});

const dlqCounter = new Counter({
  name: "reservation_event_dlq_total",
  help: "Count of reservation events routed to the dead-letter topic",
  labelNames: ["reason"] as const,
  registers: [metricsRegistry],
});

const processingDurationHistogram = new Histogram({
  name: "reservation_event_processing_duration_seconds",
  help: "Duration of reservation event processing",
  labelNames: ["topic", "partition"] as const,
  registers: [metricsRegistry],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
});

const consumerLagGauge = new Gauge({
  name: "reservation_event_consumer_lag",
  help: "Approximate number of messages between current offset and the latest Kafka high watermark",
  labelNames: ["topic", "partition"] as const,
  registers: [metricsRegistry],
});

const outboxQueueGauge = new Gauge({
  name: "reservation_outbox_pending_records",
  help: "Approximate number of pending/failed records waiting in the transactional outbox",
  registers: [metricsRegistry],
});

const outboxPublishDuration = new Histogram({
  name: "reservation_outbox_publish_duration_seconds",
  help: "Time spent publishing a transactional outbox record to Kafka",
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2],
  registers: [metricsRegistry],
});

const lifecycleCheckpointCounter = new Counter({
  name: "reservation_lifecycle_checkpoint_total",
  help: "Total lifecycle guard checkpoints stamped by state/source",
  labelNames: ["state", "source"] as const,
  registers: [metricsRegistry],
});

const lifecycleStalledGauge = new Gauge({
  name: "reservation_lifecycle_stalled_total",
  help: "Count of lifecycle checkpoints older than the stale threshold, grouped by state",
  labelNames: ["state"] as const,
  registers: [metricsRegistry],
});

const ratePlanFallbackCounter = new Counter({
  name: "reservation_rate_plan_fallback_total",
  help: "Number of automatic BAR/RACK fallback decisions applied",
  labelNames: ["code"] as const,
  registers: [metricsRegistry],
});

/**
 * Records a retry attempt for observability dashboards.
 */
export const recordRetryAttempt = (reason: string): void => {
  retryCounter.labels(reason).inc();
};

/**
 * Records that an event has been sent to the DLQ.
 */
export const recordDlqEvent = (reason: string): void => {
  dlqCounter.labels(reason).inc();
};

/**
 * Observes the total processing duration for an event message.
 */
export const observeProcessingDuration = (
  topic: string,
  partition: number,
  durationSeconds: number,
): void => {
  processingDurationHistogram.observe(
    { topic, partition: String(partition) },
    durationSeconds,
  );
};

/**
 * Updates the consumer lag gauge for a partition.
 */
export const setConsumerLag = (
  topic: string,
  partition: number,
  lag: number,
): void => {
  consumerLagGauge.set({ topic, partition: String(partition) }, lag);
};

/**
 * Updates the gauge that reflects pending transactional outbox rows.
 */
export const setOutboxQueueSize = (size: number): void => {
  outboxQueueGauge.set(size);
};

/**
 * Observes how long it took to publish an outbox record to Kafka.
 */
export const observeOutboxPublishDuration = (durationSeconds: number): void => {
  outboxPublishDuration.observe(durationSeconds);
};

/**
 * Records a lifecycle guard checkpoint emission.
 */
export const recordLifecycleCheckpointMetric = (
  state: string,
  source: string,
): void => {
  lifecycleCheckpointCounter.labels(state, source).inc();
};

/**
 * Updates the stalled lifecycle gauge for a given state.
 */
export const setLifecycleStalledCount = (
  state: string,
  count: number,
): void => {
  lifecycleStalledGauge.set({ state }, count);
};

/**
 * Records that a rate plan fallback (BAR/RACK) was applied.
 */
export const recordRatePlanFallback = (code: string): void => {
  ratePlanFallbackCounter.labels(code).inc();
};
