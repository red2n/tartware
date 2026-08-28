/**
 * DEV DOC
 * Module: lib/metrics.ts
 * Purpose: Prometheus metrics for document rendering.
 * Ownership: document-service
 *
 * Rendering is the only thing this service does, and it is CPU-bound, so the
 * duration histogram is the signal that matters: a folio that takes 3 seconds
 * to render is a folio a front desk will print twice.
 */
import { Counter, collectDefaultMetrics, Histogram, Registry } from "prom-client";

export const metricsRegistry = new Registry();
collectDefaultMetrics({ register: metricsRegistry });

const renderTotal = new Counter({
  name: "document_render_total",
  help: "Documents rendered, by template, format and outcome",
  labelNames: ["template", "format", "outcome"] as const,
  registers: [metricsRegistry],
});

const renderDuration = new Histogram({
  name: "document_render_duration_seconds",
  help: "Time to compose and emit a document",
  labelNames: ["template", "format"] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [metricsRegistry],
});

const renderBytes = new Histogram({
  name: "document_render_bytes",
  help: "Size of the rendered document",
  labelNames: ["template", "format"] as const,
  buckets: [1024, 8192, 32768, 131072, 524288, 2097152],
  registers: [metricsRegistry],
});

/** Record one completed render. */
export const recordRender = (input: {
  template: string;
  format: string;
  outcome: "success" | "failure";
  durationSeconds: number;
  bytes?: number;
}): void => {
  const labels = { template: input.template, format: input.format };
  renderTotal.inc({ ...labels, outcome: input.outcome });
  renderDuration.observe(labels, input.durationSeconds);
  if (input.bytes !== undefined) renderBytes.observe(labels, input.bytes);
};
