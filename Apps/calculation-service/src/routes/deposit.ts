import type {
  DepositCapInput,
  DepositEntireStayInput,
  DepositPerGuestInput,
} from "@tartware/schemas";
import {
  DepositCapInputSchema,
  DepositEntireStayInputSchema,
  DepositPerGuestInputSchema,
} from "@tartware/schemas";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import {
  calculateDepositCap,
  calculateDepositEntireStay,
  calculateDepositPerGuest,
} from "../engines/deposit.js";
import { observeCalculationDuration, recordCalculation } from "../lib/metrics.js";

export function registerDepositRoutes(app: FastifyInstance) {
  app.post(
    "/v1/calculations/deposit/entire-stay",
    {
      schema: {
        description: "Calculate deposit as percentage of total stay (CORE.md §8.1)",
        tags: ["deposit"],
      },
    },
    async (request: FastifyRequest<{ Body: DepositEntireStayInput }>, reply: FastifyReply) => {
      const parsed = DepositEntireStayInputSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.badRequest(parsed.error.message);
      }
      const start = performance.now();
      const result = calculateDepositEntireStay(parsed.data);
      observeCalculationDuration("deposit", "entire_stay", (performance.now() - start) / 1000);
      recordCalculation("deposit", "entire_stay", "success");
      return result;
    },
  );

  app.post(
    "/v1/calculations/deposit/per-guest",
    {
      schema: {
        description: "Calculate per-guest deposit amount (CORE.md §8.2)",
        tags: ["deposit"],
      },
    },
    async (request: FastifyRequest<{ Body: DepositPerGuestInput }>, reply: FastifyReply) => {
      const parsed = DepositPerGuestInputSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.badRequest(parsed.error.message);
      }
      const start = performance.now();
      const result = calculateDepositPerGuest(parsed.data);
      observeCalculationDuration("deposit", "per_guest", (performance.now() - start) / 1000);
      recordCalculation("deposit", "per_guest", "success");
      return result;
    },
  );

  app.post(
    "/v1/calculations/deposit/cap",
    {
      schema: {
        description: "Enforce deposit cap against reservation total (CORE.md §8.3)",
        tags: ["deposit"],
      },
    },
    async (request: FastifyRequest<{ Body: DepositCapInput }>, reply: FastifyReply) => {
      const parsed = DepositCapInputSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.badRequest(parsed.error.message);
      }
      const start = performance.now();
      const result = calculateDepositCap(parsed.data);
      observeCalculationDuration("deposit", "cap", (performance.now() - start) / 1000);
      recordCalculation("deposit", "cap", "success");
      return result;
    },
  );
}
