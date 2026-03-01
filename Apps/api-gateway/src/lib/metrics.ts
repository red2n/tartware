import { Counter, collectDefaultMetrics, Histogram, Registry } from "prom-client";

export const metricsRegistry = new Registry();

collectDefaultMetrics({ register: metricsRegistry });

/** Total commands accepted by the gateway (labeled by command name). */
export const commandsAcceptedTotal = new Counter({
  name: "gateway_commands_accepted_total",
  help: "Total commands accepted and dispatched to Kafka.",
  labelNames: ["command_name"] as const,
  registers: [metricsRegistry],
});

/** Proxy request duration histogram (labeled by target service + status). */
export const proxyDurationHistogram = new Histogram({
  name: "gateway_proxy_duration_seconds",
  help: "Proxy request duration from gateway to upstream service.",
  labelNames: ["target", "method", "status"] as const,
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [metricsRegistry],
});

/** Circuit breaker state changes. */
export const circuitBreakerStateTotal = new Counter({
  name: "gateway_circuit_breaker_state_total",
  help: "Circuit breaker state change events.",
  labelNames: ["target", "state"] as const,
  registers: [metricsRegistry],
});
