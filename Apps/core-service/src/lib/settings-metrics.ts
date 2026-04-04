import { createCommandConsumerMetrics } from "@tartware/command-consumer-utils/metrics";

export const settingsCommandConsumerMetrics = createCommandConsumerMetrics("settings");

export const { recordCommandOutcome, observeCommandDuration, setCommandConsumerLag } =
  settingsCommandConsumerMetrics;
