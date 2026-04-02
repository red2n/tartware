import {
  type ServiceRegistryDeregisterRequest,
  ServiceRegistryDeregisterRequestSchema,
  type ServiceRegistryHeartbeatRequest,
  ServiceRegistryHeartbeatRequestSchema,
  type ServiceRegistryRegisterRequest,
  ServiceRegistryRegisterRequestSchema,
  ServiceRegistryServiceInstancesResponseSchema,
  ServiceRegistryTagEnum,
} from "@tartware/schemas";
import type { FastifyInstance } from "fastify";

import * as registryStore from "../services/registry-store.js";

export const registerRegistryRoutes = (app: FastifyInstance): void => {
  app.post<{ Body: ServiceRegistryRegisterRequest }>(
    "/v1/registry/register",
    async (request, reply) => {
      const { name, display_name, description, tag, version, host, port, metadata } =
        ServiceRegistryRegisterRequestSchema.parse(request.body);
      if (!name || !version || !host || !port) {
        return reply.badRequest("name, version, host, and port are required");
      }
      const instance = registryStore.register({
        name,
        display_name,
        description,
        tag,
        version,
        host,
        port,
        metadata,
      });
      request.log.info({ instanceId: instance.instanceId }, "service registered");
      return reply.status(201).send(instance);
    },
  );

  app.put<{ Body: ServiceRegistryHeartbeatRequest }>(
    "/v1/registry/heartbeat",
    async (request, reply) => {
      const { name, port } = ServiceRegistryHeartbeatRequestSchema.parse(request.body);
      if (!name || !port) {
        return reply.badRequest("name and port are required");
      }
      const instance = registryStore.heartbeat(name, port);
      if (!instance) {
        return reply.notFound(`No registered instance for ${name}:${port}`);
      }
      return reply.send(instance);
    },
  );

  app.delete<{ Body: ServiceRegistryDeregisterRequest }>(
    "/v1/registry/deregister",
    async (request, reply) => {
      const { name, port } = ServiceRegistryDeregisterRequestSchema.parse(request.body);
      if (!name || !port) {
        return reply.badRequest("name and port are required");
      }
      const deleted = registryStore.deregister(name, port);
      if (!deleted) {
        return reply.notFound(`No registered instance for ${name}:${port}`);
      }
      request.log.info({ instanceId: `${name}:${port}` }, "service deregistered");
      return reply.send({ instanceId: `${name}:${port}`, status: "deregistered" });
    },
  );

  app.get("/v1/registry/services", async (_request, reply) => {
    return reply.send(registryStore.getAllServices());
  });

  app.get<{ Params: { name: string } }>("/v1/registry/services/:name", async (request, reply) => {
    const serviceName = ServiceRegistryTagEnum.parse(request.params.name);
    const instances = registryStore.getServiceByName(serviceName);
    if (instances.length === 0) {
      return reply.notFound(`No instances found for service: ${serviceName}`);
    }
    return reply.send(
      ServiceRegistryServiceInstancesResponseSchema.parse({
        name: serviceName,
        instances,
      }),
    );
  });
};
