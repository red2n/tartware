/**
 * DEV DOC
 * Module: booking-config.ts
 * Purpose: REST endpoints for allotments, booking sources, market segments, and channel mappings
 * Ownership: Core Service
 */

import { buildRouteSchema, schemaFromZod } from "@tartware/openapi";
import {
  AllotmentListItemSchema,
  AllotmentStatusEnum,
  AllotmentTypeEnum,
  BookingSourceListItemSchema,
  BookingSourceTypeEnum,
  ChannelMappingListItemSchema,
  CompanyListItemSchema,
  CompanyTypeEnum,
  CreditStatusEnum,
  EventBookingListItemSchema,
  EventBookingStatusEnum,
  EventTypeEnum,
  GroupBookingListItemSchema,
  MarketSegmentListItemSchema,
  MarketSegmentTypeEnum,
  MeetingRoomListItemSchema,
  MeetingRoomStatusEnum,
  MeetingRoomTypeEnum,
  PromotionalCodeListItemSchema,
  WaitlistEntryListItemSchema,
  WaitlistStatusEnum,
} from "@tartware/schemas";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import {
  getAllotmentById,
  getBookingSourceById,
  getChannelMappingById,
  getCompanyById,
  getEventBookingById,
  getGroupBookingById,
  getMarketSegmentById,
  getMeetingRoomById,
  getPromotionalCodeById,
  getWaitlistEntryById,
  listAllotments,
  listBookingSources,
  listChannelMappings,
  listCompanies,
  listEventBookings,
  listGroupBookings,
  listMarketSegments,
  listMeetingRooms,
  listPromotionalCodes,
  listWaitlistEntries,
  validatePromoCode,
} from "../services/booking-config-service.js";

// =====================================================
// ALLOTMENT SCHEMAS
// =====================================================

const AllotmentListQuerySchema = z.object({
  tenant_id: z.string().uuid(),
  property_id: z.string().uuid().optional(),
  status: z
    .string()
    .toUpperCase()
    .optional()
    .refine((val) => !val || AllotmentStatusEnum.options.includes(val as never), {
      message: "Invalid allotment status",
    }),
  allotment_type: z
    .string()
    .toUpperCase()
    .optional()
    .refine((val) => !val || AllotmentTypeEnum.options.includes(val as never), {
      message: "Invalid allotment type",
    }),
  start_date_from: z
    .string()
    .optional()
    .refine((val) => !val || !Number.isNaN(Date.parse(val)), {
      message: "start_date_from must be a valid ISO date",
    }),
  end_date_to: z
    .string()
    .optional()
    .refine((val) => !val || !Number.isNaN(Date.parse(val)), {
      message: "end_date_to must be a valid ISO date",
    }),
  limit: z.coerce.number().int().positive().max(500).default(200),
  offset: z.coerce.number().int().min(0).default(0),
});

type AllotmentListQuery = z.infer<typeof AllotmentListQuerySchema>;

const AllotmentListResponseSchema = z.array(AllotmentListItemSchema);
const AllotmentListQueryJsonSchema = schemaFromZod(AllotmentListQuerySchema, "AllotmentListQuery");
const AllotmentListResponseJsonSchema = schemaFromZod(
  AllotmentListResponseSchema,
  "AllotmentListResponse",
);
const AllotmentDetailResponseJsonSchema = schemaFromZod(
  AllotmentListItemSchema,
  "AllotmentDetailResponse",
);

const AllotmentParamsSchema = z.object({
  allotmentId: z.string().uuid(),
});

const AllotmentIdParamJsonSchema = schemaFromZod(AllotmentParamsSchema, "AllotmentIdParam");

// =====================================================
// BOOKING SOURCE SCHEMAS
// =====================================================

const BookingSourceListQuerySchema = z.object({
  tenant_id: z.string().uuid(),
  property_id: z.string().uuid().optional(),
  source_type: z
    .string()
    .toUpperCase()
    .optional()
    .refine((val) => !val || BookingSourceTypeEnum.options.includes(val as never), {
      message: "Invalid booking source type",
    }),
  is_active: z.coerce.boolean().optional(),
  has_integration: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().positive().max(500).default(200),
  offset: z.coerce.number().int().min(0).default(0),
});

type BookingSourceListQuery = z.infer<typeof BookingSourceListQuerySchema>;

const BookingSourceListResponseSchema = z.array(BookingSourceListItemSchema);
const BookingSourceListQueryJsonSchema = schemaFromZod(
  BookingSourceListQuerySchema,
  "BookingSourceListQuery",
);
const BookingSourceListResponseJsonSchema = schemaFromZod(
  BookingSourceListResponseSchema,
  "BookingSourceListResponse",
);
const BookingSourceDetailResponseJsonSchema = schemaFromZod(
  BookingSourceListItemSchema,
  "BookingSourceDetailResponse",
);

const BookingSourceParamsSchema = z.object({
  sourceId: z.string().uuid(),
});

const BookingSourceIdParamJsonSchema = schemaFromZod(
  BookingSourceParamsSchema,
  "BookingSourceIdParam",
);

// =====================================================
// MARKET SEGMENT SCHEMAS
// =====================================================

const MarketSegmentListQuerySchema = z.object({
  tenant_id: z.string().uuid(),
  property_id: z.string().uuid().optional(),
  segment_type: z
    .string()
    .toUpperCase()
    .optional()
    .refine((val) => !val || MarketSegmentTypeEnum.options.includes(val as never), {
      message: "Invalid market segment type",
    }),
  is_active: z.coerce.boolean().optional(),
  parent_segment_id: z.string().uuid().optional(),
  limit: z.coerce.number().int().positive().max(500).default(200),
  offset: z.coerce.number().int().min(0).default(0),
});

type MarketSegmentListQuery = z.infer<typeof MarketSegmentListQuerySchema>;

const MarketSegmentListResponseSchema = z.array(MarketSegmentListItemSchema);
const MarketSegmentListQueryJsonSchema = schemaFromZod(
  MarketSegmentListQuerySchema,
  "MarketSegmentListQuery",
);
const MarketSegmentListResponseJsonSchema = schemaFromZod(
  MarketSegmentListResponseSchema,
  "MarketSegmentListResponse",
);
const MarketSegmentDetailResponseJsonSchema = schemaFromZod(
  MarketSegmentListItemSchema,
  "MarketSegmentDetailResponse",
);

const MarketSegmentParamsSchema = z.object({
  segmentId: z.string().uuid(),
});

const MarketSegmentIdParamJsonSchema = schemaFromZod(
  MarketSegmentParamsSchema,
  "MarketSegmentIdParam",
);

// =====================================================
// CHANNEL MAPPING SCHEMAS
// =====================================================

const ChannelMappingListQuerySchema = z.object({
  tenant_id: z.string().uuid(),
  property_id: z.string().uuid().optional(),
  channel_code: z.string().optional(),
  entity_type: z.string().optional(),
  is_active: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().positive().max(500).default(200),
  offset: z.coerce.number().int().min(0).default(0),
});

type ChannelMappingListQuery = z.infer<typeof ChannelMappingListQuerySchema>;

const ChannelMappingListResponseSchema = z.array(ChannelMappingListItemSchema);
const ChannelMappingListQueryJsonSchema = schemaFromZod(
  ChannelMappingListQuerySchema,
  "ChannelMappingListQuery",
);
const ChannelMappingListResponseJsonSchema = schemaFromZod(
  ChannelMappingListResponseSchema,
  "ChannelMappingListResponse",
);
const ChannelMappingDetailResponseJsonSchema = schemaFromZod(
  ChannelMappingListItemSchema,
  "ChannelMappingDetailResponse",
);

const ChannelMappingParamsSchema = z.object({
  mappingId: z.string().uuid(),
});

const ChannelMappingIdParamJsonSchema = schemaFromZod(
  ChannelMappingParamsSchema,
  "ChannelMappingIdParam",
);

// =====================================================
// TAGS
// =====================================================

const ALLOTMENTS_TAG = "Allotments";
const BOOKING_SOURCES_TAG = "Booking Sources";
const MARKET_SEGMENTS_TAG = "Market Segments";
const CHANNEL_MAPPINGS_TAG = "Channel Mappings";

// =====================================================
// ROUTE REGISTRATION
// =====================================================

export const registerBookingConfigRoutes = (app: FastifyInstance): void => {
  // -------------------------------------------------
  // ALLOTMENTS
  // -------------------------------------------------

  app.get<{ Querystring: AllotmentListQuery }>(
    "/v1/allotments",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as AllotmentListQuery).tenant_id,
        minRole: "MANAGER",
        requiredModules: "core",
      }),
      schema: buildRouteSchema({
        tag: ALLOTMENTS_TAG,
        summary: "List allotments with filtering",
        description: "Retrieve allotments (room blocks) for group bookings, events, and contracts",
        querystring: AllotmentListQueryJsonSchema,
        response: {
          200: AllotmentListResponseJsonSchema,
        },
      }),
    },
    async (request) => {
      const {
        tenant_id,
        property_id,
        status,
        allotment_type,
        start_date_from,
        end_date_to,
        limit,
        offset,
      } = AllotmentListQuerySchema.parse(request.query);

      const allotments = await listAllotments({
        tenantId: tenant_id,
        propertyId: property_id,
        status,
        allotmentType: allotment_type,
        startDateFrom: start_date_from,
        endDateTo: end_date_to,
        limit,
        offset,
      });

      return AllotmentListResponseSchema.parse(allotments);
    },
  );

  app.get<{
    Params: z.infer<typeof AllotmentParamsSchema>;
    Querystring: { tenant_id: string };
  }>(
    "/v1/allotments/:allotmentId",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as { tenant_id: string }).tenant_id,
        minRole: "MANAGER",
        requiredModules: "core",
      }),
      schema: buildRouteSchema({
        tag: ALLOTMENTS_TAG,
        summary: "Get allotment details",
        description: "Retrieve detailed information about a specific allotment",
        params: AllotmentIdParamJsonSchema,
        querystring: schemaFromZod(
          z.object({ tenant_id: z.string().uuid() }),
          "AllotmentDetailQuery",
        ),
        response: {
          200: AllotmentDetailResponseJsonSchema,
        },
      }),
    },
    async (request, reply) => {
      const { allotmentId } = AllotmentParamsSchema.parse(request.params);
      const { tenant_id } = z.object({ tenant_id: z.string().uuid() }).parse(request.query);

      const allotment = await getAllotmentById({
        allotmentId,
        tenantId: tenant_id,
      });

      if (!allotment) {
        return reply.status(404).send({ error: "Allotment not found" });
      }

      return AllotmentListItemSchema.parse(allotment);
    },
  );

  // -------------------------------------------------
  // BOOKING SOURCES
  // -------------------------------------------------

  app.get<{ Querystring: BookingSourceListQuery }>(
    "/v1/booking-sources",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as BookingSourceListQuery).tenant_id,
        minRole: "MANAGER",
        requiredModules: "core",
      }),
      schema: buildRouteSchema({
        tag: BOOKING_SOURCES_TAG,
        summary: "List booking sources",
        description:
          "Retrieve booking sources (OTAs, GDS, direct channels) with performance metrics",
        querystring: BookingSourceListQueryJsonSchema,
        response: {
          200: BookingSourceListResponseJsonSchema,
        },
      }),
    },
    async (request) => {
      const { tenant_id, property_id, source_type, is_active, has_integration, limit, offset } =
        BookingSourceListQuerySchema.parse(request.query);

      const sources = await listBookingSources({
        tenantId: tenant_id,
        propertyId: property_id,
        sourceType: source_type,
        isActive: is_active,
        hasIntegration: has_integration,
        limit,
        offset,
      });

      return BookingSourceListResponseSchema.parse(sources);
    },
  );

  app.get<{
    Params: z.infer<typeof BookingSourceParamsSchema>;
    Querystring: { tenant_id: string };
  }>(
    "/v1/booking-sources/:sourceId",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as { tenant_id: string }).tenant_id,
        minRole: "MANAGER",
        requiredModules: "core",
      }),
      schema: buildRouteSchema({
        tag: BOOKING_SOURCES_TAG,
        summary: "Get booking source details",
        description: "Retrieve detailed information about a specific booking source",
        params: BookingSourceIdParamJsonSchema,
        querystring: schemaFromZod(
          z.object({ tenant_id: z.string().uuid() }),
          "BookingSourceDetailQuery",
        ),
        response: {
          200: BookingSourceDetailResponseJsonSchema,
        },
      }),
    },
    async (request, reply) => {
      const { sourceId } = BookingSourceParamsSchema.parse(request.params);
      const { tenant_id } = z.object({ tenant_id: z.string().uuid() }).parse(request.query);

      const source = await getBookingSourceById({
        sourceId,
        tenantId: tenant_id,
      });

      if (!source) {
        return reply.status(404).send({ error: "Booking source not found" });
      }

      return BookingSourceListItemSchema.parse(source);
    },
  );

  // -------------------------------------------------
  // MARKET SEGMENTS
  // -------------------------------------------------

  app.get<{ Querystring: MarketSegmentListQuery }>(
    "/v1/market-segments",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as MarketSegmentListQuery).tenant_id,
        minRole: "MANAGER",
        requiredModules: "core",
      }),
      schema: buildRouteSchema({
        tag: MARKET_SEGMENTS_TAG,
        summary: "List market segments",
        description:
          "Retrieve market segments with segmentation data, behavior metrics, and rate strategies",
        querystring: MarketSegmentListQueryJsonSchema,
        response: {
          200: MarketSegmentListResponseJsonSchema,
        },
      }),
    },
    async (request) => {
      const { tenant_id, property_id, segment_type, is_active, parent_segment_id, limit, offset } =
        MarketSegmentListQuerySchema.parse(request.query);

      const segments = await listMarketSegments({
        tenantId: tenant_id,
        propertyId: property_id,
        segmentType: segment_type,
        isActive: is_active,
        parentSegmentId: parent_segment_id,
        limit,
        offset,
      });

      return MarketSegmentListResponseSchema.parse(segments);
    },
  );

  app.get<{
    Params: z.infer<typeof MarketSegmentParamsSchema>;
    Querystring: { tenant_id: string };
  }>(
    "/v1/market-segments/:segmentId",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as { tenant_id: string }).tenant_id,
        minRole: "MANAGER",
        requiredModules: "core",
      }),
      schema: buildRouteSchema({
        tag: MARKET_SEGMENTS_TAG,
        summary: "Get market segment details",
        description: "Retrieve detailed information about a specific market segment",
        params: MarketSegmentIdParamJsonSchema,
        querystring: schemaFromZod(
          z.object({ tenant_id: z.string().uuid() }),
          "MarketSegmentDetailQuery",
        ),
        response: {
          200: MarketSegmentDetailResponseJsonSchema,
        },
      }),
    },
    async (request, reply) => {
      const { segmentId } = MarketSegmentParamsSchema.parse(request.params);
      const { tenant_id } = z.object({ tenant_id: z.string().uuid() }).parse(request.query);

      const segment = await getMarketSegmentById({
        segmentId,
        tenantId: tenant_id,
      });

      if (!segment) {
        return reply.status(404).send({ error: "Market segment not found" });
      }

      return MarketSegmentListItemSchema.parse(segment);
    },
  );

  // -------------------------------------------------
  // CHANNEL MAPPINGS
  // -------------------------------------------------

  app.get<{ Querystring: ChannelMappingListQuery }>(
    "/v1/channel-mappings",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as ChannelMappingListQuery).tenant_id,
        minRole: "ADMIN",
        requiredModules: "core",
      }),
      schema: buildRouteSchema({
        tag: CHANNEL_MAPPINGS_TAG,
        summary: "List channel mappings",
        description:
          "Retrieve channel manager entity mappings (rooms, rates, inventory) with sync status",
        querystring: ChannelMappingListQueryJsonSchema,
        response: {
          200: ChannelMappingListResponseJsonSchema,
        },
      }),
    },
    async (request) => {
      const { tenant_id, property_id, channel_code, entity_type, is_active, limit, offset } =
        ChannelMappingListQuerySchema.parse(request.query);

      const mappings = await listChannelMappings({
        tenantId: tenant_id,
        propertyId: property_id,
        channelCode: channel_code,
        entityType: entity_type,
        isActive: is_active,
        limit,
        offset,
      });

      return ChannelMappingListResponseSchema.parse(mappings);
    },
  );

  app.get<{
    Params: z.infer<typeof ChannelMappingParamsSchema>;
    Querystring: { tenant_id: string };
  }>(
    "/v1/channel-mappings/:mappingId",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as { tenant_id: string }).tenant_id,
        minRole: "ADMIN",
        requiredModules: "core",
      }),
      schema: buildRouteSchema({
        tag: CHANNEL_MAPPINGS_TAG,
        summary: "Get channel mapping details",
        description: "Retrieve detailed information about a specific channel mapping",
        params: ChannelMappingIdParamJsonSchema,
        querystring: schemaFromZod(
          z.object({ tenant_id: z.string().uuid() }),
          "ChannelMappingDetailQuery",
        ),
        response: {
          200: ChannelMappingDetailResponseJsonSchema,
        },
      }),
    },
    async (request, reply) => {
      const { mappingId } = ChannelMappingParamsSchema.parse(request.params);
      const { tenant_id } = z.object({ tenant_id: z.string().uuid() }).parse(request.query);

      const mapping = await getChannelMappingById({
        mappingId,
        tenantId: tenant_id,
      });

      if (!mapping) {
        return reply.status(404).send({ error: "Channel mapping not found" });
      }

      return ChannelMappingListItemSchema.parse(mapping);
    },
  );

  // -------------------------------------------------
  // COMPANIES (B2B)
  // -------------------------------------------------

  const CompanyListQuerySchema = z.object({
    tenant_id: z.string().uuid(),
    company_type: z
      .string()
      .toLowerCase()
      .optional()
      .refine((val) => !val || CompanyTypeEnum.options.map((t) => t.toLowerCase()).includes(val), {
        message: "Invalid company type",
      }),
    is_active: z.coerce.boolean().optional(),
    credit_status: z
      .string()
      .toLowerCase()
      .optional()
      .refine(
        (val) => !val || CreditStatusEnum.options.map((s: string) => s.toLowerCase()).includes(val),
        {
          message: "Invalid credit status",
        },
      ),
    is_blacklisted: z.coerce.boolean().optional(),
    limit: z.coerce.number().int().positive().max(500).default(200),
    offset: z.coerce.number().int().min(0).default(0),
  });

  type CompanyListQuery = z.infer<typeof CompanyListQuerySchema>;

  const CompanyListResponseSchema = z.array(CompanyListItemSchema);
  const CompanyListQueryJsonSchema = schemaFromZod(CompanyListQuerySchema, "CompanyListQuery");
  const CompanyListResponseJsonSchema = schemaFromZod(
    CompanyListResponseSchema,
    "CompanyListResponse",
  );
  const CompanyDetailResponseJsonSchema = schemaFromZod(
    CompanyListItemSchema,
    "CompanyDetailResponse",
  );
  const CompanyParamsSchema = z.object({ companyId: z.string().uuid() });
  const CompanyIdParamJsonSchema = schemaFromZod(CompanyParamsSchema, "CompanyIdParam");

  const COMPANIES_TAG = "Companies";

  app.get<{ Querystring: CompanyListQuery }>(
    "/v1/companies",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as CompanyListQuery).tenant_id,
        minRole: "MANAGER",
        requiredModules: "core",
      }),
      schema: buildRouteSchema({
        tag: COMPANIES_TAG,
        summary: "List companies",
        description: "Retrieve corporate clients, travel agencies, and business partners",
        querystring: CompanyListQueryJsonSchema,
        response: { 200: CompanyListResponseJsonSchema },
      }),
    },
    async (request) => {
      const { tenant_id, company_type, is_active, credit_status, is_blacklisted, limit, offset } =
        CompanyListQuerySchema.parse(request.query);
      const companies = await listCompanies({
        tenantId: tenant_id,
        companyType: company_type,
        isActive: is_active,
        creditStatus: credit_status,
        isBlacklisted: is_blacklisted,
        limit,
        offset,
      });
      return CompanyListResponseSchema.parse(companies);
    },
  );

  app.get<{ Params: z.infer<typeof CompanyParamsSchema>; Querystring: { tenant_id: string } }>(
    "/v1/companies/:companyId",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as { tenant_id: string }).tenant_id,
        minRole: "MANAGER",
        requiredModules: "core",
      }),
      schema: buildRouteSchema({
        tag: COMPANIES_TAG,
        summary: "Get company details",
        description: "Retrieve detailed information about a specific company",
        params: CompanyIdParamJsonSchema,
        querystring: schemaFromZod(
          z.object({ tenant_id: z.string().uuid() }),
          "CompanyDetailQuery",
        ),
        response: { 200: CompanyDetailResponseJsonSchema },
      }),
    },
    async (request, reply) => {
      const { companyId } = CompanyParamsSchema.parse(request.params);
      const { tenant_id } = z.object({ tenant_id: z.string().uuid() }).parse(request.query);
      const company = await getCompanyById({ companyId, tenantId: tenant_id });
      if (!company) {
        return reply.status(404).send({ error: "Company not found" });
      }
      return CompanyListItemSchema.parse(company);
    },
  );

  // -------------------------------------------------
  // MEETING ROOMS
  // -------------------------------------------------

  const MeetingRoomListQuerySchema = z.object({
    tenant_id: z.string().uuid(),
    property_id: z.string().uuid().optional(),
    room_type: z
      .string()
      .toUpperCase()
      .optional()
      .refine((val) => !val || MeetingRoomTypeEnum.options.includes(val as never), {
        message: "Invalid room type",
      }),
    room_status: z
      .string()
      .toUpperCase()
      .optional()
      .refine((val) => !val || MeetingRoomStatusEnum.options.includes(val as never), {
        message: "Invalid room status",
      }),
    is_active: z.coerce.boolean().optional(),
    min_capacity: z.coerce.number().int().positive().optional(),
    limit: z.coerce.number().int().positive().max(500).default(200),
    offset: z.coerce.number().int().min(0).default(0),
  });

  type MeetingRoomListQuery = z.infer<typeof MeetingRoomListQuerySchema>;

  const MeetingRoomListResponseSchema = z.array(MeetingRoomListItemSchema);
  const MeetingRoomListQueryJsonSchema = schemaFromZod(
    MeetingRoomListQuerySchema,
    "MeetingRoomListQuery",
  );
  const MeetingRoomListResponseJsonSchema = schemaFromZod(
    MeetingRoomListResponseSchema,
    "MeetingRoomListResponse",
  );
  const MeetingRoomDetailResponseJsonSchema = schemaFromZod(
    MeetingRoomListItemSchema,
    "MeetingRoomDetailResponse",
  );
  const MeetingRoomParamsSchema = z.object({ roomId: z.string().uuid() });
  const MeetingRoomIdParamJsonSchema = schemaFromZod(MeetingRoomParamsSchema, "MeetingRoomIdParam");

  const MEETING_ROOMS_TAG = "Meeting Rooms";

  app.get<{ Querystring: MeetingRoomListQuery }>(
    "/v1/meeting-rooms",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as MeetingRoomListQuery).tenant_id,
        minRole: "STAFF",
        requiredModules: "core",
      }),
      schema: buildRouteSchema({
        tag: MEETING_ROOMS_TAG,
        summary: "List meeting rooms",
        description:
          "Retrieve conference rooms, ballrooms, and event spaces with capacity and features",
        querystring: MeetingRoomListQueryJsonSchema,
        response: { 200: MeetingRoomListResponseJsonSchema },
      }),
    },
    async (request) => {
      const { tenant_id, property_id, room_type, room_status, is_active, min_capacity, limit, offset } =
        MeetingRoomListQuerySchema.parse(request.query);
      const rooms = await listMeetingRooms({
        tenantId: tenant_id,
        propertyId: property_id,
        roomType: room_type,
        roomStatus: room_status,
        isActive: is_active,
        minCapacity: min_capacity,
        limit,
        offset,
      });
      return MeetingRoomListResponseSchema.parse(rooms);
    },
  );

  app.get<{ Params: z.infer<typeof MeetingRoomParamsSchema>; Querystring: { tenant_id: string } }>(
    "/v1/meeting-rooms/:roomId",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as { tenant_id: string }).tenant_id,
        minRole: "STAFF",
        requiredModules: "core",
      }),
      schema: buildRouteSchema({
        tag: MEETING_ROOMS_TAG,
        summary: "Get meeting room details",
        description: "Retrieve detailed information about a specific meeting room",
        params: MeetingRoomIdParamJsonSchema,
        querystring: schemaFromZod(
          z.object({ tenant_id: z.string().uuid() }),
          "MeetingRoomDetailQuery",
        ),
        response: { 200: MeetingRoomDetailResponseJsonSchema },
      }),
    },
    async (request, reply) => {
      const { roomId } = MeetingRoomParamsSchema.parse(request.params);
      const { tenant_id } = z.object({ tenant_id: z.string().uuid() }).parse(request.query);
      const room = await getMeetingRoomById({ roomId, tenantId: tenant_id });
      if (!room) {
        return reply.status(404).send({ error: "Meeting room not found" });
      }
      return MeetingRoomListItemSchema.parse(room);
    },
  );

  // -------------------------------------------------
  // EVENT BOOKINGS
  // -------------------------------------------------

  const EventBookingListQuerySchema = z.object({
    tenant_id: z.string().uuid(),
    property_id: z.string().uuid().optional(),
    event_type: z
      .string()
      .toUpperCase()
      .optional()
      .refine((val) => !val || EventTypeEnum.options.includes(val as never), {
        message: "Invalid event type",
      }),
    booking_status: z
      .string()
      .toUpperCase()
      .optional()
      .refine((val) => !val || EventBookingStatusEnum.options.includes(val as never), {
        message: "Invalid booking status",
      }),
    event_date_from: z
      .string()
      .optional()
      .refine((val) => !val || !Number.isNaN(Date.parse(val)), {
        message: "event_date_from must be a valid ISO date",
      }),
    event_date_to: z
      .string()
      .optional()
      .refine((val) => !val || !Number.isNaN(Date.parse(val)), {
        message: "event_date_to must be a valid ISO date",
      }),
    meeting_room_id: z.string().uuid().optional(),
    limit: z.coerce.number().int().positive().max(500).default(200),
    offset: z.coerce.number().int().min(0).default(0),
  });

  type EventBookingListQuery = z.infer<typeof EventBookingListQuerySchema>;

  const EventBookingListResponseSchema = z.array(EventBookingListItemSchema);
  const EventBookingListQueryJsonSchema = schemaFromZod(
    EventBookingListQuerySchema,
    "EventBookingListQuery",
  );
  const EventBookingListResponseJsonSchema = schemaFromZod(
    EventBookingListResponseSchema,
    "EventBookingListResponse",
  );
  const EventBookingDetailResponseJsonSchema = schemaFromZod(
    EventBookingListItemSchema,
    "EventBookingDetailResponse",
  );
  const EventBookingParamsSchema = z.object({ eventId: z.string().uuid() });
  const EventBookingIdParamJsonSchema = schemaFromZod(
    EventBookingParamsSchema,
    "EventBookingIdParam",
  );

  const EVENT_BOOKINGS_TAG = "Event Bookings";

  app.get<{ Querystring: EventBookingListQuery }>(
    "/v1/event-bookings",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as EventBookingListQuery).tenant_id,
        minRole: "STAFF",
        requiredModules: "core",
      }),
      schema: buildRouteSchema({
        tag: EVENT_BOOKINGS_TAG,
        summary: "List event bookings",
        description:
          "Retrieve meeting, conference, wedding, and banquet bookings with status and attendee details",
        querystring: EventBookingListQueryJsonSchema,
        response: { 200: EventBookingListResponseJsonSchema },
      }),
    },
    async (request) => {
      const {
        tenant_id,
        property_id,
        event_type,
        booking_status,
        event_date_from,
        event_date_to,
        meeting_room_id,
        limit,
        offset,
      } = EventBookingListQuerySchema.parse(request.query);
      const events = await listEventBookings({
        tenantId: tenant_id,
        propertyId: property_id,
        eventType: event_type,
        bookingStatus: booking_status,
        eventDateFrom: event_date_from,
        eventDateTo: event_date_to,
        meetingRoomId: meeting_room_id,
        limit,
        offset,
      });
      return EventBookingListResponseSchema.parse(events);
    },
  );

  app.get<{ Params: z.infer<typeof EventBookingParamsSchema>; Querystring: { tenant_id: string } }>(
    "/v1/event-bookings/:eventId",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as { tenant_id: string }).tenant_id,
        minRole: "STAFF",
        requiredModules: "core",
      }),
      schema: buildRouteSchema({
        tag: EVENT_BOOKINGS_TAG,
        summary: "Get event booking details",
        description: "Retrieve detailed information about a specific event booking",
        params: EventBookingIdParamJsonSchema,
        querystring: schemaFromZod(
          z.object({ tenant_id: z.string().uuid() }),
          "EventBookingDetailQuery",
        ),
        response: { 200: EventBookingDetailResponseJsonSchema },
      }),
    },
    async (request, reply) => {
      const { eventId } = EventBookingParamsSchema.parse(request.params);
      const { tenant_id } = z.object({ tenant_id: z.string().uuid() }).parse(request.query);
      const event = await getEventBookingById({ eventId, tenantId: tenant_id });
      if (!event) {
        return reply.status(404).send({ error: "Event booking not found" });
      }
      return EventBookingListItemSchema.parse(event);
    },
  );

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
        response: { 200: WaitlistEntryDetailResponseJsonSchema },
      }),
    },
    async (request, reply) => {
      const { waitlistId } = WaitlistEntryParamsSchema.parse(request.params);
      const { tenant_id } = z.object({ tenant_id: z.string().uuid() }).parse(request.query);
      const entry = await getWaitlistEntryById({ waitlistId, tenantId: tenant_id });
      if (!entry) {
        return reply.status(404).send({ error: "Waitlist entry not found" });
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
        response: { 200: GroupBookingDetailResponseJsonSchema },
      }),
    },
    async (request, reply) => {
      const { groupBookingId } = GroupBookingParamsSchema.parse(request.params);
      const { tenant_id } = z.object({ tenant_id: z.string().uuid() }).parse(request.query);
      const booking = await getGroupBookingById({ groupBookingId, tenantId: tenant_id });
      if (!booking) {
        return reply.status(404).send({ error: "Group booking not found" });
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
        response: { 200: PromotionalCodeDetailResponseJsonSchema },
      }),
    },
    async (request, reply) => {
      const { promoId } = PromotionalCodeParamsSchema.parse(request.params);
      const { tenant_id } = z.object({ tenant_id: z.string().uuid() }).parse(request.query);
      const code = await getPromotionalCodeById({ promoId, tenantId: tenant_id });
      if (!code) {
        return reply.status(404).send({ error: "Promotional code not found" });
      }
      return PromotionalCodeListItemSchema.parse(code);
    },
  );

  const ValidatePromoCodeBodySchema = z.object({
    promo_code: z.string().min(1).max(50),
    tenant_id: z.string().uuid(),
    property_id: z.string().uuid().optional(),
    arrival_date: z.string(),
    departure_date: z.string(),
    room_type_id: z.string().uuid().optional(),
    rate_code: z.string().optional(),
    booking_amount: z.number().positive().optional(),
    guest_id: z.string().uuid().optional(),
    channel: z.string().optional(),
  });

  const ValidatePromoCodeResponseSchema = z.object({
    valid: z.boolean(),
    promo_id: z.string().uuid().optional(),
    promo_code: z.string(),
    promo_name: z.string().optional(),
    discount_type: z.string().optional(),
    discount_value: z.string().optional(),
    estimated_savings: z.string().optional(),
    message: z.string().optional(),
    rejection_reason: z.string().optional(),
  });

  const ValidatePromoCodeBodyJsonSchema = schemaFromZod(
    ValidatePromoCodeBodySchema,
    "ValidatePromoCodeBody",
  );
  const ValidatePromoCodeResponseJsonSchema = schemaFromZod(
    ValidatePromoCodeResponseSchema,
    "ValidatePromoCodeResponse",
  );

  app.post<{ Body: z.infer<typeof ValidatePromoCodeBodySchema> }>(
    "/v1/promo-codes/validate",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) =>
          (request.body as z.infer<typeof ValidatePromoCodeBodySchema>).tenant_id,
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
      const body = ValidatePromoCodeBodySchema.parse(request.body);
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
