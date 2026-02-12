import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { config } from "../config.js";

export function registerHealthRoutes(app: FastifyInstance) {
  app.get("/health", async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      status: "ok",
      service: config.service.name,
      version: config.service.version,
    });
  });

  const readinessResponse = async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({
      status: "ready",
      service: config.service.name,
      version: config.service.version,
    });
  };

  app.get("/ready", readinessResponse);
  app.get("/health/readiness", readinessResponse);
}
