import type { ForexConvertInput } from "@tartware/schemas";
import { ForexConvertInputSchema } from "@tartware/schemas";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { convertCurrency } from "../engines/forex.js";
import { observeCalculationDuration, recordCalculation } from "../lib/metrics.js";

export function registerForexRoutes(app: FastifyInstance) {
  app.post(
    "/v1/calculations/forex/convert",
    {
      schema: {
        description: "Convert currency with optional surcharge (CORE.md §12)",
        tags: ["forex"],
      },
    },
    async (request: FastifyRequest<{ Body: ForexConvertInput }>, reply: FastifyReply) => {
      const parsed = ForexConvertInputSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.badRequest(parsed.error.message);
      }
      const start = performance.now();
      const result = convertCurrency(parsed.data);
      observeCalculationDuration("forex", "convert", (performance.now() - start) / 1000);
      recordCalculation("forex", "convert", "success");
      return result;
    },
  );
}
