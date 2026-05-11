import { createCommandConsumerMetrics } from "@tartware/command-consumer-utils/metrics";
import { Counter } from "prom-client";

const metrics = createCommandConsumerMetrics("billing");

export const {
  metricsRegistry,
  recordCommandOutcome,
  observeCommandDuration,
  setCommandConsumerLag,
} = metrics;

const dlqCounter = new Counter({
  name: "billing_reservation_event_dlq_total",
  help: "Count of billing reservation events routed to the dead-letter topic",
  labelNames: ["reason"] as const,
  registers: [metricsRegistry],
});

export const recordDlqEvent = (reason: string): void => {
  dlqCounter.labels(reason).inc();
};
