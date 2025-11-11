import { ReservationStatusEnum } from "@tartware/schemas";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { listReservations, ReservationListItemSchema } from "../services/reservation-service.js";

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
});

type ReservationListQuery = z.infer<typeof ReservationListQuerySchema>;

const ReservationListResponseSchema = z.array(ReservationListItemSchema);

export const registerReservationRoutes = (app: FastifyInstance): void => {
  app.get<{ Querystring: ReservationListQuery }>(
    "/v1/reservations",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as ReservationListQuery).tenant_id,
        minRole: "MANAGER",
        requiredModules: "core",
      }),
    },
    async (request) => {
      const { tenant_id, property_id, status, search, limit } = ReservationListQuerySchema.parse(
        request.query,
      );

      const reservations = await listReservations({
        tenantId: tenant_id,
        propertyId: property_id,
        status,
        search,
        limit,
      });

      return ReservationListResponseSchema.parse(reservations);
    },
  );
};
