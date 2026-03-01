import type { YieldRateInput } from "@tartware/schemas";
import { YieldRateInputSchema } from "@tartware/schemas";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { calculateYieldRate } from "../engines/yield.js";
import { observeCalculationDuration, recordCalculation } from "../lib/metrics.js";

export function registerYieldRoutes(app: FastifyInstance) {
  app.post(
    "/v1/calculations/yield/rate",
    {
      schema: {
        description: "Apply yield modifiers to a rate (CORE.md §17)",
        tags: ["yield"],
      },
    },
    async (request: FastifyRequest<{ Body: YieldRateInput }>, reply: FastifyReply) => {
      const parsed = YieldRateInputSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.message });
      }
      const start = performance.now();
      const result = calculateYieldRate(parsed.data);
      observeCalculationDuration("yield", "rate", (performance.now() - start) / 1000);
      recordCalculation("yield", "rate", "success");
      return result;
    },
  );
}
