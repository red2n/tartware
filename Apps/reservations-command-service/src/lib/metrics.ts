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

const dlqDepthGauge = new Gauge({
  name: "reservation_event_dlq_depth",
  help: "Total backlog recorded on the reservations DLQ topic",
  registers: [metricsRegistry],
});

const dlqThresholdGauge = new Gauge({
  name: "reservation_event_dlq_threshold",
  help: "Configured DLQ backlog thresholds used for alerting",
  labelNames: ["level"] as const,
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

const outboxThrottleWait = new Histogram({
  name: "reservation_outbox_throttle_wait_seconds",
  help: "Time spent waiting on tenant throttle + jitter before publishing to Kafka",
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
  registers: [metricsRegistry],
});

const availabilityGuardRequestCounter = new Counter({
  name: "availability_guard_requests_total",
  help: "Total Availability Guard client calls",
  labelNames: ["method", "status"] as const,
  registers: [metricsRegistry],
});

const availabilityGuardDurationHistogram = new Histogram({
  name: "availability_guard_request_duration_seconds",
  help: "Duration of Availability Guard gRPC requests",
  labelNames: ["method"] as const,
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
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

export const observeOutboxThrottleWait = (durationSeconds: number): void => {
  outboxThrottleWait.observe(durationSeconds);
};

/**
 * Sets the gauge representing DLQ backlog depth.
 */
export const setDlqDepth = (depth: number): void => {
  dlqDepthGauge.set(depth);
};

export const setDlqThresholds = (warn: number, critical: number): void => {
  dlqThresholdGauge.set({ level: "warn" }, warn);
  dlqThresholdGauge.set({ level: "critical" }, critical);
};

export const recordAvailabilityGuardRequest = (
  method: string,
  status: string,
): void => {
  availabilityGuardRequestCounter.labels(method, status).inc();
};

export const observeAvailabilityGuardDuration = (
  method: string,
  durationSeconds: number,
): void => {
  availabilityGuardDurationHistogram.observe({ method }, durationSeconds);
};
