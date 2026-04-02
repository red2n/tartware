import type {
  MoneyToPointsInput,
  PointsRedemptionInput,
  PointsToMoneyInput,
} from "@tartware/schemas";
import {
  MoneyToPointsInputSchema,
  PointsRedemptionInputSchema,
  PointsToMoneyInputSchema,
} from "@tartware/schemas";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { moneyToPoints, pointsToMoney, processRedemption } from "../engines/loyalty.js";
import { observeCalculationDuration, recordCalculation } from "../lib/metrics.js";

export function registerLoyaltyRoutes(app: FastifyInstance) {
  app.post(
    "/v1/calculations/loyalty/points-to-money",
    {
      schema: {
        description: "Convert points to monetary value (CORE.md §13.1, §13.3)",
        tags: ["loyalty"],
      },
    },
    async (request: FastifyRequest<{ Body: PointsToMoneyInput }>, reply: FastifyReply) => {
      const parsed = PointsToMoneyInputSchema.safeParse(request.body);
      if (!parsed.success) return reply.status(400).send({ error: parsed.error.message });
      const start = performance.now();
      const result = pointsToMoney(parsed.data);
      observeCalculationDuration("loyalty", "points_to_money", (performance.now() - start) / 1000);
      recordCalculation("loyalty", "points_to_money", "success");
      return result;
    },
  );

  app.post(
    "/v1/calculations/loyalty/money-to-points",
    {
      schema: {
        description: "Convert monetary amount to points (CORE.md §13.2, §13.4)",
        tags: ["loyalty"],
      },
    },
    async (request: FastifyRequest<{ Body: MoneyToPointsInput }>, reply: FastifyReply) => {
      const parsed = MoneyToPointsInputSchema.safeParse(request.body);
      if (!parsed.success) return reply.status(400).send({ error: parsed.error.message });
      const start = performance.now();
      const result = moneyToPoints(parsed.data);
      observeCalculationDuration("loyalty", "money_to_points", (performance.now() - start) / 1000);
      recordCalculation("loyalty", "money_to_points", "success");
      return result;
    },
  );

  app.post(
    "/v1/calculations/loyalty/redemption",
    {
      schema: {
        description: "Process redemption against per-stay authorization (CORE.md §13.5)",
        tags: ["loyalty"],
      },
    },
    async (request: FastifyRequest<{ Body: PointsRedemptionInput }>, reply: FastifyReply) => {
      const parsed = PointsRedemptionInputSchema.safeParse(request.body);
      if (!parsed.success) return reply.status(400).send({ error: parsed.error.message });
      const start = performance.now();
      const result = processRedemption(parsed.data);
      observeCalculationDuration("loyalty", "redemption", (performance.now() - start) / 1000);
      recordCalculation("loyalty", "redemption", "success");
      return result;
    },
  );
}
