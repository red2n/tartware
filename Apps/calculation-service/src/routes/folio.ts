import type {
  ArBreakdownInput,
  CreditRemainingInput,
  EstimatedCheckoutInput,
  FolioBalanceInput,
} from "@tartware/schemas";
import {
  ArBreakdownInputSchema,
  CreditRemainingInputSchema,
  EstimatedCheckoutInputSchema,
  FolioBalanceInputSchema,
} from "@tartware/schemas";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import {
  calculateArBreakdown,
  calculateCreditRemaining,
  calculateEstimatedCheckout,
  calculateFolioBalance,
} from "../engines/folio.js";
import { observeCalculationDuration, recordCalculation } from "../lib/metrics.js";

export function registerFolioRoutes(app: FastifyInstance) {
  app.post(
    "/v1/calculations/folio/balance",
    {
      schema: {
        description: "Calculate folio balance from line items (CORE.md §3.1)",
        tags: ["folio"],
      },
    },
    async (request: FastifyRequest<{ Body: FolioBalanceInput }>, reply: FastifyReply) => {
      const parsed = FolioBalanceInputSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.badRequest(parsed.error.message);
      }
      const start = performance.now();
      const result = calculateFolioBalance(parsed.data);
      observeCalculationDuration("folio", "balance", (performance.now() - start) / 1000);
      recordCalculation("folio", "balance", "success");
      return result;
    },
  );

  app.post(
    "/v1/calculations/folio/credit-remaining",
    {
      schema: {
        description: "Calculate remaining credit on an account (CORE.md §3.2)",
        tags: ["folio"],
      },
    },
    async (request: FastifyRequest<{ Body: CreditRemainingInput }>, reply: FastifyReply) => {
      const parsed = CreditRemainingInputSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.badRequest(parsed.error.message);
      }
      const start = performance.now();
      const result = calculateCreditRemaining(parsed.data);
      observeCalculationDuration("folio", "credit_remaining", (performance.now() - start) / 1000);
      recordCalculation("folio", "credit_remaining", "success");
      return result;
    },
  );

  app.post(
    "/v1/calculations/folio/ar-breakdown",
    {
      schema: {
        description: "Compute AR account breakdown (CORE.md §3.3)",
        tags: ["folio"],
      },
    },
    async (request: FastifyRequest<{ Body: ArBreakdownInput }>, reply: FastifyReply) => {
      const parsed = ArBreakdownInputSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.badRequest(parsed.error.message);
      }
      const start = performance.now();
      const result = calculateArBreakdown(parsed.data);
      observeCalculationDuration("folio", "ar_breakdown", (performance.now() - start) / 1000);
      recordCalculation("folio", "ar_breakdown", "success");
      return result;
    },
  );

  app.post(
    "/v1/calculations/folio/estimated-checkout",
    {
      schema: {
        description: "Estimate guest checkout total (CORE.md §18)",
        tags: ["folio"],
      },
    },
    async (request: FastifyRequest<{ Body: EstimatedCheckoutInput }>, reply: FastifyReply) => {
      const parsed = EstimatedCheckoutInputSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.badRequest(parsed.error.message);
      }
      const start = performance.now();
      const result = calculateEstimatedCheckout(parsed.data);
      observeCalculationDuration("folio", "estimated_checkout", (performance.now() - start) / 1000);
      recordCalculation("folio", "estimated_checkout", "success");
      return result;
    },
  );
}
