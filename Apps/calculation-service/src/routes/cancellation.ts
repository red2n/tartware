import type { CancellationFeeInput } from "@tartware/schemas";
import { CancellationFeeInputSchema } from "@tartware/schemas";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { calculateCancellationFee } from "../engines/cancellation.js";
import { observeCalculationDuration, recordCalculation } from "../lib/metrics.js";

export function registerCancellationRoutes(app: FastifyInstance) {
  app.post(
    "/v1/calculations/cancellation/fee",
    {
      schema: {
        description: "Calculate cancellation fee based on policy type (CORE.md §10)",
        tags: ["cancellation"],
      },
    },
    async (request: FastifyRequest<{ Body: CancellationFeeInput }>, reply: FastifyReply) => {
      const parsed = CancellationFeeInputSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.badRequest(parsed.error.message);
      }
      const start = performance.now();
      const result = calculateCancellationFee(parsed.data);
      observeCalculationDuration("cancellation", "fee", (performance.now() - start) / 1000);
      recordCalculation("cancellation", "fee", "success");
      return result;
    },
  );
}
