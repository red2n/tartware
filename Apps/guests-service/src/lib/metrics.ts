import { createCommandConsumerMetrics } from "@tartware/command-consumer-utils/metrics";

export const {
  metricsRegistry,
  recordCommandOutcome,
  observeCommandDuration,
  setCommandConsumerLag,
} = createCommandConsumerMetrics("guests");
