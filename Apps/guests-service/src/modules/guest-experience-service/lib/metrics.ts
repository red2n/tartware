import { Counter, Gauge, Histogram, Registry } from "prom-client";

export const metricsRegistry = new Registry();

const commandOutcomeCounter = new Counter({
  name: "guest_experience_command_outcomes_total",
  help: "Count of guest-experience commands processed by outcome",
  labelNames: ["command", "status"] as const,
  registers: [metricsRegistry],
});

const commandDurationHistogram = new Histogram({
  name: "guest_experience_command_processing_duration_seconds",
  help: "Duration of guest-experience command processing",
  labelNames: ["command"] as const,
  registers: [metricsRegistry],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
});

const commandConsumerLagGauge = new Gauge({
  name: "guest_experience_command_consumer_lag",
  help: "Approximate number of messages between current offset and the latest Kafka high watermark",
  labelNames: ["topic", "partition"] as const,
  registers: [metricsRegistry],
});

const checkinOutcomeCounter = new Counter({
  name: "guest_experience_checkin_outcomes_total",
  help: "Count of mobile check-in operations by outcome",
  labelNames: ["step", "status"] as const,
  registers: [metricsRegistry],
});

const checkinDurationHistogram = new Histogram({
  name: "guest_experience_checkin_duration_seconds",
  help: "Duration of mobile check-in steps",
  labelNames: ["step"] as const,
  registers: [metricsRegistry],
  buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10],
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

export const recordCheckinOutcome = (
  step: "start" | "complete",
  status: "success" | "failed" | "invalid",
): void => {
  checkinOutcomeCounter.labels(step, status).inc();
};

export const observeCheckinDuration = (step: string, durationSeconds: number): void => {
  checkinDurationHistogram.observe({ step }, durationSeconds);
};
