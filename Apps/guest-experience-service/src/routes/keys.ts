import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { getActiveKeysForReservation } from "../services/key-service.js";

const KEY_TAG = "Mobile Keys";

const ReservationIdParams = z.object({
  reservationId: z.string().uuid(),
});

const KeysQuery = z.object({
  tenant_id: z.string().uuid(),
});

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
      const params = ReservationIdParams.parse(request.params);
      const queryParams = KeysQuery.parse(request.query);

      const keys = await getActiveKeysForReservation(params.reservationId, queryParams.tenant_id);

      return reply.send({ keys });
    },
  );
};
