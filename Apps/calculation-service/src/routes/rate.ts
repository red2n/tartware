import type {
  OccupancyRateInput,
  PackageRateInput,
  QuoteInput,
  RateOverrideInput,
} from "@tartware/schemas";
import {
  OccupancyRateInputSchema,
  PackageRateInputSchema,
  QuoteInputSchema,
  RateOverrideInputSchema,
} from "@tartware/schemas";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import {
  calculateOccupancyRate,
  calculatePackageRate,
  calculateQuote,
  calculateRateOverride,
} from "../engines/rate.js";
import { observeCalculationDuration, recordCalculation } from "../lib/metrics.js";

export function registerRateRoutes(app: FastifyInstance) {
  app.post(
    "/v1/calculations/rate/override",
    {
      schema: {
        description: "Apply rate override by adjustment type (CORE.md §2.1)",
        tags: ["rate"],
      },
    },
    async (request: FastifyRequest<{ Body: RateOverrideInput }>, reply: FastifyReply) => {
      const parsed = RateOverrideInputSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.badRequest(parsed.error.message);
      }
      const start = performance.now();
      const result = calculateRateOverride(parsed.data);
      observeCalculationDuration("rate", "override", (performance.now() - start) / 1000);
      recordCalculation("rate", "override", "success");
      return result;
    },
  );

  app.post(
    "/v1/calculations/rate/occupancy",
    {
      schema: {
        description: "Calculate occupancy-based rate with surcharges (CORE.md §2.2)",
        tags: ["rate"],
      },
    },
    async (request: FastifyRequest<{ Body: OccupancyRateInput }>, reply: FastifyReply) => {
      const parsed = OccupancyRateInputSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.badRequest(parsed.error.message);
      }
      const start = performance.now();
      const result = calculateOccupancyRate(parsed.data);
      observeCalculationDuration("rate", "occupancy", (performance.now() - start) / 1000);
      recordCalculation("rate", "occupancy", "success");
      return result;
    },
  );

  app.post(
    "/v1/calculations/rate/package",
    {
      schema: {
        description: "Decompose package rate into room and component totals (CORE.md §2.3)",
        tags: ["rate"],
      },
    },
    async (request: FastifyRequest<{ Body: PackageRateInput }>, reply: FastifyReply) => {
      const parsed = PackageRateInputSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.badRequest(parsed.error.message);
      }
      const start = performance.now();
      const result = calculatePackageRate(parsed.data);
      observeCalculationDuration("rate", "package", (performance.now() - start) / 1000);
      recordCalculation("rate", "package", "success");
      return result;
    },
  );

  app.post(
    "/v1/calculations/rate/quote",
    {
      schema: {
        description: "Generate reservation price quote (CORE.md §2.4)",
        tags: ["rate"],
      },
    },
    async (request: FastifyRequest<{ Body: QuoteInput }>, reply: FastifyReply) => {
      const parsed = QuoteInputSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.badRequest(parsed.error.message);
      }
      const start = performance.now();
      const result = calculateQuote(parsed.data);
      observeCalculationDuration("rate", "quote", (performance.now() - start) / 1000);
      recordCalculation("rate", "quote", "success");
      return result;
    },
  );
}
