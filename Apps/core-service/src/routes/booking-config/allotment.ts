import { buildRouteSchema, errorResponseSchema, schemaFromZod } from "@tartware/openapi";
import { AllotmentListItemSchema, AllotmentStatusEnum, AllotmentTypeEnum } from "@tartware/schemas";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { getAllotmentById, listAllotments } from "../../services/booking-config/allotment.js";

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

const ALLOTMENTS_TAG = "Allotments";

// =====================================================
// ROUTE REGISTRATION
// =====================================================

export const registerAllotmentRoutes = (app: FastifyInstance): void => {
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
          404: errorResponseSchema,
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
        return reply.notFound("Allotment not found");
      }

      return AllotmentListItemSchema.parse(allotment);
    },
  );
};
