import { buildRouteSchema, schemaFromZod } from "@tartware/openapi";
import type { HealthResponse } from "@tartware/schemas";
import { HealthResponseSchema } from "@tartware/schemas";
import type { FastifyInstance } from "fastify";

import { isRedisHealthy } from "../lib/redis.js";

const HealthResponseJsonSchema = schemaFromZod(HealthResponseSchema, "CoreHealthResponse");

export const registerHealthRoutes = (app: FastifyInstance): void => {
  app.get(
    "/health",
    {
      // Skip ALL hooks (including auth)
      onRequest: [],
      preValidation: [],
      schema: buildRouteSchema({
        tag: "Health",
        summary: "Core service health probe",
        response: {
          200: HealthResponseJsonSchema,
        },
      }),
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

  app.get(
    "/ready",
    {
      // Skip ALL hooks (including auth)
      onRequest: [],
      preValidation: [],
    },
    async () => ({ status: "ready" }),
  );
};
