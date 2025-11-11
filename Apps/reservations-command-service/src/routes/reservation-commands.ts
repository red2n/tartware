import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { ReservationCreateCommandSchema } from "../schemas/reservation-command.js";
import { createReservation } from "../services/reservation-command-service.js";

const TenantParamSchema = z.object({
  tenantId: z.string().uuid(),
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
};
