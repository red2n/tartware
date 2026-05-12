import { Counter, collectDefaultMetrics, Gauge, Histogram, Registry } from "prom-client";

export const metricsRegistry = new Registry();

collectDefaultMetrics({ register: metricsRegistry });

const requestCounter = new Counter({
  name: "availability_guard_requests_total",
  help: "Count of Availability Guard operations",
  labelNames: ["operation", "result"] as const,
  registers: [metricsRegistry],
});

const requestDuration = new Histogram({
  name: "availability_guard_request_duration_seconds",
  help: "Duration of guard operations",
  labelNames: ["operation"] as const,
  registers: [metricsRegistry],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2],
});

const conflictCounter = new Counter({
  name: "availability_guard_lock_conflicts_total",
  help: "Number of detected lock conflicts",
  labelNames: ["tenantId"] as const,
  registers: [metricsRegistry],
});

const notificationMessageCounter = new Counter({
  name: "availability_guard_notification_consumer_messages_total",
  help: "Manual release notification consumer outcomes",
  labelNames: ["status"] as const,
  registers: [metricsRegistry],
});

const notificationChannelCounter = new Counter({
  name: "availability_guard_notification_channel_deliveries_total",
  help: "Delivery attempts by notification channel",
  labelNames: ["channel", "status"] as const,
  registers: [metricsRegistry],
});

const notificationLagHistogram = new Histogram({
  name: "availability_guard_notification_delivery_lag_seconds",
  help: "Lag between manual release event and downstream notification",
  buckets: [1, 5, 15, 30, 60, 120, 300],
  registers: [metricsRegistry],
});

const commandOutcomeCounter = new Counter({
  name: "availability_guard_command_outcomes_total",
  help: "Outcomes of command processing",
  labelNames: ["command", "outcome"] as const,
  registers: [metricsRegistry],
});

const commandDurationHistogram = new Histogram({
  name: "availability_guard_command_processing_duration_seconds",
  help: "Duration of command processing",
  labelNames: ["command"] as const,
  registers: [metricsRegistry],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
});

const commandLagGauge = new Gauge({
  name: "availability_guard_command_consumer_lag",
  help: "Lag of the command consumer",
  labelNames: ["topic", "partition"] as const,
  registers: [metricsRegistry],
});

export const recordGuardRequest = (
  operation: string,
  result: "success" | "conflict" | "error",
): void => {
  requestCounter.labels(operation, result).inc();
};

export const observeGuardRequestDuration = (operation: string, durationSeconds: number): void => {
  requestDuration.observe({ operation }, durationSeconds);
};

export const recordLockConflict = (tenantId: string): void => {
  conflictCounter.labels(tenantId).inc();
};

export const recordNotificationMessage = (status: "processed" | "skipped" | "failed"): void => {
  notificationMessageCounter.labels(status).inc();
};

export const recordNotificationChannelDelivery = (
  channel: "email" | "sms" | "slack" | "log",
  status: "delivered" | "failed",
): void => {
  notificationChannelCounter.labels(channel, status).inc();
};

export const observeNotificationDeliveryLag = (lagSeconds: number | null): void => {
  if (lagSeconds === null || !Number.isFinite(lagSeconds)) {
    return;
  }
  notificationLagHistogram.observe(lagSeconds);
};

export const recordCommandOutcome = (
  command: string,
  outcome: "success" | "handler_error" | "parsing_error",
): void => {
  commandOutcomeCounter.labels(command, outcome).inc();
};

export const observeCommandDuration = (command: string, durationSeconds: number): void => {
  commandDurationHistogram.observe({ command }, durationSeconds);
};

export const setCommandConsumerLag = (topic: string, partition: number, lag: number): void => {
  commandLagGauge.labels(topic, String(partition)).set(lag);
};
