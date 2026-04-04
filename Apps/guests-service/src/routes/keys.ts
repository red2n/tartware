import { MobileKeysQuerySchema, ReservationIdParamsSchema } from "@tartware/schemas";
import type { FastifyInstance } from "fastify";

import { getActiveKeysForReservation } from "../services/key-service.js";

const KEY_TAG = "Mobile Keys";

/**
 * Register mobile key endpoints (S28).
 */
export const registerKeyRoutes = (app: FastifyInstance): void => {
  /**
   * GET /v1/self-service/keys/:reservationId
   * Get active mobile keys for a reservation.
   */
  app.get(
    "/v1/self-service/keys/:reservationId",
    {
      schema: {
        tags: [KEY_TAG],
        summary: "Get active mobile keys for a reservation",
        description: "Returns all active digital room keys for the given reservation.",
      },
    },
    async (request, reply) => {
      const params = ReservationIdParamsSchema.parse(request.params);
      const queryParams = MobileKeysQuerySchema.parse(request.query);

      const keys = await getActiveKeysForReservation(params.reservationId, queryParams.tenant_id);

      return reply.send({ keys });
    },
  );
};
