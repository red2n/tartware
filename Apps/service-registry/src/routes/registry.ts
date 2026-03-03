import type { FastifyInstance } from "fastify";

import * as registryStore from "../services/registry-store.js";

interface RegisterBody {
  name: string;
  version: string;
  host: string;
  port: number;
  metadata?: Record<string, unknown>;
}

interface HeartbeatBody {
  name: string;
  port: number;
}

interface DeregisterBody {
  name: string;
  port: number;
}

export const registerRegistryRoutes = (app: FastifyInstance): void => {
  /** Register a service instance. */
  app.post<{ Body: RegisterBody }>("/v1/registry/register", async (request, reply) => {
    const { name, version, host, port, metadata } = request.body;
    if (!name || !version || !host || !port) {
      return reply.badRequest("name, version, host, and port are required");
    }
    const instance = registryStore.register({ name, version, host, port, metadata });
    request.log.info({ instanceId: instance.instanceId }, "service registered");
    return reply.status(201).send(instance);
  });

  /** Heartbeat from a service instance. */
  app.put<{ Body: HeartbeatBody }>("/v1/registry/heartbeat", async (request, reply) => {
    const { name, port } = request.body;
    if (!name || !port) {
      return reply.badRequest("name and port are required");
    }
    const instance = registryStore.heartbeat(name, port);
    if (!instance) {
      return reply.notFound(`No registered instance for ${name}:${port}`);
    }
    return reply.send(instance);
  });

  /** Deregister a service instance. */
  app.delete<{ Body: DeregisterBody }>("/v1/registry/deregister", async (request, reply) => {
    const { name, port } = request.body;
    if (!name || !port) {
      return reply.badRequest("name and port are required");
    }
    const deleted = registryStore.deregister(name, port);
    if (!deleted) {
      return reply.notFound(`No registered instance for ${name}:${port}`);
    }
    request.log.info({ instanceId: `${name}:${port}` }, "service deregistered");
    return reply.send({ instanceId: `${name}:${port}`, status: "deregistered" });
  });

  /** Dashboard: list all registered services with summary. */
  app.get("/v1/registry/services", async (_request, reply) => {
    return reply.send(registryStore.getAllServices());
  });

  /** Get instances of a specific service by name. */
  app.get<{ Params: { name: string } }>("/v1/registry/services/:name", async (request, reply) => {
    const instances = registryStore.getServiceByName(request.params.name);
    if (instances.length === 0) {
      return reply.notFound(`No instances found for service: ${request.params.name}`);
    }
    return reply.send({ name: request.params.name, instances });
  });
};
