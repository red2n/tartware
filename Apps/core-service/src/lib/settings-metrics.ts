import { createCommandConsumerMetrics } from "@tartware/command-consumer-utils/metrics";

export const { recordCommandOutcome, observeCommandDuration, setCommandConsumerLag } =
  createCommandConsumerMetrics("settings");
