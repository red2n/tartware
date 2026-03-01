import type {
  BulkTaxInput,
  InclusiveTaxExtractInput,
  ReverseTaxInput,
  TaxableAmountInput,
} from "@tartware/schemas";
import {
  BulkTaxInputSchema,
  InclusiveTaxExtractInputSchema,
  ReverseTaxInputSchema,
  TaxableAmountInputSchema,
} from "@tartware/schemas";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import {
  calculateBulkTax,
  calculateReverseTax,
  calculateTaxableAmount,
  extractInclusiveTax,
} from "../engines/tax.js";
import { observeCalculationDuration, recordCalculation } from "../lib/metrics.js";

export function registerTaxRoutes(app: FastifyInstance) {
  app.post(
    "/v1/calculations/tax/taxable-amount",
    {
      schema: {
        description: "Calculate taxable amount from unit price and quantity (CORE.md §1.1)",
        tags: ["tax"],
      },
    },
    async (request: FastifyRequest<{ Body: TaxableAmountInput }>, reply: FastifyReply) => {
      const parsed = TaxableAmountInputSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.message });
      }
      const start = performance.now();
      const result = calculateTaxableAmount(parsed.data);
      observeCalculationDuration("tax", "taxable_amount", (performance.now() - start) / 1000);
      recordCalculation("tax", "taxable_amount", "success");
      return result;
    },
  );

  app.post(
    "/v1/calculations/tax/reverse",
    {
      schema: {
        description: "Reverse-calculate per-unit amount from total taxable (CORE.md §1.2)",
        tags: ["tax"],
      },
    },
    async (request: FastifyRequest<{ Body: ReverseTaxInput }>, reply: FastifyReply) => {
      const parsed = ReverseTaxInputSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.message });
      }
      const start = performance.now();
      const result = calculateReverseTax(parsed.data);
      observeCalculationDuration("tax", "reverse", (performance.now() - start) / 1000);
      recordCalculation("tax", "reverse", "success");
      return result;
    },
  );

  app.post(
    "/v1/calculations/tax/inclusive-extract",
    {
      schema: {
        description: "Extract inclusive taxes from a gross amount (CORE.md §1.3)",
        tags: ["tax"],
      },
    },
    async (request: FastifyRequest<{ Body: InclusiveTaxExtractInput }>, reply: FastifyReply) => {
      const parsed = InclusiveTaxExtractInputSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.message });
      }
      const start = performance.now();
      const result = extractInclusiveTax(parsed.data);
      observeCalculationDuration("tax", "inclusive_extract", (performance.now() - start) / 1000);
      recordCalculation("tax", "inclusive_extract", "success");
      return result;
    },
  );

  app.post(
    "/v1/calculations/tax/bulk",
    {
      schema: {
        description: "Calculate taxes for multiple line items (CORE.md §1.4)",
        tags: ["tax"],
      },
    },
    async (request: FastifyRequest<{ Body: BulkTaxInput }>, reply: FastifyReply) => {
      const parsed = BulkTaxInputSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.message });
      }
      const start = performance.now();
      const result = calculateBulkTax(parsed.data);
      observeCalculationDuration("tax", "bulk", (performance.now() - start) / 1000);
      recordCalculation("tax", "bulk", "success");
      return result;
    },
  );
}
