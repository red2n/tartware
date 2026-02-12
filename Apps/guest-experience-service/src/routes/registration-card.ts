import { GenerateCardQuerySchema, ReservationIdParamsSchema } from "@tartware/schemas";
import type { FastifyInstance } from "fastify";

import {
  generateRegistrationCard,
  getRegistrationCard,
} from "../services/registration-card-service.js";

const REGISTRATION_CARD_TAG = "Registration Card";

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
      const params = ReservationIdParamsSchema.parse(request.params);
      const queryParams = GenerateCardQuerySchema.parse(request.query);

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
      const params = ReservationIdParamsSchema.parse(request.params);
      const queryParams = GenerateCardQuerySchema.parse(request.query);

      const card = await generateRegistrationCard({
        reservationId: params.reservationId,
        tenantId: queryParams.tenant_id,
        mobileCheckinId: queryParams.mobile_checkin_id,
      });

      return reply.header("Content-Type", "text/html; charset=utf-8").send(card.html);
    },
  );
};
