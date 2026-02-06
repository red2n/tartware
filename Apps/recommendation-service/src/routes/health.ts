import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

export function registerHealthRoutes(app: FastifyInstance) {
  app.get("/health", async (_request: FastifyRequest, reply: FastifyReply) => {
    return reply.send({ status: "ok" });
  });

  app.get("/health/readiness", async (_request: FastifyRequest, reply: FastifyReply) => {
    // Could add DB connectivity check here
    return reply.send({ status: "ready" });
  });
}
