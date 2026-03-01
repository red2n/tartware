import type { DerivedRateInput, LosTieredInput, ProrationInput } from "@tartware/schemas";
import {
  DerivedRateInputSchema,
  LosTieredInputSchema,
  ProrationInputSchema,
} from "@tartware/schemas";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { calculateDerivedRate, calculateLosTiered, prorateDaily } from "../engines/proration.js";
import { observeCalculationDuration, recordCalculation } from "../lib/metrics.js";

export function registerProrationRoutes(app: FastifyInstance) {
  app.post(
    "/v1/calculations/proration/daily",
    {
      schema: {
        description: "Prorate a daily rate based on hours occupied (partial day)",
        tags: ["proration"],
      },
    },
    async (request: FastifyRequest<{ Body: ProrationInput }>, reply: FastifyReply) => {
      const parsed = ProrationInputSchema.safeParse(request.body);
      if (!parsed.success) return reply.badRequest(parsed.error.message);
      const start = performance.now();
      const result = prorateDaily(parsed.data);
      observeCalculationDuration("proration", "daily", (performance.now() - start) / 1000);
      recordCalculation("proration", "daily", "success");
      return result;
    },
  );

  app.post(
    "/v1/calculations/proration/los-tiered",
    {
      schema: {
        description: "Calculate total stay cost using LOS-tiered pricing (Day 1-2: $X, Day 3+: $Y)",
        tags: ["proration"],
      },
    },
    async (request: FastifyRequest<{ Body: LosTieredInput }>, reply: FastifyReply) => {
      const parsed = LosTieredInputSchema.safeParse(request.body);
      if (!parsed.success) return reply.badRequest(parsed.error.message);
      const start = performance.now();
      const result = calculateLosTiered(parsed.data);
      observeCalculationDuration("proration", "los_tiered", (performance.now() - start) / 1000);
      recordCalculation("proration", "los_tiered", "success");
      return result;
    },
  );

  app.post(
    "/v1/calculations/proration/derived-rate",
    {
      schema: {
        description:
          "Calculate derived rate from parent rate minus percentage (e.g. Member = BAR - 10%)",
        tags: ["proration"],
      },
    },
    async (request: FastifyRequest<{ Body: DerivedRateInput }>, reply: FastifyReply) => {
      const parsed = DerivedRateInputSchema.safeParse(request.body);
      if (!parsed.success) return reply.badRequest(parsed.error.message);
      const start = performance.now();
      const result = calculateDerivedRate(parsed.data);
      observeCalculationDuration("proration", "derived_rate", (performance.now() - start) / 1000);
      recordCalculation("proration", "derived_rate", "success");
      return result;
    },
  );
}
