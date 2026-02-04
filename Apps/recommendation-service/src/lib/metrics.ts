import { Registry, collectDefaultMetrics } from "prom-client";

export const metricsRegistry = new Registry();

collectDefaultMetrics({ register: metricsRegistry });

// Add recommendation-specific metrics
import { Counter, Histogram } from "prom-client";

export const recommendationRequestsTotal = new Counter({
  name: "recommendation_requests_total",
  help: "Total number of recommendation requests",
  labelNames: ["status", "source"],
  registers: [metricsRegistry],
});

export const recommendationDurationHistogram = new Histogram({
  name: "recommendation_duration_seconds",
  help: "Duration of recommendation pipeline execution",
  labelNames: ["stage"],
  buckets: [0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [metricsRegistry],
});

export const candidatesProcessedHistogram = new Histogram({
  name: "recommendation_candidates_processed",
  help: "Number of candidates processed at each stage",
  labelNames: ["stage"],
  buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000],
  registers: [metricsRegistry],
});
