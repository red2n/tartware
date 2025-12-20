import { collectDefaultMetrics, Gauge, Histogram, Registry } from "prom-client";

export const metricsRegistry = new Registry();

collectDefaultMetrics({
  register: metricsRegistry,
});

const outboxQueueGauge = new Gauge({
  name: "command_center_outbox_pending_records",
  help: "Approximate number of command events waiting in the transactional outbox",
  registers: [metricsRegistry],
});

const outboxPublishHistogram = new Histogram({
  name: "command_center_outbox_publish_duration_seconds",
  help: "Time spent publishing a single command outbox record to Kafka",
  registers: [metricsRegistry],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2],
});

export const setOutboxQueueSize = (size: number): void => {
  outboxQueueGauge.set(size);
};

export const observeOutboxPublishDuration = (durationSeconds: number): void => {
  outboxPublishHistogram.observe(durationSeconds);
};
