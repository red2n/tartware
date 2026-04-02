import {
  type CommandConsumerMetricsResult,
  createCommandConsumerMetrics,
} from "@tartware/command-consumer-utils/metrics";
import type { Registry } from "prom-client";

const commandConsumerMetrics: CommandConsumerMetricsResult =
  createCommandConsumerMetrics("housekeeping");

export const metricsRegistry: Registry = commandConsumerMetrics.metricsRegistry;
export const recordCommandOutcome: CommandConsumerMetricsResult["recordCommandOutcome"] =
  commandConsumerMetrics.recordCommandOutcome;
export const observeCommandDuration: CommandConsumerMetricsResult["observeCommandDuration"] =
  commandConsumerMetrics.observeCommandDuration;
export const setCommandConsumerLag: CommandConsumerMetricsResult["setCommandConsumerLag"] =
  commandConsumerMetrics.setCommandConsumerLag;
