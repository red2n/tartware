import type { FastifyInstance } from "fastify";

import { query } from "../lib/db.js";
import { isRedisHealthy } from "../lib/redis.js";

export const registerReadyRoutes = (app: FastifyInstance): void => {
  app.get(
    "/ready",
    {
      onRequest: [],
      preValidation: [],
    },
    async () => {
      const redisHealthy = await isRedisHealthy();
      await query("SELECT 1");

      return {
        status: "ok",
        redis: redisHealthy ? "healthy" : "unavailable",
        db: "healthy",
      };
    },
  );
};
