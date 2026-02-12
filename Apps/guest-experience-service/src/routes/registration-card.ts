import { z } from "zod";
import type { FastifyInstance } from "fastify";

import {
  generateRegistrationCard,
  getRegistrationCard,
} from "../services/registration-card-service.js";

const REGISTRATION_CARD_TAG = "Registration Card";

const ReservationIdParams = z.object({
  reservationId: z.string().uuid(),
});

const GenerateCardQuery = z.object({
  tenant_id: z.string().uuid(),
  mobile_checkin_id: z.string().uuid().optional(),
});

/**
 * Register registration card endpoints (S27).
 */
export const registerRegistrationCardRoutes = (app: FastifyInstance): void => {
  /**
   * GET /v1/self-service/registration-card/:reservationId
   * Get (or generate) a registration card for a reservation.
   * Returns HTML content.
   */
  app.get(
    "/v1/self-service/registration-card/:reservationId",
    {
      schema: {
        tags: [REGISTRATION_CARD_TAG],
        summary: "Get registration card for a reservation",
        description:
          "Returns the rendered HTML registration card. Generates one if it does not exist.",
      },
    },
    async (request, reply) => {
      const params = ReservationIdParams.parse(request.params);
      const queryParams = GenerateCardQuery.parse(request.query);

      // Try to find existing card
      const existing = await getRegistrationCard(params.reservationId, queryParams.tenant_id);
      if (existing) {
        return reply.send(existing);
      }

      // Generate new card
      const card = await generateRegistrationCard({
        reservationId: params.reservationId,
        tenantId: queryParams.tenant_id,
        mobileCheckinId: queryParams.mobile_checkin_id,
      });

      return reply.status(201).send(card);
    },
  );

  /**
   * GET /v1/self-service/registration-card/:reservationId/html
   * Get the raw HTML registration card.
   */
  app.get(
    "/v1/self-service/registration-card/:reservationId/html",
    {
      schema: {
        tags: [REGISTRATION_CARD_TAG],
        summary: "Get registration card as HTML",
        description: "Returns the registration card rendered as an HTML page.",
      },
    },
    async (request, reply) => {
      const params = ReservationIdParams.parse(request.params);
      const queryParams = GenerateCardQuery.parse(request.query);

      const card = await generateRegistrationCard({
        reservationId: params.reservationId,
        tenantId: queryParams.tenant_id,
        mobileCheckinId: queryParams.mobile_checkin_id,
      });

      return reply.header("Content-Type", "text/html; charset=utf-8").send(card.html);
    },
  );
};
