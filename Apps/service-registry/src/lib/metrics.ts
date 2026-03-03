import { Counter, Gauge, Registry } from "prom-client";

export const metricsRegistry = new Registry();

export const registeredServicesGauge = new Gauge({
  name: "registry_services_total",
  help: "Number of registered service instances by status",
  labelNames: ["status"] as const,
  registers: [metricsRegistry],
});

export const registrationCounter = new Counter({
  name: "registry_registrations_total",
  help: "Total service registrations",
  labelNames: ["action"] as const,
  registers: [metricsRegistry],
});
