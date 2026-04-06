import { buildRouteSchema, schemaFromZod } from "@tartware/openapi";
import {
  CashierSessionListItemSchema,
  CashierSessionListResponseSchema,
  ShiftSummaryResponseSchema,
} from "@tartware/schemas";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import {
  getCashierSessionById,
  getShiftSummary,
  listCashierSessions,
} from "../services/cashier-service.js";

const CASHIER_TAG = "Cashier";

export const registerCashierRoutes = (app: FastifyInstance): void => {
  // ============================================================================
  // CASHIER SESSIONS
  // ============================================================================

  const CashierSessionListQuerySchema = z.object({
    tenant_id: z.string().uuid(),
    property_id: z.string().uuid().optional(),
    session_status: z.string().optional(),
    shift_type: z.string().optional(),
    business_date: z.string().optional(),
    limit: z.coerce.number().int().positive().max(200).default(100),
    offset: z.coerce.number().int().min(0).default(0),
  });

  type CashierSessionListQuery = z.infer<typeof CashierSessionListQuerySchema>;

  const CashierSessionListQueryJsonSchema = schemaFromZod(
    CashierSessionListQuerySchema,
    "CashierSessionListQuery",
  );
  const CashierSessionListResponseJsonSchema = schemaFromZod(
    CashierSessionListResponseSchema,
    "CashierSessionListResponse",
  );
  const CashierSessionDetailJsonSchema = schemaFromZod(
    CashierSessionListItemSchema,
    "CashierSessionDetail",
  );

  app.get<{ Querystring: CashierSessionListQuery }>(
    "/v1/billing/cashier-sessions",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as CashierSessionListQuery).tenant_id,
        minRole: "ADMIN",
        requiredModules: "finance-automation",
      }),
      schema: buildRouteSchema({
        tag: CASHIER_TAG,
        summary: "List cashier sessions with optional filters",
        querystring: CashierSessionListQueryJsonSchema,
        response: {
          200: CashierSessionListResponseJsonSchema,
        },
      }),
    },
    async (request) => {
      const { tenant_id, property_id, session_status, shift_type, business_date, limit, offset } =
        CashierSessionListQuerySchema.parse(request.query);

      const sessions = await listCashierSessions({
        tenantId: tenant_id,
        propertyId: property_id,
        sessionStatus: session_status,
        shiftType: shift_type,
        businessDate: business_date,
        limit,
        offset,
      });

      return CashierSessionListResponseSchema.parse({
        data: sessions,
        meta: { count: sessions.length },
      });
    },
  );

  app.get<{
    Params: { sessionId: string };
    Querystring: { tenant_id: string };
  }>(
    "/v1/billing/cashier-sessions/:sessionId",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as { tenant_id: string }).tenant_id,
        minRole: "ADMIN",
        requiredModules: "finance-automation",
      }),
      schema: buildRouteSchema({
        tag: CASHIER_TAG,
        summary: "Get cashier session by ID",
        params: schemaFromZod(z.object({ sessionId: z.string().uuid() }), "SessionIdParam"),
        querystring: schemaFromZod(
          z.object({ tenant_id: z.string().uuid() }),
          "TenantIdQuerySession",
        ),
        response: {
          200: CashierSessionDetailJsonSchema,
        },
      }),
    },
    async (request, reply) => {
      const { sessionId } = request.params;
      const { tenant_id } = request.query;

      const session = await getCashierSessionById(sessionId, tenant_id);

      if (!session) {
        reply.notFound("CASHIER_SESSION_NOT_FOUND");
        return;
      }

      return CashierSessionListItemSchema.parse(session);
    },
  );

  // ============================================================================
  // SHIFT HANDOVER SUMMARY
  // ============================================================================

  app.get<{
    Params: { sessionId: string };
    Querystring: { tenant_id: string };
  }>(
    "/v1/billing/cashier-sessions/:sessionId/shift-summary",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as { tenant_id: string }).tenant_id,
        minRole: "ADMIN",
        requiredModules: "finance-automation",
      }),
      schema: buildRouteSchema({
        tag: CASHIER_TAG,
        summary: "Get shift handover summary for a cashier session",
        params: schemaFromZod(z.object({ sessionId: z.string().uuid() }), "ShiftSessionIdParam"),
        querystring: schemaFromZod(
          z.object({ tenant_id: z.string().uuid() }),
          "TenantIdQueryShift",
        ),
        response: {
          200: schemaFromZod(ShiftSummaryResponseSchema, "ShiftSummaryResponse"),
        },
      }),
    },
    async (request, reply) => {
      const { sessionId } = request.params;
      const { tenant_id } = request.query;

      const summary = await getShiftSummary(sessionId, tenant_id);

      if (!summary) {
        reply.notFound("CASHIER_SESSION_NOT_FOUND");
        return;
      }

      return ShiftSummaryResponseSchema.parse(summary);
    },
  );
};
