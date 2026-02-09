import { buildRouteSchema, schemaFromZod } from "@tartware/openapi";
import { ReservationStatusEnum } from "@tartware/schemas";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import {
  getReservationById,
  listReservations,
  ReservationDetailSchema,
  ReservationListItemSchema,
} from "../services/reservation-service.js";

const ReservationListQuerySchema = z.object({
  tenant_id: z.string().uuid(),
  property_id: z.string().uuid().optional(),
  status: z
    .string()
    .toLowerCase()
    .optional()
    .refine(
      (value) =>
        !value || ReservationStatusEnum.options.map((s) => s.toLowerCase()).includes(value),
      { message: "Invalid reservation status" },
    ),
  search: z.string().min(2).max(100).optional(),
  limit: z.coerce.number().int().positive().max(200).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

type ReservationListQuery = z.infer<typeof ReservationListQuerySchema>;

const ReservationListResponseSchema = z.array(ReservationListItemSchema);
const ReservationListQueryJsonSchema = schemaFromZod(
  ReservationListQuerySchema,
  "ReservationListQuery",
);
const ReservationListResponseJsonSchema = schemaFromZod(
  ReservationListResponseSchema,
  "ReservationListResponse",
);

const RESERVATIONS_TAG = "Reservations";

const ReservationGetQuerySchema = z.object({
  tenant_id: z.string().uuid(),
});
type ReservationGetQuery = z.infer<typeof ReservationGetQuerySchema>;
const ReservationGetQueryJsonSchema = schemaFromZod(
  ReservationGetQuerySchema,
  "ReservationGetQuery",
);
const ReservationDetailJsonSchema = schemaFromZod(ReservationDetailSchema, "ReservationDetail");

export const registerReservationRoutes = (app: FastifyInstance): void => {
  /**
   * GET single reservation by ID — includes folio + status history.
   */
  app.get<{ Params: { id: string }; Querystring: ReservationGetQuery }>(
    "/v1/reservations/:id",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as ReservationGetQuery).tenant_id,
        minRole: "STAFF",
        requiredModules: "core",
      }),
      schema: buildRouteSchema({
        tag: RESERVATIONS_TAG,
        summary: "Get a single reservation by ID with folio and status history",
        querystring: ReservationGetQueryJsonSchema,
        response: {
          200: ReservationDetailJsonSchema,
        },
      }),
    },
    async (request, reply) => {
      const { tenant_id } = ReservationGetQuerySchema.parse(request.query);
      const { id } = request.params;

      const reservation = await getReservationById({
        tenantId: tenant_id,
        reservationId: id,
      });

      if (!reservation) {
        return reply.code(404).send({
          error: "RESERVATION_NOT_FOUND",
          message: `Reservation ${id} not found`,
        });
      }

      return reservation;
    },
  );

  app.get<{ Querystring: ReservationListQuery }>(
    "/v1/reservations",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as ReservationListQuery).tenant_id,
        minRole: "MANAGER",
        requiredModules: "core",
      }),
      schema: buildRouteSchema({
        tag: RESERVATIONS_TAG,
        summary: "List reservations with filtering",
        querystring: ReservationListQueryJsonSchema,
        response: {
          200: ReservationListResponseJsonSchema,
        },
      }),
    },
    async (request) => {
      const { tenant_id, property_id, status, search, limit, offset } = ReservationListQuerySchema.parse(
        request.query,
      );

      const reservations = await listReservations({
        tenantId: tenant_id,
        propertyId: property_id,
        status,
        search,
        limit,
        offset,
      });

      return ReservationListResponseSchema.parse(reservations);
    },
  );
};
