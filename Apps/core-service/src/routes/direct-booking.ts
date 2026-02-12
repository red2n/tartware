/**
 * DEV DOC
 * Module: routes/direct-booking.ts
 * Purpose: Guest-facing direct booking engine endpoints — availability search,
 *          rate quotes, and booking confirmation.
 * Ownership: Core service
 * S30 — Direct Booking Engine
 */

import { buildRouteSchema, schemaFromZod } from "@tartware/openapi";
import {
  CreateDirectBookingBodySchema,
  DirectBookingAvailabilityQuerySchema,
  DirectBookingRateQuoteQuerySchema,
} from "@tartware/schemas";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import {
  AvailabilityResultSchema,
  BookingConfirmationSchema,
  createDirectBooking,
  getRateQuote,
  RateQuoteSchema,
  searchAvailability,
} from "../services/direct-booking-service.js";

const DIRECT_BOOKING_TAG = "Direct Booking";

// ---------------------------------------------------------------------------
// JSON-schema constants (derived from Zod for OpenAPI docs)
// ---------------------------------------------------------------------------

const AvailabilityQueryJsonSchema = schemaFromZod(
  DirectBookingAvailabilityQuerySchema,
  "DirectBookingAvailabilityQuery",
);
const AvailabilityResponseJsonSchema = schemaFromZod(
  z.array(AvailabilityResultSchema),
  "DirectBookingAvailabilityResponse",
);
const RateQuoteQueryJsonSchema = schemaFromZod(
  DirectBookingRateQuoteQuerySchema,
  "DirectBookingRateQuoteQuery",
);
const RateQuoteResponseJsonSchema = schemaFromZod(
  RateQuoteSchema,
  "DirectBookingRateQuoteResponse",
);
const CreateBookingBodyJsonSchema = schemaFromZod(
  CreateDirectBookingBodySchema,
  "DirectBookingCreateBody",
);
const BookingConfirmationJsonSchema = schemaFromZod(
  BookingConfirmationSchema,
  "DirectBookingConfirmation",
);

export const registerDirectBookingRoutes = (app: FastifyInstance): void => {
  // -------------------------------------------------------------------------
  // GET /v1/direct-booking/availability
  // -------------------------------------------------------------------------
  app.get<{ Querystring: z.infer<typeof DirectBookingAvailabilityQuerySchema> }>(
    "/v1/direct-booking/availability",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) =>
          (request.query as z.infer<typeof DirectBookingAvailabilityQuerySchema>).tenant_id,
        minRole: "VIEWER",
        requiredModules: "core",
      }),
      schema: buildRouteSchema({
        tag: DIRECT_BOOKING_TAG,
        summary: "Search room availability",
        description:
          "Search available room types for a property and date range. " +
          "Returns room types with availability count, base and dynamic rates.",
        querystring: AvailabilityQueryJsonSchema,
        response: { 200: AvailabilityResponseJsonSchema },
      }),
    },
    async (request) => {
      const q = DirectBookingAvailabilityQuerySchema.parse(request.query);
      return searchAvailability({
        tenantId: q.tenant_id,
        propertyId: q.property_id,
        checkIn: q.check_in,
        checkOut: q.check_out,
        adults: q.adults,
        children: q.children,
        roomTypeId: q.room_type_id,
      });
    },
  );

  // -------------------------------------------------------------------------
  // GET /v1/direct-booking/rate-quote
  // -------------------------------------------------------------------------
  app.get<{ Querystring: z.infer<typeof DirectBookingRateQuoteQuerySchema> }>(
    "/v1/direct-booking/rate-quote",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) =>
          (request.query as z.infer<typeof DirectBookingRateQuoteQuerySchema>).tenant_id,
        minRole: "VIEWER",
        requiredModules: "core",
      }),
      schema: buildRouteSchema({
        tag: DIRECT_BOOKING_TAG,
        summary: "Get rate quote",
        description:
          "Get a detailed rate quote for a specific room type and date range. " +
          "Includes nightly breakdown, promo code application, and tax estimate.",
        querystring: RateQuoteQueryJsonSchema,
        response: { 200: RateQuoteResponseJsonSchema },
      }),
    },
    async (request) => {
      const q = DirectBookingRateQuoteQuerySchema.parse(request.query);
      return getRateQuote({
        tenantId: q.tenant_id,
        propertyId: q.property_id,
        roomTypeId: q.room_type_id,
        checkIn: q.check_in,
        checkOut: q.check_out,
        promoCode: q.promo_code,
        rateCode: q.rate_code,
      });
    },
  );

  // -------------------------------------------------------------------------
  // POST /v1/direct-booking/book
  // -------------------------------------------------------------------------
  app.post<{ Body: z.infer<typeof CreateDirectBookingBodySchema> }>(
    "/v1/direct-booking/book",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) =>
          (request.body as z.infer<typeof CreateDirectBookingBodySchema>).tenant_id,
        minRole: "VIEWER",
        requiredModules: "core",
      }),
      schema: buildRouteSchema({
        tag: DIRECT_BOOKING_TAG,
        summary: "Create direct booking",
        description:
          "Create a confirmed reservation through the direct booking engine. " +
          "Validates guest and room type, applies promo code, and returns confirmation.",
        body: CreateBookingBodyJsonSchema,
        response: { 201: BookingConfirmationJsonSchema },
      }),
    },
    async (request, reply) => {
      const body = CreateDirectBookingBodySchema.parse(request.body);
      const result = await createDirectBooking({
        tenantId: body.tenant_id,
        propertyId: body.property_id,
        guestId: body.guest_id,
        roomTypeId: body.room_type_id,
        checkIn: body.check_in,
        checkOut: body.check_out,
        totalAmount: body.total_amount,
        currency: body.currency,
        rateCode: body.rate_code,
        promoCode: body.promo_code,
        notes: body.notes,
        eta: body.eta,
      });
      return reply.status(201).send(result);
    },
  );
};
