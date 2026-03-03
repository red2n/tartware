import { config } from "../config.js";
import { registeredServicesGauge, registrationCounter } from "../lib/metrics.js";

interface ServiceInstance {
  instanceId: string;
  name: string;
  version: string;
  host: string;
  port: number;
  status: "UP" | "DOWN";
  registeredAt: string;
  lastHeartbeat: string;
  metadata?: Record<string, unknown>;
}

interface RegistrySummary {
  total: number;
  up: number;
  down: number;
}

const store = new Map<string, ServiceInstance>();
let sweepTimer: NodeJS.Timeout | undefined;

function buildInstanceId(name: string, port: number): string {
  return `${name}:${port}`;
}

function updateMetrics(): void {
  let up = 0;
  let down = 0;
  for (const instance of store.values()) {
    if (instance.status === "UP") up++;
    else down++;
  }
  registeredServicesGauge.set({ status: "UP" }, up);
  registeredServicesGauge.set({ status: "DOWN" }, down);
}

/** Mark instances that haven't sent a heartbeat within the TTL as DOWN. */
function sweepStaleInstances(): void {
  const now = Date.now();
  for (const instance of store.values()) {
    if (
      instance.status === "UP" &&
      now - new Date(instance.lastHeartbeat).getTime() > config.registry.heartbeatTtlMs
    ) {
      instance.status = "DOWN";
    }
  }
  updateMetrics();
}

export function startSweep(): void {
  sweepTimer = setInterval(sweepStaleInstances, config.registry.sweepIntervalMs);
  sweepTimer.unref();
}

export function stopSweep(): void {
  if (sweepTimer) {
    clearInterval(sweepTimer);
    sweepTimer = undefined;
  }
}

export function register(input: {
  name: string;
  version: string;
  host: string;
  port: number;
  metadata?: Record<string, unknown>;
}): ServiceInstance {
  const instanceId = buildInstanceId(input.name, input.port);
  const now = new Date().toISOString();

  const existing = store.get(instanceId);
  const instance: ServiceInstance = {
    instanceId,
    name: input.name,
    version: input.version,
    host: input.host,
    port: input.port,
    status: "UP",
    registeredAt: existing?.registeredAt ?? now,
    lastHeartbeat: now,
    metadata: input.metadata,
  };

  store.set(instanceId, instance);
  registrationCounter.inc({ action: "register" });
  updateMetrics();
  return instance;
}

export function heartbeat(name: string, port: number): ServiceInstance | undefined {
  const instanceId = buildInstanceId(name, port);
  const instance = store.get(instanceId);
  if (!instance) return undefined;

  instance.status = "UP";
  instance.lastHeartbeat = new Date().toISOString();
  registrationCounter.inc({ action: "heartbeat" });
  updateMetrics();
  return instance;
}

export function deregister(name: string, port: number): boolean {
  const instanceId = buildInstanceId(name, port);
  const deleted = store.delete(instanceId);
  if (deleted) {
    registrationCounter.inc({ action: "deregister" });
    updateMetrics();
  }
  return deleted;
}

export function getAllServices(): { services: ServiceInstance[]; summary: RegistrySummary } {
  const services = Array.from(store.values()).sort((a, b) => a.port - b.port);
  const up = services.filter((s) => s.status === "UP").length;
  return {
    services,
    summary: { total: services.length, up, down: services.length - up },
  };
}

export function getServiceByName(name: string): ServiceInstance[] {
  return Array.from(store.values())
    .filter((s) => s.name === name)
    .sort((a, b) => a.port - b.port);
}
