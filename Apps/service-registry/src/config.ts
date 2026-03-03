import { loadServiceConfig } from "@tartware/config";

process.env.SERVICE_NAME = process.env.SERVICE_NAME ?? "@tartware/service-registry";
process.env.SERVICE_VERSION = process.env.SERVICE_VERSION ?? "0.1.0";

const configValues = loadServiceConfig();

/** Heartbeat TTL — mark service DOWN if no heartbeat within this window. */
const heartbeatTtlMs = Number(process.env.REGISTRY_HEARTBEAT_TTL_MS) || 45_000;

/** How often the registry sweeps for stale instances. */
const sweepIntervalMs = Number(process.env.REGISTRY_SWEEP_INTERVAL_MS) || 10_000;

export const config = {
  service: {
    name: configValues.SERVICE_NAME,
    version: configValues.SERVICE_VERSION,
  },
  port: configValues.PORT,
  host: configValues.HOST,
  log: {
    level: configValues.LOG_LEVEL,
    pretty: configValues.LOG_PRETTY,
    requestLogging: configValues.LOG_REQUESTS,
  },
  registry: {
    heartbeatTtlMs,
    sweepIntervalMs,
  },
};
