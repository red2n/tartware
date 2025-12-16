import type { FastifyInstance } from "fastify";
import { z } from "zod";

import type { LifecycleEventRecord } from "../lib/lifecycle-guard.js";
import { getLatestLifecycleEvent } from "../lib/lifecycle-guard.js";
import { ReservationCreateCommandSchema } from "../schemas/reservation-command.js";
import { createReservation } from "../services/reservation-command-service.js";

const TenantParamSchema = z.object({
  tenantId: z.string().uuid(),
});

const CorrelationParamSchema = z.object({
  correlationId: z.string().uuid(),
});

export const registerReservationCommandRoutes = (
  app: FastifyInstance,
): void => {
  app.post("/v1/tenants/:tenantId/reservations", async (request, reply) => {
    const { tenantId } = TenantParamSchema.parse(request.params);
    const payload = ReservationCreateCommandSchema.parse(request.body);

    const correlationId =
      (request.headers["x-correlation-id"] as string | undefined) ?? undefined;

    const result = await createReservation(tenantId, payload, {
      correlationId,
    });

    reply.code(202).send({
      status: result.status,
      eventId: result.eventId,
      correlationId: result.correlationId,
    });
  });

  app.get("/v1/lifecycle/:correlationId", async (request, reply) => {
    const { correlationId } = CorrelationParamSchema.parse(request.params);
    const lifecycleEvent: LifecycleEventRecord | null =
      await getLatestLifecycleEvent(correlationId);

    if (!lifecycleEvent) {
      reply.code(404).send({
        status: "not_found",
        correlationId,
      });
      return;
    }

    reply.send({
      correlationId,
      state: lifecycleEvent.state,
      checkpointedAt: lifecycleEvent.checkpointedAt,
      event: lifecycleEvent,
    });
  });
};
