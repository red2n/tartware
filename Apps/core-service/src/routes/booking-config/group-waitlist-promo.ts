import { buildRouteSchema, errorResponseSchema, schemaFromZod } from "@tartware/openapi";
import {
  GroupBookingListItemSchema,
  PromotionalCodeListItemSchema,
  ValidatePromoCodeRequestSchema,
  ValidatePromoCodeResponseSchema,
  WaitlistEntryListItemSchema,
  WaitlistStatusEnum,
} from "@tartware/schemas";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import {
  getGroupBookingById,
  getPromotionalCodeById,
  getWaitlistEntryById,
  listGroupBookings,
  listPromotionalCodes,
  listWaitlistEntries,
  validatePromoCode,
} from "../../services/booking-config/group-waitlist-promo.js";

// =====================================================
// ROUTE REGISTRATION
// =====================================================

export const registerGroupWaitlistPromoRoutes = (app: FastifyInstance): void => {
  // -------------------------------------------------
  // WAITLIST ENTRIES
  // -------------------------------------------------

  const WaitlistEntryListQuerySchema = z.object({
    tenant_id: z.string().uuid(),
    property_id: z.string().uuid().optional(),
    waitlist_status: z
      .string()
      .toUpperCase()
      .optional()
      .refine((val) => !val || WaitlistStatusEnum.options.includes(val as never), {
        message: "Invalid waitlist status",
      }),
    arrival_date_from: z
      .string()
      .optional()
      .refine((val) => !val || !Number.isNaN(Date.parse(val)), {
        message: "arrival_date_from must be a valid ISO date",
      }),
    arrival_date_to: z
      .string()
      .optional()
      .refine((val) => !val || !Number.isNaN(Date.parse(val)), {
        message: "arrival_date_to must be a valid ISO date",
      }),
    is_vip: z.coerce.boolean().optional(),
    limit: z.coerce.number().int().positive().max(500).default(200),
    offset: z.coerce.number().int().min(0).default(0),
  });

  type WaitlistEntryListQuery = z.infer<typeof WaitlistEntryListQuerySchema>;

  const WaitlistEntryListResponseSchema = z.array(WaitlistEntryListItemSchema);
  const WaitlistEntryListQueryJsonSchema = schemaFromZod(
    WaitlistEntryListQuerySchema,
    "WaitlistEntryListQuery",
  );
  const WaitlistEntryListResponseJsonSchema = schemaFromZod(
    WaitlistEntryListResponseSchema,
    "WaitlistEntryListResponse",
  );
  const WaitlistEntryDetailResponseJsonSchema = schemaFromZod(
    WaitlistEntryListItemSchema,
    "WaitlistEntryDetailResponse",
  );
  const WaitlistEntryParamsSchema = z.object({ waitlistId: z.string().uuid() });
  const WaitlistEntryIdParamJsonSchema = schemaFromZod(
    WaitlistEntryParamsSchema,
    "WaitlistEntryIdParam",
  );

  const WAITLIST_TAG = "Waitlist";

  app.get<{ Querystring: WaitlistEntryListQuery }>(
    "/v1/waitlist",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as WaitlistEntryListQuery).tenant_id,
        minRole: "STAFF",
        requiredModules: "core",
      }),
      schema: buildRouteSchema({
        tag: WAITLIST_TAG,
        summary: "List waitlist entries",
        description: "Retrieve guests waiting for room availability with priority and offer status",
        querystring: WaitlistEntryListQueryJsonSchema,
        response: { 200: WaitlistEntryListResponseJsonSchema },
      }),
    },
    async (request) => {
      const {
        tenant_id,
        property_id,
        waitlist_status,
        arrival_date_from,
        arrival_date_to,
        is_vip,
        limit,
        offset,
      } = WaitlistEntryListQuerySchema.parse(request.query);
      const entries = await listWaitlistEntries({
        tenantId: tenant_id,
        propertyId: property_id,
        waitlistStatus: waitlist_status,
        arrivalDateFrom: arrival_date_from,
        arrivalDateTo: arrival_date_to,
        isVip: is_vip,
        limit,
        offset,
      });
      return WaitlistEntryListResponseSchema.parse(entries);
    },
  );

  app.get<{
    Params: z.infer<typeof WaitlistEntryParamsSchema>;
    Querystring: { tenant_id: string };
  }>(
    "/v1/waitlist/:waitlistId",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as { tenant_id: string }).tenant_id,
        minRole: "STAFF",
        requiredModules: "core",
      }),
      schema: buildRouteSchema({
        tag: WAITLIST_TAG,
        summary: "Get waitlist entry details",
        description: "Retrieve detailed information about a specific waitlist entry",
        params: WaitlistEntryIdParamJsonSchema,
        querystring: schemaFromZod(
          z.object({ tenant_id: z.string().uuid() }),
          "WaitlistEntryDetailQuery",
        ),
        response: { 200: WaitlistEntryDetailResponseJsonSchema, 404: errorResponseSchema },
      }),
    },
    async (request, reply) => {
      const { waitlistId } = WaitlistEntryParamsSchema.parse(request.params);
      const { tenant_id } = z.object({ tenant_id: z.string().uuid() }).parse(request.query);
      const entry = await getWaitlistEntryById({ waitlistId, tenantId: tenant_id });
      if (!entry) {
        return reply.notFound("Waitlist entry not found");
      }
      return WaitlistEntryListItemSchema.parse(entry);
    },
  );

  // =====================================================
  // GROUP BOOKING ROUTES
  // =====================================================

  const GroupBookingListQuerySchema = z.object({
    tenant_id: z.string().uuid(),
    property_id: z.string().uuid().optional(),
    block_status: z.string().toUpperCase().optional(),
    group_type: z.string().toUpperCase().optional(),
    arrival_date_from: z.string().optional(),
    arrival_date_to: z.string().optional(),
    is_active: z
      .string()
      .optional()
      .transform((val) => (val === "true" ? true : val === "false" ? false : undefined)),
    limit: z.coerce.number().int().positive().max(500).default(200),
    offset: z.coerce.number().int().min(0).default(0),
  });

  type GroupBookingListQuery = z.infer<typeof GroupBookingListQuerySchema>;

  const GroupBookingListResponseSchema = z.array(GroupBookingListItemSchema);
  const GroupBookingListQueryJsonSchema = schemaFromZod(
    GroupBookingListQuerySchema,
    "GroupBookingListQuery",
  );
  const GroupBookingListResponseJsonSchema = schemaFromZod(
    GroupBookingListResponseSchema,
    "GroupBookingListResponse",
  );
  const GroupBookingDetailResponseJsonSchema = schemaFromZod(
    GroupBookingListItemSchema,
    "GroupBookingDetailResponse",
  );

  const GroupBookingParamsSchema = z.object({
    groupBookingId: z.string().uuid(),
  });
  const GroupBookingIdParamJsonSchema = schemaFromZod(
    GroupBookingParamsSchema,
    "GroupBookingIdParam",
  );

  const GROUP_BOOKING_TAG = "Group Bookings";

  app.get<{ Querystring: GroupBookingListQuery }>(
    "/v1/group-bookings",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as GroupBookingListQuery).tenant_id,
        minRole: "STAFF",
        requiredModules: "core",
      }),
      schema: buildRouteSchema({
        tag: GROUP_BOOKING_TAG,
        summary: "List group bookings",
        description: "Retrieve group and block bookings with pickup tracking",
        querystring: GroupBookingListQueryJsonSchema,
        response: { 200: GroupBookingListResponseJsonSchema },
      }),
    },
    async (request) => {
      const {
        tenant_id,
        property_id,
        block_status,
        group_type,
        arrival_date_from,
        arrival_date_to,
        is_active,
        limit,
        offset,
      } = GroupBookingListQuerySchema.parse(request.query);
      const bookings = await listGroupBookings({
        tenantId: tenant_id,
        propertyId: property_id,
        blockStatus: block_status,
        groupType: group_type,
        arrivalDateFrom: arrival_date_from,
        arrivalDateTo: arrival_date_to,
        isActive: is_active,
        limit,
        offset,
      });
      return GroupBookingListResponseSchema.parse(bookings);
    },
  );

  app.get<{
    Params: z.infer<typeof GroupBookingParamsSchema>;
    Querystring: { tenant_id: string };
  }>(
    "/v1/group-bookings/:groupBookingId",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as { tenant_id: string }).tenant_id,
        minRole: "STAFF",
        requiredModules: "core",
      }),
      schema: buildRouteSchema({
        tag: GROUP_BOOKING_TAG,
        summary: "Get group booking details",
        description: "Retrieve detailed information about a specific group booking",
        params: GroupBookingIdParamJsonSchema,
        querystring: schemaFromZod(
          z.object({ tenant_id: z.string().uuid() }),
          "GroupBookingDetailQuery",
        ),
        response: { 200: GroupBookingDetailResponseJsonSchema, 404: errorResponseSchema },
      }),
    },
    async (request, reply) => {
      const { groupBookingId } = GroupBookingParamsSchema.parse(request.params);
      const { tenant_id } = z.object({ tenant_id: z.string().uuid() }).parse(request.query);
      const booking = await getGroupBookingById({ groupBookingId, tenantId: tenant_id });
      if (!booking) {
        return reply.notFound("Group booking not found");
      }
      return GroupBookingListItemSchema.parse(booking);
    },
  );

  // =====================================================
  // PROMOTIONAL CODE ROUTES
  // =====================================================

  const PromotionalCodeListQuerySchema = z.object({
    tenant_id: z.string().uuid(),
    property_id: z.string().uuid().optional(),
    promo_status: z.string().toUpperCase().optional(),
    is_active: z
      .string()
      .optional()
      .transform((val) => (val === "true" ? true : val === "false" ? false : undefined)),
    is_public: z
      .string()
      .optional()
      .transform((val) => (val === "true" ? true : val === "false" ? false : undefined)),
    search: z.string().optional(),
    limit: z.coerce.number().int().positive().max(500).default(200),
    offset: z.coerce.number().int().min(0).default(0),
  });

  type PromotionalCodeListQuery = z.infer<typeof PromotionalCodeListQuerySchema>;

  const PromotionalCodeListResponseSchema = z.array(PromotionalCodeListItemSchema);
  const PromotionalCodeListQueryJsonSchema = schemaFromZod(
    PromotionalCodeListQuerySchema,
    "PromotionalCodeListQuery",
  );
  const PromotionalCodeListResponseJsonSchema = schemaFromZod(
    PromotionalCodeListResponseSchema,
    "PromotionalCodeListResponse",
  );
  const PromotionalCodeDetailResponseJsonSchema = schemaFromZod(
    PromotionalCodeListItemSchema,
    "PromotionalCodeDetailResponse",
  );

  const PromotionalCodeParamsSchema = z.object({
    promoId: z.string().uuid(),
  });
  const PromotionalCodeIdParamJsonSchema = schemaFromZod(
    PromotionalCodeParamsSchema,
    "PromotionalCodeIdParam",
  );

  const PROMO_CODE_TAG = "Promotional Codes";

  app.get<{ Querystring: PromotionalCodeListQuery }>(
    "/v1/promo-codes",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as PromotionalCodeListQuery).tenant_id,
        minRole: "STAFF",
        requiredModules: "core",
      }),
      schema: buildRouteSchema({
        tag: PROMO_CODE_TAG,
        summary: "List promotional codes",
        description: "Retrieve available promotional and discount codes",
        querystring: PromotionalCodeListQueryJsonSchema,
        response: { 200: PromotionalCodeListResponseJsonSchema },
      }),
    },
    async (request) => {
      const { tenant_id, property_id, promo_status, is_active, is_public, search, limit, offset } =
        PromotionalCodeListQuerySchema.parse(request.query);
      const codes = await listPromotionalCodes({
        tenantId: tenant_id,
        propertyId: property_id,
        promoStatus: promo_status,
        isActive: is_active,
        isPublic: is_public,
        search,
        limit,
        offset,
      });
      return PromotionalCodeListResponseSchema.parse(codes);
    },
  );

  app.get<{
    Params: z.infer<typeof PromotionalCodeParamsSchema>;
    Querystring: { tenant_id: string };
  }>(
    "/v1/promo-codes/:promoId",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as { tenant_id: string }).tenant_id,
        minRole: "STAFF",
        requiredModules: "core",
      }),
      schema: buildRouteSchema({
        tag: PROMO_CODE_TAG,
        summary: "Get promotional code details",
        description: "Retrieve detailed information about a specific promotional code",
        params: PromotionalCodeIdParamJsonSchema,
        querystring: schemaFromZod(
          z.object({ tenant_id: z.string().uuid() }),
          "PromotionalCodeDetailQuery",
        ),
        response: { 200: PromotionalCodeDetailResponseJsonSchema, 404: errorResponseSchema },
      }),
    },
    async (request, reply) => {
      const { promoId } = PromotionalCodeParamsSchema.parse(request.params);
      const { tenant_id } = z.object({ tenant_id: z.string().uuid() }).parse(request.query);
      const code = await getPromotionalCodeById({ promoId, tenantId: tenant_id });
      if (!code) {
        return reply.notFound("Promotional code not found");
      }
      return PromotionalCodeListItemSchema.parse(code);
    },
  );

  const ValidatePromoCodeBodyJsonSchema = schemaFromZod(
    ValidatePromoCodeRequestSchema,
    "ValidatePromoCodeBody",
  );
  const ValidatePromoCodeResponseJsonSchema = schemaFromZod(
    ValidatePromoCodeResponseSchema,
    "ValidatePromoCodeResponse",
  );

  app.post<{ Body: z.infer<typeof ValidatePromoCodeRequestSchema> }>(
    "/v1/promo-codes/validate",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) =>
          (request.body as z.infer<typeof ValidatePromoCodeRequestSchema>).tenant_id,
        minRole: "STAFF",
        requiredModules: "core",
      }),
      schema: buildRouteSchema({
        tag: PROMO_CODE_TAG,
        summary: "Validate promotional code",
        description:
          "Validate a promotional code against booking criteria and return discount details",
        body: ValidatePromoCodeBodyJsonSchema,
        response: { 200: ValidatePromoCodeResponseJsonSchema },
      }),
    },
    async (request) => {
      const body = ValidatePromoCodeRequestSchema.parse(request.body);
      const result = await validatePromoCode({
        promoCode: body.promo_code,
        tenantId: body.tenant_id,
        propertyId: body.property_id,
        arrivalDate: body.arrival_date,
        departureDate: body.departure_date,
        roomTypeId: body.room_type_id,
        rateCode: body.rate_code,
        bookingAmount: body.booking_amount,
        guestId: body.guest_id,
        channel: body.channel,
      });
      return ValidatePromoCodeResponseSchema.parse({
        promo_code: body.promo_code,
        ...result,
        promo_id: result.promoId,
        promo_name: result.promoName,
        discount_type: result.discountType,
        discount_value: result.discountValue,
        rejection_reason: result.rejectionReason,
      });
    },
  );
};
