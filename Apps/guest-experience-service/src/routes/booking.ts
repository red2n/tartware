import {
  ConfirmationCodeParamsSchema,
  GuestBookingBodySchema,
  GuestBookingSearchQuerySchema,
} from "@tartware/schemas";
import type { FastifyInstance } from "fastify";

import {
  createBooking,
  lookupBooking,
  StubPaymentGateway,
  searchAvailability,
} from "../services/booking-service.js";

const BOOKING_TAG = "Direct Booking";

// Dev/test payment gateway stub
const paymentGateway = new StubPaymentGateway();

/**
 * Register direct booking endpoints (S30).
 * Guest-facing, public endpoints. No JWT — uses rate limiting.
 */
export const registerBookingRoutes = (app: FastifyInstance): void => {
  /**
   * GET /v1/self-service/search
   * Search for available room types.
   */
  app.get(
    "/v1/self-service/search",
    {
      schema: {
        tags: [BOOKING_TAG],
        summary: "Search available room types",
        description:
          "Returns available room types for the given dates and occupancy. Public endpoint.",
      },
    },
    async (request, reply) => {
      const queryParams = GuestBookingSearchQuerySchema.parse(request.query);

      const results = await searchAvailability({
        tenantId: queryParams.tenant_id,
        propertyId: queryParams.property_id,
        checkInDate: queryParams.check_in_date,
        checkOutDate: queryParams.check_out_date,
        adults: queryParams.adults,
        children: queryParams.children,
      });

      return reply.send({ roomTypes: results });
    },
  );

  /**
   * POST /v1/self-service/book
   * Create a direct booking.
   */
  app.post(
    "/v1/self-service/book",
    {
      schema: {
        tags: [BOOKING_TAG],
        summary: "Create a direct booking",
        description:
          "Orchestrates guest creation, reservation, payment authorization, and confirmation notification. Returns immediately with a pending reservation.",
      },
    },
    async (request, reply) => {
      const body = GuestBookingBodySchema.parse(request.body);

      const result = await createBooking(
        {
          tenantId: body.tenant_id,
          propertyId: body.property_id,
          guestEmail: body.guest_email,
          guestFirstName: body.guest_first_name,
          guestLastName: body.guest_last_name,
          guestPhone: body.guest_phone,
          roomTypeId: body.room_type_id,
          checkInDate: body.check_in_date,
          checkOutDate: body.check_out_date,
          adults: body.adults,
          children: body.children,
          paymentToken: body.payment_token,
          specialRequests: body.special_requests,
          idempotencyKey: body.idempotency_key,
        },
        paymentGateway,
      );

      return reply.status(202).send(result);
    },
  );

  /**
   * GET /v1/self-service/booking/:confirmationCode
   * Look up a booking by confirmation code (guest-facing).
   */
  app.get(
    "/v1/self-service/booking/:confirmationCode",
    {
      schema: {
        tags: [BOOKING_TAG],
        summary: "Look up a booking by confirmation code",
        description: "Guest-facing booking lookup. Authenticates via confirmation code, not JWT.",
      },
    },
    async (request, reply) => {
      const params = ConfirmationCodeParamsSchema.parse(request.params);

      const booking = await lookupBooking(params.confirmationCode);
      if (!booking) {
        return reply.notFound("No booking found with the provided confirmation code");
      }

      return reply.send({
        reservationId: booking.id,
        confirmationCode: booking.confirmation_code,
        status: booking.status,
        propertyName: booking.property_name,
        guestName: `${booking.first_name} ${booking.last_name}`,
        checkInDate: booking.check_in_date,
        checkOutDate: booking.check_out_date,
        adults: booking.adults,
        children: booking.children,
      });
    },
  );
};
