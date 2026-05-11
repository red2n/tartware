import { createCommandConsumerMetrics } from "@tartware/command-consumer-utils/metrics";
import { Counter } from "prom-client";

const metrics = createCommandConsumerMetrics("housekeeping");

export const {
  metricsRegistry,
  recordCommandOutcome,
  observeCommandDuration,
  setCommandConsumerLag,
} = metrics;

const dlqCounter = new Counter({
  name: "housekeeping_reservation_event_dlq_total",
  help: "Count of housekeeping reservation events routed to the dead-letter topic",
  labelNames: ["reason"] as const,
  registers: [metricsRegistry],
});

export const recordDlqEvent = (reason: string): void => {
  dlqCounter.labels(reason).inc();
};
