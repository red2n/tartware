import { buildRouteSchema, schemaFromZod } from "@tartware/openapi";
import {
  BookingSourceListItemSchema,
  BookingSourceTypeEnum,
  ChannelMappingListItemSchema,
  MarketSegmentListItemSchema,
  MarketSegmentTypeEnum,
} from "@tartware/schemas";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import {
  getBookingSourceById,
  getChannelMappingById,
  getMarketSegmentById,
  listBookingSources,
  listChannelMappings,
  listMarketSegments,
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
};
