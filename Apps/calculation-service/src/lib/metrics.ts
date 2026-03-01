import { Counter, Histogram, Registry } from "prom-client";

export const metricsRegistry = new Registry();

const calculationCounter = new Counter({
  name: "calculation_requests_total",
  help: "Total number of calculation requests by engine and outcome",
  labelNames: ["engine", "operation", "status"] as const,
  registers: [metricsRegistry],
});

const calculationDuration = new Histogram({
  name: "calculation_duration_seconds",
  help: "Duration of calculation operations",
  labelNames: ["engine", "operation"] as const,
  registers: [metricsRegistry],
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25],
});

export const recordCalculation = (
  engine: string,
  operation: string,
  status: "success" | "error",
): void => {
  calculationCounter.labels(engine, operation, status).inc();
};

export const observeCalculationDuration = (
  engine: string,
  operation: string,
  durationSeconds: number,
): void => {
  calculationDuration.observe({ engine, operation }, durationSeconds);
};
