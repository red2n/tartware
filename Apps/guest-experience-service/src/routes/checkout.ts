import { CheckoutStartBodySchema } from "@tartware/schemas";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  CheckoutServiceError,
  initiateSelfServiceCheckout,
  lookupCheckedInReservation,
} from "../services/checkout-service.js";

const SELF_SERVICE_TAG = "Self-Service Check-Out";

/**
 * Register self-service checkout REST endpoints.
 * Guest-facing — authenticates via confirmation code, not JWT.
 */
export const registerCheckoutRoutes = (app: FastifyInstance): void => {
  /**
   * POST /v1/self-service/check-out
   * Initiate a self-service express checkout.
   */
  app.post(
    "/v1/self-service/check-out",
    {
      schema: {
        tags: [SELF_SERVICE_TAG],
        summary: "Initiate self-service checkout",
        description:
          "Authenticates via confirmation code. Validates the reservation is checked-in, " +
          "checks for outstanding folio balance, and publishes a checkout command.",
      },
    },
    async (request, reply) => {
      const body = CheckoutStartBodySchema.parse(request.body);

      const reservation = await lookupCheckedInReservation(body.confirmation_code);
      if (!reservation) {
        return reply.notFound(
          "No checked-in reservation found with the provided confirmation code",
        );
      }

      if (reservation.folio_balance > 0) {
        return reply.status(402).send({
          error: "OUTSTANDING_BALANCE",
          message: "Please settle the outstanding balance before checking out.",
          folio_balance: reservation.folio_balance,
        });
      }

      try {
        const result = await initiateSelfServiceCheckout({
          reservationId: reservation.id,
          tenantId: reservation.tenant_id,
          guestId: reservation.guest_id,
          propertyId: reservation.property_id,
          express: body.express,
          notes: body.notes,
        });

        return reply.status(202).send({
          ...result,
          reservation_id: reservation.id,
          room_number: reservation.room_number,
          message: "Checkout initiated. You will receive a confirmation shortly.",
        });
      } catch (err) {
        if (err instanceof CheckoutServiceError) {
          return reply.status(400).send({
            error: err.code,
            message: err.message,
          });
        }
        throw err;
      }
    },
  );

  /**
   * GET /v1/self-service/check-out/preview
   * Preview checkout details (folio balance, room info) before confirming.
   */
  app.get(
    "/v1/self-service/check-out/preview",
    {
      schema: {
        tags: [SELF_SERVICE_TAG],
        summary: "Preview checkout details",
        description:
          "Look up a checked-in reservation by confirmation code and return " +
          "folio balance and room info so the guest can review before checkout.",
      },
    },
    async (request, reply) => {
      const queryParams = z.object({ confirmation_code: z.string().min(1) }).parse(request.query);

      const reservation = await lookupCheckedInReservation(queryParams.confirmation_code);
      if (!reservation) {
        return reply.notFound(
          "No checked-in reservation found with the provided confirmation code",
        );
      }

      return reply.send({
        reservation_id: reservation.id,
        room_number: reservation.room_number,
        check_out_date: reservation.check_out_date,
        folio_balance: reservation.folio_balance,
        can_express_checkout: reservation.folio_balance <= 0,
      });
    },
  );
};
