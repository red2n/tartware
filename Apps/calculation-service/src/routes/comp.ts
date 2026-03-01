import type { CompBalanceInput, CompOfferInput, CompRecalcInput } from "@tartware/schemas";
import {
  CompBalanceInputSchema,
  CompOfferInputSchema,
  CompRecalcInputSchema,
} from "@tartware/schemas";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { calculateCompOffer, recalculateCompBalance, updateCompBalance } from "../engines/comp.js";
import { observeCalculationDuration, recordCalculation } from "../lib/metrics.js";

export function registerCompRoutes(app: FastifyInstance) {
  app.post(
    "/v1/calculations/comp/offer",
    {
      schema: {
        description: "Apply comp offer discount — percentage or fixed amount (CORE.md §2.11-2.13)",
        tags: ["comp"],
      },
    },
    async (request: FastifyRequest<{ Body: CompOfferInput }>, reply: FastifyReply) => {
      const parsed = CompOfferInputSchema.safeParse(request.body);
      if (!parsed.success) return reply.status(400).send({ error: parsed.error.message });
      const start = performance.now();
      const result = calculateCompOffer(parsed.data);
      observeCalculationDuration("comp", "offer", (performance.now() - start) / 1000);
      recordCalculation("comp", "offer", "success");
      return result;
    },
  );

  app.post(
    "/v1/calculations/comp/balance",
    {
      schema: {
        description: "Update comp per-day balance after consumption (CORE.md §14.1)",
        tags: ["comp"],
      },
    },
    async (request: FastifyRequest<{ Body: CompBalanceInput }>, reply: FastifyReply) => {
      const parsed = CompBalanceInputSchema.safeParse(request.body);
      if (!parsed.success) return reply.status(400).send({ error: parsed.error.message });
      const start = performance.now();
      const result = updateCompBalance(parsed.data);
      observeCalculationDuration("comp", "balance", (performance.now() - start) / 1000);
      recordCalculation("comp", "balance", "success");
      return result;
    },
  );

  app.post(
    "/v1/calculations/comp/recalc",
    {
      schema: {
        description: "Recalculate comp balance when authorized amount changes (CORE.md §14.2)",
        tags: ["comp"],
      },
    },
    async (request: FastifyRequest<{ Body: CompRecalcInput }>, reply: FastifyReply) => {
      const parsed = CompRecalcInputSchema.safeParse(request.body);
      if (!parsed.success) return reply.status(400).send({ error: parsed.error.message });
      const start = performance.now();
      const result = recalculateCompBalance(parsed.data);
      observeCalculationDuration("comp", "recalc", (performance.now() - start) / 1000);
      recordCalculation("comp", "recalc", "success");
      return result;
    },
  );
}
