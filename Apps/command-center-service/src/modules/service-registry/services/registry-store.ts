import {
  type ServiceRegistryHeartbeatRequest,
  type ServiceRegistryInstance,
  type ServiceRegistryRegisterRequest,
  type ServiceRegistryServicesResponse,
  ServiceRegistryServicesResponseSchema,
} from "@tartware/schemas";

import { config } from "../../../config.js";
import { incrementRegistryAction, setRegistryServiceCount } from "../../../lib/metrics.js";

const store = new Map<string, ServiceRegistryInstance>();
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
  setRegistryServiceCount("UP", up);
  setRegistryServiceCount("DOWN", down);
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
  name: ServiceRegistryRegisterRequest["name"];
  display_name: ServiceRegistryRegisterRequest["display_name"];
  description: ServiceRegistryRegisterRequest["description"];
  tag: ServiceRegistryRegisterRequest["tag"];
  version: ServiceRegistryRegisterRequest["version"];
  host: ServiceRegistryRegisterRequest["host"];
  port: ServiceRegistryRegisterRequest["port"];
  metadata?: ServiceRegistryRegisterRequest["metadata"];
}): ServiceRegistryInstance {
  const instanceId = buildInstanceId(input.name, input.port);
  const now = new Date().toISOString();

  const existing = store.get(instanceId);
  const instance: ServiceRegistryInstance = {
    instanceId,
    name: input.name,
    display_name: input.display_name,
    description: input.description,
    tag: input.tag,
    version: input.version,
    host: input.host,
    port: input.port,
    status: "UP",
    registeredAt: existing?.registeredAt ?? now,
    lastHeartbeat: now,
    metadata: input.metadata,
  };

  store.set(instanceId, instance);
  incrementRegistryAction("register");
  updateMetrics();
  return instance;
}

export function heartbeat(
  name: ServiceRegistryHeartbeatRequest["name"],
  port: ServiceRegistryHeartbeatRequest["port"],
): ServiceRegistryInstance | undefined {
  const instanceId = buildInstanceId(name, port);
  const instance = store.get(instanceId);
  if (!instance) return undefined;

  instance.status = "UP";
  instance.lastHeartbeat = new Date().toISOString();
  incrementRegistryAction("heartbeat");
  updateMetrics();
  return instance;
}

export function deregister(
  name: ServiceRegistryHeartbeatRequest["name"],
  port: ServiceRegistryHeartbeatRequest["port"],
): boolean {
  const instanceId = buildInstanceId(name, port);
  const instance = store.get(instanceId);
  if (instance) {
    instance.status = "DOWN";
    incrementRegistryAction("deregister");
    updateMetrics();
    return true;
  }
  return false;
}

export function getAllServices(): ServiceRegistryServicesResponse {
  const services = Array.from(store.values()).sort((a, b) => a.port - b.port);
  const up = services.filter((service) => service.status === "UP").length;
  const response = {
    services,
    summary: { total: services.length, up, down: services.length - up },
  };
  return ServiceRegistryServicesResponseSchema.parse(response);
}

export function getServiceByName(name: ServiceRegistryInstance["name"]): ServiceRegistryInstance[] {
  return Array.from(store.values())
    .filter((service) => service.name === name)
    .sort((a, b) => a.port - b.port);
}
