import { buildRouteSchema, errorResponseSchema, schemaFromZod } from "@tartware/openapi";
import type {
  AllotmentStatusBody,
  AllotmentUpdateBody,
  AllotmentWriteBody,
} from "@tartware/schemas";
import {
  AllotmentListItemSchema,
  AllotmentStatusBodySchema,
  AllotmentStatusEnum,
  AllotmentTypeEnum,
  AllotmentUpdateBodySchema,
  AllotmentWriteBodySchema,
} from "@tartware/schemas";
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  AllotmentTransitionError,
  createAllotment,
  getAllotmentById,
  listAllotments,
  transitionAllotmentStatus,
  updateAllotment,
} from "../../services/booking-config/allotment.js";
import { ReferenceCodeConflictError } from "../../services/booking-config/common.js";

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
  // -------------------------------------------------
  // ALLOTMENT WRITES — step 4 of ui-gaps/16-booking-reference-data.md
  //
  // Plain HTTP per COV-18: one table, one service, no fan-out. Not through
  // availability-guard-service — see the 2026-08-19 decision in that spec for
  // why the guard is the wrong mechanism, and why an allotment is a
  // distribution contract rather than the inventory side of a group.
  // -------------------------------------------------

  const allotmentWriteScope = app.withTenantScope({
    resolveTenantId: (request) => (request.body as { tenant_id?: string })?.tenant_id,
    minRole: "MANAGER",
    requiredModules: "core",
  });

  /** Payload → service input. Shared by create and update. */
  const toAllotmentInput = (body: AllotmentWriteBody | AllotmentUpdateBody) => ({
    ...("property_id" in body ? { propertyId: body.property_id } : {}),
    ...("allotment_code" in body ? { allotmentCode: body.allotment_code } : {}),
    ...("allotment_status" in body ? { allotmentStatus: body.allotment_status } : {}),
    ...("start_date" in body ? { startDate: body.start_date } : {}),
    ...("end_date" in body ? { endDate: body.end_date } : {}),
    ...("rooms_picked_up" in body ? { roomsPickedUp: body.rooms_picked_up } : {}),
    allotmentName: body.allotment_name,
    allotmentType: body.allotment_type,
    cutoffDate: body.cutoff_date,
    cutoffDaysPrior: body.cutoff_days_prior,
    roomTypeId: body.room_type_id,
    totalRoomsBlocked: body.total_rooms_blocked,
    roomsPerNight: body.rooms_per_night,
    rateType: body.rate_type,
    contractedRate: body.contracted_rate,
    accountName: body.account_name,
    accountType: body.account_type,
    billingType: body.billing_type,
    contactName: body.contact_name,
    contactEmail: body.contact_email,
    contactPhone: body.contact_phone,
    contactCompany: body.contact_company,
    bookingSourceId: body.booking_source_id,
    marketSegmentId: body.market_segment_id,
    channel: body.channel,
    depositRequired: body.deposit_required,
    depositAmount: body.deposit_amount,
    attritionClause: body.attrition_clause,
    attritionPercentage: body.attrition_percentage,
    guaranteedRooms: body.guaranteed_rooms,
    elasticLimit: body.elastic_limit,
    commissionPercentage: body.commission_percentage,
    isVip: body.is_vip,
    priorityLevel: body.priority_level,
    notes: body.notes,
    internalNotes: body.internal_notes,
  });

  app.post<{ Body: AllotmentWriteBody }>(
    "/v1/allotments",
    {
      preHandler: allotmentWriteScope,
      schema: buildRouteSchema({
        tag: ALLOTMENTS_TAG,
        summary: "Create an allotment",
        description:
          "Blocks rooms under a contract. The block does not yet reduce sellable availability — see ui-gaps/16 for that open question.",
        body: schemaFromZod(AllotmentWriteBodySchema, "AllotmentWriteBody"),
      }),
    },
    async (request, reply) => {
      const body = AllotmentWriteBodySchema.parse(request.body);
      let created: Awaited<ReturnType<typeof createAllotment>>;

      try {
        created = await createAllotment(
          body.tenant_id,
          {
            ...toAllotmentInput(body),
            propertyId: body.property_id,
            allotmentCode: body.allotment_code,
            allotmentName: body.allotment_name,
            allotmentType: body.allotment_type,
            startDate: body.start_date,
            endDate: body.end_date,
            totalRoomsBlocked: body.total_rooms_blocked,
            currencyCode: body.currency_code,
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
        return reply.internalServerError("Failed to create allotment");
      }

      return reply.status(201).send({ data: created, message: "Allotment created" });
    },
  );

  app.put<{ Params: z.infer<typeof AllotmentParamsSchema>; Body: AllotmentUpdateBody }>(
    "/v1/allotments/:allotmentId",
    {
      preHandler: allotmentWriteScope,
      schema: buildRouteSchema({
        tag: ALLOTMENTS_TAG,
        summary: "Update an allotment",
        description:
          "`allotment_code`, the date window and the status are fixed here: the code is the contract's reference, moving the window is a new agreement, and the status has its own route so the transition can be checked.",
        params: AllotmentIdParamJsonSchema,
        body: schemaFromZod(AllotmentUpdateBodySchema, "AllotmentUpdateBody"),
      }),
    },
    async (request, reply) => {
      const { allotmentId } = AllotmentParamsSchema.parse(request.params);
      const body = AllotmentUpdateBodySchema.parse(request.body);

      const updated = await updateAllotment(
        body.tenant_id,
        allotmentId,
        toAllotmentInput(body),
        (request as { userId?: string }).userId,
      );

      if (!updated) {
        return reply.notFound("Allotment not found");
      }

      return reply.send({ data: updated, message: "Allotment updated" });
    },
  );

  app.post<{ Params: z.infer<typeof AllotmentParamsSchema>; Body: AllotmentStatusBody }>(
    "/v1/allotments/:allotmentId/status",
    {
      preHandler: allotmentWriteScope,
      schema: buildRouteSchema({
        tag: ALLOTMENTS_TAG,
        summary: "Move an allotment through its lifecycle",
        description:
          "TENTATIVE → DEFINITE → ACTIVE → PICKUP_IN_PROGRESS → COMPLETED, with CANCELLED reachable from anything still live. An illegal move returns 409.",
        params: AllotmentIdParamJsonSchema,
        body: schemaFromZod(AllotmentStatusBodySchema, "AllotmentStatusBody"),
      }),
    },
    async (request, reply) => {
      const { allotmentId } = AllotmentParamsSchema.parse(request.params);
      const body = AllotmentStatusBodySchema.parse(request.body);
      let moved: Awaited<ReturnType<typeof transitionAllotmentStatus>>;

      try {
        moved = await transitionAllotmentStatus(
          body.tenant_id,
          allotmentId,
          body.allotment_status,
          body.cancellation_reason,
          (request as { userId?: string }).userId,
        );
      } catch (error) {
        if (error instanceof AllotmentTransitionError) {
          return reply.conflict(error.message);
        }
        throw error;
      }

      if (!moved) {
        return reply.notFound("Allotment not found");
      }

      return reply.send({ data: moved, message: `Allotment moved to ${body.allotment_status}` });
    },
  );
};
