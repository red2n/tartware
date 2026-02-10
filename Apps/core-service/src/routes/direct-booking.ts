/**
 * DEV DOC
 * Module: routes/direct-booking.ts
 * Purpose: Guest-facing direct booking engine endpoints — availability search,
 *          rate quotes, and booking confirmation.
 * Ownership: Core service
 * S30 — Direct Booking Engine
 */

import { buildRouteSchema, schemaFromZod } from "@tartware/openapi";
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

const AvailabilityQuerySchema = z.object({
  tenant_id: z.string().uuid(),
  property_id: z.string().uuid(),
  check_in: z
    .string()
    .refine((v) => !Number.isNaN(Date.parse(v)), "valid ISO date required"),
  check_out: z
    .string()
    .refine((v) => !Number.isNaN(Date.parse(v)), "valid ISO date required"),
  adults: z.coerce.number().int().min(1).optional(),
  children: z.coerce.number().int().min(0).optional(),
  room_type_id: z.string().uuid().optional(),
});

const RateQuoteQuerySchema = z.object({
  tenant_id: z.string().uuid(),
  property_id: z.string().uuid(),
  room_type_id: z.string().uuid(),
  check_in: z
    .string()
    .refine((v) => !Number.isNaN(Date.parse(v)), "valid ISO date required"),
  check_out: z
    .string()
    .refine((v) => !Number.isNaN(Date.parse(v)), "valid ISO date required"),
  promo_code: z.string().max(50).optional(),
  rate_code: z.string().max(50).optional(),
});

const CreateBookingBodySchema = z.object({
  tenant_id: z.string().uuid(),
  property_id: z.string().uuid(),
  guest_id: z.string().uuid(),
  room_type_id: z.string().uuid(),
  check_in: z
    .string()
    .refine((v) => !Number.isNaN(Date.parse(v)), "valid ISO date required"),
  check_out: z
    .string()
    .refine((v) => !Number.isNaN(Date.parse(v)), "valid ISO date required"),
  total_amount: z.number().min(0),
  currency: z.string().length(3).optional(),
  rate_code: z.string().max(50).optional(),
  promo_code: z.string().max(50).optional(),
  notes: z.string().max(2000).optional(),
  eta: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "HH:MM format required")
    .optional(),
});

export const registerDirectBookingRoutes = (app: FastifyInstance): void => {
  // JSON schema for OpenAPI
  const AvailabilityQueryJsonSchema = schemaFromZod(
    AvailabilityQuerySchema,
    "DirectBookingAvailabilityQuery",
  );
  const AvailabilityResponseJsonSchema = schemaFromZod(
    z.array(AvailabilityResultSchema),
    "DirectBookingAvailabilityResponse",
  );
  const RateQuoteQueryJsonSchema = schemaFromZod(
    RateQuoteQuerySchema,
    "DirectBookingRateQuoteQuery",
  );
  const RateQuoteResponseJsonSchema = schemaFromZod(
    RateQuoteSchema,
    "DirectBookingRateQuoteResponse",
  );
  const CreateBookingBodyJsonSchema = schemaFromZod(
    CreateBookingBodySchema,
    "DirectBookingCreateBody",
  );
  const BookingConfirmationJsonSchema = schemaFromZod(
    BookingConfirmationSchema,
    "DirectBookingConfirmation",
  );

  // -------------------------------------------------------------------------
  // GET /v1/direct-booking/availability
  // -------------------------------------------------------------------------
  app.get<{ Querystring: z.infer<typeof AvailabilityQuerySchema> }>(
    "/v1/direct-booking/availability",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) =>
          (request.query as z.infer<typeof AvailabilityQuerySchema>).tenant_id,
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
      const q = AvailabilityQuerySchema.parse(request.query);
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
  app.get<{ Querystring: z.infer<typeof RateQuoteQuerySchema> }>(
    "/v1/direct-booking/rate-quote",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) =>
          (request.query as z.infer<typeof RateQuoteQuerySchema>).tenant_id,
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
      const q = RateQuoteQuerySchema.parse(request.query);
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
  app.post<{ Body: z.infer<typeof CreateBookingBodySchema> }>(
    "/v1/direct-booking/book",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) =>
          (request.body as z.infer<typeof CreateBookingBodySchema>).tenant_id,
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
      const body = CreateBookingBodySchema.parse(request.body);
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
