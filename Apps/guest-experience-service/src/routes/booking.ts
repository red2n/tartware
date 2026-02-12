import { z } from "zod";
import type { FastifyInstance } from "fastify";

import {
  searchAvailability,
  createBooking,
  lookupBooking,
  StubPaymentGateway,
} from "../services/booking-service.js";

const BOOKING_TAG = "Direct Booking";

const SearchQuery = z.object({
  tenant_id: z.string().uuid(),
  property_id: z.string().uuid(),
  check_in_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  check_out_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  adults: z.coerce.number().int().min(1).default(1),
  children: z.coerce.number().int().min(0).default(0),
});

const BookBody = z.object({
  tenant_id: z.string().uuid(),
  property_id: z.string().uuid(),
  guest_email: z.string().email(),
  guest_first_name: z.string().min(1).max(100),
  guest_last_name: z.string().min(1).max(100),
  guest_phone: z.string().max(50).optional(),
  room_type_id: z.string().uuid(),
  check_in_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  check_out_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  adults: z.number().int().min(1),
  children: z.number().int().min(0).default(0),
  payment_token: z.string().optional(),
  special_requests: z.string().max(1000).optional(),
  idempotency_key: z.string().max(120).optional(),
});

const ConfirmationCodeParams = z.object({
  confirmationCode: z.string().min(1).max(50),
});

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
      const queryParams = SearchQuery.parse(request.query);

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
      const body = BookBody.parse(request.body);

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
      const params = ConfirmationCodeParams.parse(request.params);

      const booking = await lookupBooking(params.confirmationCode);
      if (!booking) {
        return reply.status(404).send({
          statusCode: 404,
          error: "Not Found",
          message: "No booking found with the provided confirmation code",
        });
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
