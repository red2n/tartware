import { createCommandConsumerMetrics } from "@tartware/command-consumer-utils/metrics";
import { Counter, Histogram } from "prom-client";

export const {
  metricsRegistry,
  recordCommandOutcome,
  observeCommandDuration,
  setCommandConsumerLag,
} = createCommandConsumerMetrics("guests");

// ─── Check-In Metrics (merged from guest-experience-service) ─────────────────

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

export const recordCheckinOutcome = (
  step: "start" | "complete",
  status: "success" | "failed" | "invalid",
): void => {
  checkinOutcomeCounter.labels(step, status).inc();
};

export const observeCheckinDuration = (step: string, durationSeconds: number): void => {
  checkinDurationHistogram.observe({ step }, durationSeconds);
};
