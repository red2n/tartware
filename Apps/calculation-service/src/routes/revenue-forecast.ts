import type {
  DisplacementInput,
  ExtraGuestChargeInput,
  GroupForecastInput,
  NoShowChargeInput,
  OverbookingInput,
} from "@tartware/schemas";
import {
  DisplacementInputSchema,
  ExtraGuestChargeInputSchema,
  GroupForecastInputSchema,
  NoShowChargeInputSchema,
  OverbookingInputSchema,
} from "@tartware/schemas";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import {
  analyzeDisplacement,
  calculateExtraGuestCharge,
  calculateGroupForecast,
  calculateNoShowCharge,
  calculateOverbookingLevel,
} from "../engines/revenue-forecast.js";
import { observeCalculationDuration, recordCalculation } from "../lib/metrics.js";

export function registerRevenueForecastRoutes(app: FastifyInstance) {
  app.post(
    "/v1/calculations/revenue-forecast/overbooking",
    {
      schema: {
        description: "Calculate safe overbooking level from no-show and cancellation rates",
        tags: ["revenue-forecast"],
      },
    },
    async (request: FastifyRequest<{ Body: OverbookingInput }>, reply: FastifyReply) => {
      const parsed = OverbookingInputSchema.safeParse(request.body);
      if (!parsed.success) return reply.status(400).send({ error: parsed.error.message });
      const start = performance.now();
      const result = calculateOverbookingLevel(parsed.data);
      observeCalculationDuration(
        "revenue_forecast",
        "overbooking",
        (performance.now() - start) / 1000,
      );
      recordCalculation("revenue_forecast", "overbooking", "success");
      return result;
    },
  );

  app.post(
    "/v1/calculations/revenue-forecast/group-forecast",
    {
      schema: {
        description: "Forecast group revenue: blocked vs actual pickup (CORE.md §2.20)",
        tags: ["revenue-forecast"],
      },
    },
    async (request: FastifyRequest<{ Body: GroupForecastInput }>, reply: FastifyReply) => {
      const parsed = GroupForecastInputSchema.safeParse(request.body);
      if (!parsed.success) return reply.status(400).send({ error: parsed.error.message });
      const start = performance.now();
      const result = calculateGroupForecast(parsed.data);
      observeCalculationDuration(
        "revenue_forecast",
        "group_forecast",
        (performance.now() - start) / 1000,
      );
      recordCalculation("revenue_forecast", "group_forecast", "success");
      return result;
    },
  );

  app.post(
    "/v1/calculations/revenue-forecast/displacement",
    {
      schema: {
        description:
          "Displacement analysis: should we accept a group block or preserve transient inventory?",
        tags: ["revenue-forecast"],
      },
    },
    async (request: FastifyRequest<{ Body: DisplacementInput }>, reply: FastifyReply) => {
      const parsed = DisplacementInputSchema.safeParse(request.body);
      if (!parsed.success) return reply.status(400).send({ error: parsed.error.message });
      const start = performance.now();
      const result = analyzeDisplacement(parsed.data);
      observeCalculationDuration(
        "revenue_forecast",
        "displacement",
        (performance.now() - start) / 1000,
      );
      recordCalculation("revenue_forecast", "displacement", "success");
      return result;
    },
  );

  app.post(
    "/v1/calculations/revenue-forecast/no-show-charge",
    {
      schema: {
        description: "Calculate no-show charge (industry standard: 1 night + tax + fee)",
        tags: ["revenue-forecast"],
      },
    },
    async (request: FastifyRequest<{ Body: NoShowChargeInput }>, reply: FastifyReply) => {
      const parsed = NoShowChargeInputSchema.safeParse(request.body);
      if (!parsed.success) return reply.status(400).send({ error: parsed.error.message });
      const start = performance.now();
      const result = calculateNoShowCharge(parsed.data);
      observeCalculationDuration(
        "revenue_forecast",
        "no_show_charge",
        (performance.now() - start) / 1000,
      );
      recordCalculation("revenue_forecast", "no_show_charge", "success");
      return result;
    },
  );

  app.post(
    "/v1/calculations/revenue-forecast/extra-guest-charge",
    {
      schema: {
        description:
          "Calculate extra guest surcharges for adults/children beyond included count (CORE.md §2.6)",
        tags: ["revenue-forecast"],
      },
    },
    async (request: FastifyRequest<{ Body: ExtraGuestChargeInput }>, reply: FastifyReply) => {
      const parsed = ExtraGuestChargeInputSchema.safeParse(request.body);
      if (!parsed.success) return reply.status(400).send({ error: parsed.error.message });
      const start = performance.now();
      const result = calculateExtraGuestCharge(parsed.data);
      observeCalculationDuration(
        "revenue_forecast",
        "extra_guest_charge",
        (performance.now() - start) / 1000,
      );
      recordCalculation("revenue_forecast", "extra_guest_charge", "success");
      return result;
    },
  );
}
