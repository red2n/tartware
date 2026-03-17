import { Counter, Gauge, Histogram, Registry } from "prom-client";

export type CommandConsumerMetricsResult = {
  metricsRegistry: Registry;
  recordCommandOutcome: (
    commandName: string,
    status: "success" | "parse_error" | "handler_error" | "duplicate",
  ) => void;
  observeCommandDuration: (commandName: string, durationSeconds: number) => void;
  setCommandConsumerLag: (topic: string, partition: number, lag: number) => void;
};

/**
 * Create the standard set of command consumer metrics with a service-specific prefix.
 * Eliminates boilerplate across all command-consuming services.
 */
export const createCommandConsumerMetrics = (prefix: string): CommandConsumerMetricsResult => {
  const registry = new Registry();

  const outcomeCounter = new Counter({
    name: `${prefix}_command_outcomes_total`,
    help: `Count of ${prefix} commands processed by outcome`,
    labelNames: ["command", "status"] as const,
    registers: [registry],
  });

  const durationHistogram = new Histogram({
    name: `${prefix}_command_processing_duration_seconds`,
    help: `Duration of ${prefix} command processing`,
    labelNames: ["command"] as const,
    registers: [registry],
    buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
  });

  const lagGauge = new Gauge({
    name: `${prefix}_command_consumer_lag`,
    help: "Approximate number of messages between current offset and the latest Kafka high watermark",
    labelNames: ["topic", "partition"] as const,
    registers: [registry],
  });

  return {
    metricsRegistry: registry,
    recordCommandOutcome: (commandName, status) => {
      outcomeCounter.labels(commandName, status).inc();
    },
    observeCommandDuration: (commandName, durationSeconds) => {
      durationHistogram.observe({ command: commandName }, durationSeconds);
    },
    setCommandConsumerLag: (topic, partition, lag) => {
      lagGauge.set({ topic, partition: String(partition) }, lag);
    },
  };
};
