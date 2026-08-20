import { buildRouteSchema, errorResponseSchema, schemaFromZod } from "@tartware/openapi";
import type {
  BookingSourceUpdateBody,
  BookingSourceWriteBody,
  MarketSegmentUpdateBody,
  MarketSegmentWriteBody,
} from "@tartware/schemas";
import {
  BookingSourceListItemSchema,
  BookingSourceTypeEnum,
  BookingSourceUpdateBodySchema,
  BookingSourceWriteBodySchema,
  ChannelMappingListItemSchema,
  MarketSegmentListItemSchema,
  MarketSegmentTypeEnum,
  MarketSegmentUpdateBodySchema,
  MarketSegmentWriteBodySchema,
} from "@tartware/schemas";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { ReferenceCodeConflictError } from "../../services/booking-config/common.js";
import {
  createBookingSource,
  createMarketSegment,
  deleteBookingSource,
  deleteMarketSegment,
  getBookingSourceById,
  getChannelMappingById,
  getMarketSegmentById,
  listBookingSources,
  listChannelMappings,
  listMarketSegments,
  updateBookingSource,
  updateMarketSegment,
} from "../../services/booking-config/distribution.js";

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

const BOOKING_SOURCES_TAG = "Booking Sources";
const MARKET_SEGMENTS_TAG = "Market Segments";
const CHANNEL_MAPPINGS_TAG = "Channel Mappings";

// =====================================================
// ROUTE REGISTRATION
// =====================================================

export const registerDistributionRoutes = (app: FastifyInstance): void => {
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
          404: errorResponseSchema,
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
        return reply.notFound("Booking source not found");
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
          404: errorResponseSchema,
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
        return reply.notFound("Market segment not found");
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
          404: errorResponseSchema,
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
        return reply.notFound("Channel mapping not found");
      }

      return ChannelMappingListItemSchema.parse(mapping);
    },
  );

  // =====================================================
  // Write paths — reference data, plain HTTP per
  // ui-gaps/18-write-path-gap.md. See ui-gaps/14-channel-distribution.md.
  // =====================================================

  const writeScopeFromBody = app.withTenantScope({
    resolveTenantId: (request) => (request.body as { tenant_id?: string })?.tenant_id,
    minRole: "MANAGER",
    requiredModules: "core",
  });

  const deleteScopeFromQuery = app.withTenantScope({
    resolveTenantId: (request) => (request.query as { tenant_id?: string })?.tenant_id,
    minRole: "MANAGER",
    requiredModules: "core",
  });

  const tenantQuerySchema = z.object({ tenant_id: z.string().uuid() });

  app.post<{ Body: BookingSourceWriteBody }>(
    "/v1/booking-sources",
    {
      preHandler: writeScopeFromBody,
      schema: buildRouteSchema({
        tag: BOOKING_SOURCES_TAG,
        summary: "Create a booking source",
        description:
          "Performance columns (bookings, revenue, conversion) are machine-maintained and not settable here.",
        body: schemaFromZod(BookingSourceWriteBodySchema, "BookingSourceWriteBody"),
      }),
    },
    async (request, reply) => {
      const body = BookingSourceWriteBodySchema.parse(request.body);
      let created: Awaited<ReturnType<typeof createBookingSource>>;
      try {
        created = await createBookingSource(
          body.tenant_id,
          {
            sourceCode: body.source_code,
            sourceName: body.source_name,
            sourceType: body.source_type,
            propertyId: body.property_id,
            category: body.category,
            subCategory: body.sub_category,
            isActive: body.is_active,
            isBookable: body.is_bookable,
            channelName: body.channel_name,
            channelWebsite: body.channel_website,
            channelManager: body.channel_manager,
            commissionType: body.commission_type,
            commissionPercentage: body.commission_percentage,
            commissionFixedAmount: body.commission_fixed_amount,
            commissionNotes: body.commission_notes,
            ranking: body.ranking,
            isPreferred: body.is_preferred,
          },
          (request as { userId?: string }).userId,
        );
      } catch (error) {
        // A code that is already taken is the operator's most likely mistake.
        if (error instanceof ReferenceCodeConflictError) {
          return reply.conflict(error.message);
        }
        throw error;
      }

      if (!created) {
        return reply.internalServerError("Failed to create booking source");
      }

      return reply.status(201).send({ data: created, message: "Booking source created" });
    },
  );

  app.put<{ Params: { sourceId: string }; Body: BookingSourceUpdateBody }>(
    "/v1/booking-sources/:sourceId",
    {
      preHandler: writeScopeFromBody,
      schema: buildRouteSchema({
        tag: BOOKING_SOURCES_TAG,
        summary: "Update a booking source",
        description: "source_code is fixed — reservations reference it.",
        params: BookingSourceIdParamJsonSchema,
        body: schemaFromZod(BookingSourceUpdateBodySchema, "BookingSourceUpdateBody"),
      }),
    },
    async (request, reply) => {
      const body = BookingSourceUpdateBodySchema.parse(request.body);
      const { sourceId } = BookingSourceParamsSchema.parse(request.params);
      const updated = await updateBookingSource(
        body.tenant_id,
        sourceId,
        {
          sourceName: body.source_name,
          sourceType: body.source_type,
          category: body.category,
          subCategory: body.sub_category,
          isActive: body.is_active,
          isBookable: body.is_bookable,
          channelName: body.channel_name,
          channelWebsite: body.channel_website,
          channelManager: body.channel_manager,
          commissionType: body.commission_type,
          commissionPercentage: body.commission_percentage,
          commissionFixedAmount: body.commission_fixed_amount,
          commissionNotes: body.commission_notes,
          ranking: body.ranking,
          isPreferred: body.is_preferred,
        },
        (request as { userId?: string }).userId,
      );

      if (!updated) {
        return reply.notFound("Booking source not found");
      }

      return reply.send({ data: updated, message: "Booking source updated" });
    },
  );

  app.delete<{ Params: { sourceId: string }; Querystring: { tenant_id: string } }>(
    "/v1/booking-sources/:sourceId",
    {
      preHandler: deleteScopeFromQuery,
      schema: buildRouteSchema({
        tag: BOOKING_SOURCES_TAG,
        summary: "Retire a booking source",
        description:
          "Soft delete. Historic reservations still reference the source for production reporting, so the row stays but stops being bookable.",
        params: BookingSourceIdParamJsonSchema,
        querystring: schemaFromZod(tenantQuerySchema, "BookingSourceDeleteQuery"),
      }),
    },
    async (request, reply) => {
      const { sourceId } = BookingSourceParamsSchema.parse(request.params);
      const { tenant_id } = tenantQuerySchema.parse(request.query);
      const removed = await deleteBookingSource(
        tenant_id,
        sourceId,
        (request as { userId?: string }).userId,
      );

      if (!removed) {
        return reply.notFound("Booking source not found");
      }

      return reply.send({ message: "Booking source retired" });
    },
  );

  app.post<{ Body: MarketSegmentWriteBody }>(
    "/v1/market-segments",
    {
      preHandler: writeScopeFromBody,
      schema: buildRouteSchema({
        tag: MARKET_SEGMENTS_TAG,
        summary: "Create a market segment",
        body: schemaFromZod(MarketSegmentWriteBodySchema, "MarketSegmentWriteBody"),
      }),
    },
    async (request, reply) => {
      const body = MarketSegmentWriteBodySchema.parse(request.body);
      let created: Awaited<ReturnType<typeof createMarketSegment>>;
      try {
        created = await createMarketSegment(
          body.tenant_id,
          {
            segmentCode: body.segment_code,
            segmentName: body.segment_name,
            segmentType: body.segment_type,
            propertyId: body.property_id,
            isActive: body.is_active,
            isBookable: body.is_bookable,
            parentSegmentId: body.parent_segment_id,
            rateMultiplier: body.rate_multiplier,
          },
          (request as { userId?: string }).userId,
        );
      } catch (error) {
        if (error instanceof ReferenceCodeConflictError) {
          return reply.conflict(error.message);
        }
        throw error;
      }

      if (!created) {
        return reply.internalServerError("Failed to create market segment");
      }

      return reply.status(201).send({ data: created, message: "Market segment created" });
    },
  );

  app.put<{ Params: { segmentId: string }; Body: MarketSegmentUpdateBody }>(
    "/v1/market-segments/:segmentId",
    {
      preHandler: writeScopeFromBody,
      schema: buildRouteSchema({
        tag: MARKET_SEGMENTS_TAG,
        summary: "Update a market segment",
        description: "segment_code is fixed — production reporting groups on it.",
        params: MarketSegmentIdParamJsonSchema,
        body: schemaFromZod(MarketSegmentUpdateBodySchema, "MarketSegmentUpdateBody"),
      }),
    },
    async (request, reply) => {
      const body = MarketSegmentUpdateBodySchema.parse(request.body);
      const { segmentId } = MarketSegmentParamsSchema.parse(request.params);
      const updated = await updateMarketSegment(
        body.tenant_id,
        segmentId,
        {
          segmentName: body.segment_name,
          segmentType: body.segment_type,
          isActive: body.is_active,
          isBookable: body.is_bookable,
          rateMultiplier: body.rate_multiplier,
        },
        (request as { userId?: string }).userId,
      );

      if (!updated) {
        return reply.notFound("Market segment not found");
      }

      return reply.send({ data: updated, message: "Market segment updated" });
    },
  );

  app.delete<{ Params: { segmentId: string }; Querystring: { tenant_id: string } }>(
    "/v1/market-segments/:segmentId",
    {
      preHandler: deleteScopeFromQuery,
      schema: buildRouteSchema({
        tag: MARKET_SEGMENTS_TAG,
        summary: "Retire a market segment",
        description: "Refused with 409 while sub-segments still point at it.",
        params: MarketSegmentIdParamJsonSchema,
        querystring: schemaFromZod(tenantQuerySchema, "MarketSegmentDeleteQuery"),
      }),
    },
    async (request, reply) => {
      const { segmentId } = MarketSegmentParamsSchema.parse(request.params);
      const { tenant_id } = tenantQuerySchema.parse(request.query);
      const result = await deleteMarketSegment(
        tenant_id,
        segmentId,
        (request as { userId?: string }).userId,
      );

      if (result.reason === "SEGMENT_HAS_CHILDREN") {
        return reply.conflict("Reassign or retire the sub-segments first");
      }
      if (!result.removed) {
        return reply.notFound("Market segment not found");
      }

      return reply.send({ message: "Market segment retired" });
    },
  );
};
