import { buildRouteSchema, schemaFromZod } from "@tartware/openapi";
import type {
  BillingPaymentListQuery,
  BucketCheckQuery,
  CashierSessionListQuery,
  ChargePostingListQuery,
  FolioListQuery,
  PreAuditQuery,
} from "@tartware/schemas";
import {
  BillingPaymentListQuerySchema,
  BucketCheckQuerySchema,
  BucketCheckResponseSchema,
  CashierSessionListQuerySchema,
  ChargePostingListItemSchema,
  ChargePostingListQuerySchema,
  FolioListItemSchema,
  FolioListQuerySchema,
  PreAuditQuerySchema,
  PreAuditResponseSchema,
} from "@tartware/schemas";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import {
  BillingPaymentSchema,
  getBucketCheck,
  getCashierSessionById,
  getFolioById,
  getPreAuditChecklist,
  listBillingPayments,
  listCashierSessions,
  listChargePostings,
  listFolios,
} from "../services/billing-service.js";

const BillingListResponseSchema = z.array(BillingPaymentSchema);
const BillingListQueryJsonSchema = schemaFromZod(
  BillingPaymentListQuerySchema,
  "BillingPaymentsQuery",
);
const BillingListResponseJsonSchema = schemaFromZod(
  BillingListResponseSchema,
  "BillingPaymentsResponse",
);

const FolioListResponseSchema = z.array(FolioListItemSchema);
const FolioListQueryJsonSchema = schemaFromZod(FolioListQuerySchema, "FolioListQuery");
const FolioListResponseJsonSchema = schemaFromZod(FolioListResponseSchema, "FolioListResponse");
const FolioDetailJsonSchema = schemaFromZod(FolioListItemSchema, "FolioDetail");

const ChargePostingListResponseSchema = z.array(ChargePostingListItemSchema);
const ChargePostingListQueryJsonSchema = schemaFromZod(
  ChargePostingListQuerySchema,
  "ChargePostingListQuery",
);
const ChargePostingListResponseJsonSchema = schemaFromZod(
  ChargePostingListResponseSchema,
  "ChargePostingListResponse",
);

const BILLING_TAG = "Billing";

export const registerBillingRoutes = (app: FastifyInstance): void => {
  app.get<{ Querystring: BillingPaymentListQuery }>(
    "/v1/billing/payments",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as BillingPaymentListQuery).tenant_id,
        minRole: "ADMIN",
        requiredModules: "finance-automation",
      }),
      schema: buildRouteSchema({
        tag: BILLING_TAG,
        summary: "List billing payments with optional filters",
        querystring: BillingListQueryJsonSchema,
        response: {
          200: BillingListResponseJsonSchema,
        },
      }),
    },
    async (request) => {
      const {
        tenant_id,
        property_id,
        status,
        transaction_type,
        payment_method,
        limit,
        offset,
        reservation_id,
      } = BillingPaymentListQuerySchema.parse(request.query);

      const payments = await listBillingPayments({
        tenantId: tenant_id,
        propertyId: property_id,
        status,
        transactionType: transaction_type,
        paymentMethod: payment_method,
        limit,
        offset,
        reservationId: reservation_id,
      });

      return BillingListResponseSchema.parse(payments);
    },
  );

  // ============================================================================
  // FOLIOS
  // ============================================================================

  app.get<{ Querystring: FolioListQuery }>(
    "/v1/billing/folios",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as FolioListQuery).tenant_id,
        minRole: "ADMIN",
        requiredModules: "finance-automation",
      }),
      schema: buildRouteSchema({
        tag: BILLING_TAG,
        summary: "List folios with optional filters",
        querystring: FolioListQueryJsonSchema,
        response: {
          200: FolioListResponseJsonSchema,
        },
      }),
    },
    async (request) => {
      const {
        tenant_id,
        property_id,
        folio_status,
        folio_type,
        reservation_id,
        guest_id,
        limit,
        offset,
      } = FolioListQuerySchema.parse(request.query);

      const folios = await listFolios({
        tenantId: tenant_id,
        propertyId: property_id,
        folioStatus: folio_status,
        folioType: folio_type,
        reservationId: reservation_id,
        guestId: guest_id,
        limit,
        offset,
      });

      return FolioListResponseSchema.parse(folios);
    },
  );

  app.get<{ Params: { folioId: string }; Querystring: { tenant_id: string } }>(
    "/v1/billing/folios/:folioId",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as { tenant_id: string }).tenant_id,
        minRole: "ADMIN",
        requiredModules: "finance-automation",
      }),
      schema: buildRouteSchema({
        tag: BILLING_TAG,
        summary: "Get folio by ID",
        params: schemaFromZod(z.object({ folioId: z.string().uuid() }), "FolioIdParam"),
        querystring: schemaFromZod(
          z.object({ tenant_id: z.string().uuid() }),
          "TenantIdQueryFolio",
        ),
        response: {
          200: FolioDetailJsonSchema,
        },
      }),
    },
    async (request, reply) => {
      const { folioId } = request.params;
      const { tenant_id } = request.query;

      const folio = await getFolioById(folioId, tenant_id);

      if (!folio) {
        reply.notFound("FOLIO_NOT_FOUND");
        return;
      }

      return FolioListItemSchema.parse(folio);
    },
  );

  // ============================================================================
  // CHARGE POSTINGS
  // ============================================================================

  app.get<{ Querystring: ChargePostingListQuery }>(
    "/v1/billing/charges",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as ChargePostingListQuery).tenant_id,
        minRole: "ADMIN",
        requiredModules: "finance-automation",
      }),
      schema: buildRouteSchema({
        tag: BILLING_TAG,
        summary: "List charge postings with optional filters",
        querystring: ChargePostingListQueryJsonSchema,
        response: {
          200: ChargePostingListResponseJsonSchema,
        },
      }),
    },
    async (request) => {
      const {
        tenant_id,
        property_id,
        folio_id,
        reservation_id,
        transaction_type,
        charge_code,
        include_voided,
        limit,
        offset,
      } = ChargePostingListQuerySchema.parse(request.query);

      const charges = await listChargePostings({
        tenantId: tenant_id,
        propertyId: property_id,
        folioId: folio_id,
        reservationId: reservation_id,
        transactionType: transaction_type,
        chargeCode: charge_code,
        includeVoided: include_voided,
        limit,
        offset,
      });

      return ChargePostingListResponseSchema.parse(charges);
    },
  );
  // PRE-AUDIT CHECKLIST
  // ============================================================================

  app.get<{ Querystring: PreAuditQuery }>(
    "/v1/billing/pre-audit-checklist",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as PreAuditQuery).tenant_id,
        minRole: "ADMIN",
        requiredModules: "finance-automation",
      }),
      schema: buildRouteSchema({
        tag: BILLING_TAG,
        summary: "Run pre-audit checklist for a property",
        description:
          "Verify all prerequisites before starting the night audit: cashier sessions, pending arrivals/departures, folio balances, and room statuses",
        querystring: schemaFromZod(PreAuditQuerySchema, "PreAuditQuery"),
        response: { 200: schemaFromZod(PreAuditResponseSchema, "PreAuditResponse") },
      }),
    },
    async (request) => {
      const { tenant_id, property_id } = PreAuditQuerySchema.parse(request.query);
      return getPreAuditChecklist({ tenantId: tenant_id, propertyId: property_id });
    },
  );

  // ============================================================================
  // BUCKET CHECK (OCCUPANCY VERIFICATION)
  // ============================================================================

  app.get<{ Querystring: BucketCheckQuery }>(
    "/v1/billing/bucket-check",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as BucketCheckQuery).tenant_id,
        minRole: "ADMIN",
        requiredModules: "finance-automation",
      }),
      schema: buildRouteSchema({
        tag: BILLING_TAG,
        summary: "Run bucket check (occupancy verification)",
        description:
          "Compare system occupancy against expected room states (stayovers, due-outs, arrivals) for a given business date",
        querystring: schemaFromZod(BucketCheckQuerySchema, "BucketCheckQuery"),
        response: { 200: schemaFromZod(BucketCheckResponseSchema, "BucketCheckResponse") },
      }),
    },
    async (request) => {
      const { tenant_id, property_id, business_date } = BucketCheckQuerySchema.parse(request.query);
      return getBucketCheck({
        tenantId: tenant_id,
        propertyId: property_id,
        businessDate: business_date,
      });
    },
  );

  // ============================================================================
  // CASHIER SESSIONS
  // ============================================================================

  app.get<{ Querystring: CashierSessionListQuery }>(
    "/v1/billing/cashier-sessions",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as CashierSessionListQuery).tenant_id,
        minRole: "STAFF",
        requiredModules: "finance-automation",
      }),
      schema: buildRouteSchema({
        tag: BILLING_TAG,
        summary: "List cashier sessions",
        querystring: schemaFromZod(CashierSessionListQuerySchema, "CashierListQuery"),
        response: { 200: { type: "array", items: { type: "object", additionalProperties: true } } },
      }),
    },
    async (request) => {
      const { tenant_id, property_id, session_status, limit, offset, user_id, shift_type } =
        CashierSessionListQuerySchema.parse(request.query);
      return listCashierSessions({
        tenantId: tenant_id,
        propertyId: property_id,
        sessionStatus: session_status,
        limit,
        offset,
        userId: user_id,
        shiftType: shift_type,
      });
    },
  );

  app.get<{ Params: { sessionId: string }; Querystring: { tenant_id: string } }>(
    "/v1/billing/cashier-sessions/:sessionId",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as { tenant_id: string }).tenant_id,
        minRole: "STAFF",
        requiredModules: "finance-automation",
      }),
      schema: buildRouteSchema({
        tag: BILLING_TAG,
        summary: "Get cashier session by ID",
        params: schemaFromZod(z.object({ sessionId: z.string().uuid() }), "CashierSessionIdParam"),
        querystring: schemaFromZod(
          z.object({ tenant_id: z.string().uuid() }),
          "TenantIdQueryCashier",
        ),
        response: { 200: { type: "object", additionalProperties: true } },
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

      return session;
    },
  );
};
