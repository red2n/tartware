import type { FastifyInstance } from "fastify";

import { isReservationConsumerReady } from "../kafka/consumer.js";
import { query } from "../lib/db.js";

export const registerReadyRoutes = (app: FastifyInstance): void => {
  app.get(
    "/ready",
    {
      onRequest: [],
      preValidation: [],
    },
    async (_, reply) => {
      let dbHealthy = true;
      try {
        await query("SELECT 1");
      } catch (error) {
        dbHealthy = false;
        app.log.error({ err: error }, "Readiness DB check failed");
      }

      const consumerReady = isReservationConsumerReady();

      if (!dbHealthy || !consumerReady) {
        return reply.status(503).send({
          status: "degraded",
          db: dbHealthy ? "healthy" : "unavailable",
          consumer: consumerReady ? "ready" : "initializing",
        });
      }

      return {
        status: "ok",
        db: "healthy",
        consumer: "ready",
      };
    },
  );
};
