import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { isRedisHealthy } from "../lib/redis.js";

const HealthResponseSchema = z.object({
  status: z.literal("ok"),
  redis: z.object({
    connected: z.boolean(),
    status: z.enum(["healthy", "unavailable"]),
  }),
});

type HealthResponse = z.infer<typeof HealthResponseSchema>;

export const registerHealthRoutes = (app: FastifyInstance): void => {
  app.get(
    "/health",
    {
      // Skip ALL hooks (including auth)
      onRequest: [],
      preValidation: [],
    },
    async () => {
      const redisHealthy = await isRedisHealthy();
      const payload: HealthResponse = {
        status: "ok",
        redis: {
          connected: redisHealthy,
          status: redisHealthy ? "healthy" : "unavailable",
        },
      };
      return HealthResponseSchema.parse(payload);
    },
  );
};
