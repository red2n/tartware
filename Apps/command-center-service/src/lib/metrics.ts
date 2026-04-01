import { Counter, collectDefaultMetrics, Gauge, Histogram, Registry } from "prom-client";

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

const outboxThrottleWait = new Histogram({
  name: "command_center_outbox_throttle_wait_seconds",
  help: "Time spent waiting on tenant throttle + jitter before publishing to Kafka",
  registers: [metricsRegistry],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
});

const registryServicesGauge = new Gauge({
  name: "registry_services_total",
  help: "Number of registered service instances by status",
  labelNames: ["status"] as const,
  registers: [metricsRegistry],
});

const registryRegistrationsCounter = new Counter({
  name: "registry_registrations_total",
  help: "Total service registration lifecycle events",
  labelNames: ["action"] as const,
  registers: [metricsRegistry],
});

export const setOutboxQueueSize = (size: number): void => {
  outboxQueueGauge.set(size);
};

export const observeOutboxPublishDuration = (durationSeconds: number): void => {
  outboxPublishHistogram.observe(durationSeconds);
};

export const observeOutboxThrottleWait = (durationSeconds: number): void => {
  outboxThrottleWait.observe(durationSeconds);
};

export const setRegistryServiceCount = (status: "UP" | "DOWN", count: number): void => {
  registryServicesGauge.set({ status }, count);
};

export const incrementRegistryAction = (action: "register" | "heartbeat" | "deregister"): void => {
  registryRegistrationsCounter.inc({ action });
};
