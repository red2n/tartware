import { Counter, Gauge, Histogram, Registry } from "prom-client";

export const metricsRegistry = new Registry();

const commandOutcomeCounter = new Counter({
  name: "guests_command_outcomes_total",
  help: "Count of guest commands processed by outcome",
  labelNames: ["command", "status"] as const,
  registers: [metricsRegistry],
});

const commandDurationHistogram = new Histogram({
  name: "guests_command_processing_duration_seconds",
  help: "Duration of guest command processing",
  labelNames: ["command"] as const,
  registers: [metricsRegistry],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
});

const commandConsumerLagGauge = new Gauge({
  name: "guests_command_consumer_lag",
  help: "Approximate number of messages between current offset and the latest Kafka high watermark",
  labelNames: ["topic", "partition"] as const,
  registers: [metricsRegistry],
});

export const recordCommandOutcome = (
  commandName: string,
  status: "success" | "parse_error" | "handler_error" | "duplicate",
): void => {
  commandOutcomeCounter.labels(commandName, status).inc();
};

export const observeCommandDuration = (commandName: string, durationSeconds: number): void => {
  commandDurationHistogram.observe({ command: commandName }, durationSeconds);
};

export const setCommandConsumerLag = (topic: string, partition: number, lag: number): void => {
  commandConsumerLagGauge.set({ topic, partition: String(partition) }, lag);
};
