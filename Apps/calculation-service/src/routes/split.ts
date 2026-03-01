import type {
  SplitByGuestInput,
  SplitByReservationInput,
  SplitComponentInput,
} from "@tartware/schemas";
import {
  SplitByGuestInputSchema,
  SplitByReservationInputSchema,
  SplitComponentInputSchema,
} from "@tartware/schemas";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { splitByGuest, splitByReservation, splitComponent } from "../engines/split.js";
import { observeCalculationDuration, recordCalculation } from "../lib/metrics.js";

export function registerSplitRoutes(app: FastifyInstance) {
  app.post(
    "/v1/calculations/split/by-reservation",
    {
      schema: {
        description: "Split total evenly across reservations (CORE.md §5.1)",
        tags: ["split"],
      },
    },
    async (request: FastifyRequest<{ Body: SplitByReservationInput }>, reply: FastifyReply) => {
      const parsed = SplitByReservationInputSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.message });
      }
      const start = performance.now();
      const result = splitByReservation(parsed.data);
      observeCalculationDuration("split", "by_reservation", (performance.now() - start) / 1000);
      recordCalculation("split", "by_reservation", "success");
      return result;
    },
  );

  app.post(
    "/v1/calculations/split/by-guest",
    {
      schema: {
        description: "Split total by guest count (CORE.md §5.2)",
        tags: ["split"],
      },
    },
    async (request: FastifyRequest<{ Body: SplitByGuestInput }>, reply: FastifyReply) => {
      const parsed = SplitByGuestInputSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.message });
      }
      const start = performance.now();
      const result = splitByGuest(parsed.data);
      observeCalculationDuration("split", "by_guest", (performance.now() - start) / 1000);
      recordCalculation("split", "by_guest", "success");
      return result;
    },
  );

  app.post(
    "/v1/calculations/split/component",
    {
      schema: {
        description: "Split a component rate by divisor (CORE.md §5.3)",
        tags: ["split"],
      },
    },
    async (request: FastifyRequest<{ Body: SplitComponentInput }>, reply: FastifyReply) => {
      const parsed = SplitComponentInputSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: parsed.error.message });
      }
      const start = performance.now();
      const result = splitComponent(parsed.data);
      observeCalculationDuration("split", "component", (performance.now() - start) / 1000);
      recordCalculation("split", "component", "success");
      return result;
    },
  );
}
