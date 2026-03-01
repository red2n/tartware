import { buildRouteSchema, errorResponseSchema, schemaFromZod } from "@tartware/openapi";
import { ClickPerformanceItemSchema, MetasearchConfigurationsSchema } from "@tartware/schemas";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import {
  getMetasearchClickPerformance,
  getMetasearchConfigById,
  listMetasearchConfigs,
} from "../../services/booking-config/metasearch.js";

// =====================================================
// LOCAL QUERY / PARAM SCHEMAS
// =====================================================

const MetasearchConfigListQuerySchema = z.object({
  tenant_id: z.string().uuid(),
  property_id: z.string().uuid().optional(),
  platform: z.string().optional(),
  is_active: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().positive().max(500).default(200),
  offset: z.coerce.number().int().min(0).default(0),
});

type MetasearchConfigListQuery = z.infer<typeof MetasearchConfigListQuerySchema>;

const MetasearchConfigListResponseSchema = z.array(MetasearchConfigurationsSchema);
const MetasearchConfigListQueryJsonSchema = schemaFromZod(
  MetasearchConfigListQuerySchema,
  "MetasearchConfigListQuery",
);
const MetasearchConfigListResponseJsonSchema = schemaFromZod(
  MetasearchConfigListResponseSchema,
  "MetasearchConfigListResponse",
);

const MetasearchConfigParamsSchema = z.object({
  configId: z.string().uuid(),
});

const MetasearchConfigDetailResponseJsonSchema = schemaFromZod(
  MetasearchConfigurationsSchema,
  "MetasearchConfigDetailResponse",
);
const MetasearchConfigIdParamJsonSchema = schemaFromZod(
  MetasearchConfigParamsSchema,
  "MetasearchConfigIdParam",
);

// Click Performance schemas
const ClickPerformanceQuerySchema = z.object({
  tenant_id: z.string().uuid(),
  property_id: z.string().uuid().optional(),
  config_id: z.string().uuid().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

type ClickPerformanceQuery = z.infer<typeof ClickPerformanceQuerySchema>;


const ClickPerformanceResponseSchema = z.array(ClickPerformanceItemSchema);
const ClickPerformanceQueryJsonSchema = schemaFromZod(
  ClickPerformanceQuerySchema,
  "ClickPerformanceQuery",
);
const ClickPerformanceResponseJsonSchema = schemaFromZod(
  ClickPerformanceResponseSchema,
  "ClickPerformanceResponse",
);

// =====================================================
// TAGS
// =====================================================

const METASEARCH_TAG = "Metasearch";

// =====================================================
// ROUTE REGISTRATION
// =====================================================

export const registerMetasearchRoutes = (app: FastifyInstance): void => {
  // -------------------------------------------------
  // LIST METASEARCH CONFIGURATIONS
  // -------------------------------------------------

  app.get<{ Querystring: MetasearchConfigListQuery }>(
    "/v1/metasearch-configs",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as MetasearchConfigListQuery).tenant_id,
        minRole: "MANAGER",
        requiredModules: "core",
      }),
      schema: buildRouteSchema({
        tag: METASEARCH_TAG,
        summary: "List metasearch configurations",
        description:
          "Retrieve metasearch platform configurations (CPC/CPA bids, budgets, rate feeds) per property",
        querystring: MetasearchConfigListQueryJsonSchema,
        response: {
          200: MetasearchConfigListResponseJsonSchema,
        },
      }),
    },
    async (request) => {
      const { tenant_id, property_id, platform, is_active, limit, offset } =
        MetasearchConfigListQuerySchema.parse(request.query);

      const configs = await listMetasearchConfigs({
        tenantId: tenant_id,
        propertyId: property_id,
        platform,
        isActive: is_active,
        limit,
        offset,
      });

      return MetasearchConfigListResponseSchema.parse(configs);
    },
  );

  // -------------------------------------------------
  // GET METASEARCH CONFIGURATION BY ID
  // -------------------------------------------------

  app.get<{
    Params: z.infer<typeof MetasearchConfigParamsSchema>;
    Querystring: { tenant_id: string };
  }>(
    "/v1/metasearch-configs/:configId",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as { tenant_id: string }).tenant_id,
        minRole: "MANAGER",
        requiredModules: "core",
      }),
      schema: buildRouteSchema({
        tag: METASEARCH_TAG,
        summary: "Get metasearch configuration details",
        description: "Retrieve detailed information about a specific metasearch configuration",
        params: MetasearchConfigIdParamJsonSchema,
        querystring: schemaFromZod(
          z.object({ tenant_id: z.string().uuid() }),
          "MetasearchConfigDetailQuery",
        ),
        response: {
          200: MetasearchConfigDetailResponseJsonSchema,
          404: errorResponseSchema,
        },
      }),
    },
    async (request, reply) => {
      const { configId } = MetasearchConfigParamsSchema.parse(request.params);
      const { tenant_id } = z.object({ tenant_id: z.string().uuid() }).parse(request.query);

      const config = await getMetasearchConfigById({
        configId,
        tenantId: tenant_id,
      });

      if (!config) {
        return reply.notFound("Metasearch configuration not found");
      }

      return MetasearchConfigurationsSchema.parse(config);
    },
  );

  // -------------------------------------------------
  // METASEARCH CLICK PERFORMANCE
  // -------------------------------------------------

  app.get<{ Querystring: ClickPerformanceQuery }>(
    "/v1/metasearch-configs/performance",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as ClickPerformanceQuery).tenant_id,
        minRole: "MANAGER",
        requiredModules: "core",
      }),
      schema: buildRouteSchema({
        tag: METASEARCH_TAG,
        summary: "Get metasearch click performance stats",
        description:
          "Aggregated click, cost, and conversion metrics per metasearch configuration over a date range",
        querystring: ClickPerformanceQueryJsonSchema,
        response: {
          200: ClickPerformanceResponseJsonSchema,
        },
      }),
    },
    async (request) => {
      const { tenant_id, property_id, config_id, from, to } = ClickPerformanceQuerySchema.parse(
        request.query,
      );

      const stats = await getMetasearchClickPerformance({
        tenantId: tenant_id,
        propertyId: property_id,
        configId: config_id,
        from,
        to,
      });

      return ClickPerformanceResponseSchema.parse(stats);
    },
  );
};
