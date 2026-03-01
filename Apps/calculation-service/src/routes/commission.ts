import type { CommissionAmountInput, CommissionBackCalcInput } from "@tartware/schemas";
import { CommissionAmountInputSchema, CommissionBackCalcInputSchema } from "@tartware/schemas";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { calculateCommissionAmount, calculateCommissionBackCalc } from "../engines/commission.js";
import { observeCalculationDuration, recordCalculation } from "../lib/metrics.js";

export function registerCommissionRoutes(app: FastifyInstance) {
  app.post(
    "/v1/calculations/commission/amount",
    {
      schema: {
        description: "Calculate commission from rate plan total and percentage (CORE.md §11.1)",
        tags: ["commission"],
      },
    },
    async (request: FastifyRequest<{ Body: CommissionAmountInput }>, reply: FastifyReply) => {
      const parsed = CommissionAmountInputSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.badRequest(parsed.error.message);
      }
      const start = performance.now();
      const result = calculateCommissionAmount(parsed.data);
      observeCalculationDuration("commission", "amount", (performance.now() - start) / 1000);
      recordCalculation("commission", "amount", "success");
      return result;
    },
  );

  app.post(
    "/v1/calculations/commission/back-calc",
    {
      schema: {
        description: "Back-calculate commission percentage from known amounts (CORE.md §11.2)",
        tags: ["commission"],
      },
    },
    async (request: FastifyRequest<{ Body: CommissionBackCalcInput }>, reply: FastifyReply) => {
      const parsed = CommissionBackCalcInputSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.badRequest(parsed.error.message);
      }
      const start = performance.now();
      const result = calculateCommissionBackCalc(parsed.data);
      observeCalculationDuration("commission", "back_calc", (performance.now() - start) / 1000);
      recordCalculation("commission", "back_calc", "success");
      return result;
    },
  );
}
