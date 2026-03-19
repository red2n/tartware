import { buildRouteSchema, schemaFromZod } from "@tartware/openapi";
import {
  BucketCheckResponseSchema,
  ChargePostingListItemSchema,
  FolioListItemSchema,
  PaymentMethodEnum,
  PaymentStatusEnum,
  PreAuditResponseSchema,
  TransactionTypeEnum,
  TrialBalanceResponseSchema,
} from "@tartware/schemas";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import {
  BillingPaymentSchema,
  getBucketCheck,
  getCommissionReport,
  getDepartmentalRevenue,
  getFolioById,
  getPreAuditChecklist,
  getTaxSummary,
  getTrialBalance,
  listBillingPayments,
  listChargePostings,
  listFolios,
} from "../services/billing-service.js";

const BillingListQuerySchema = z.object({
  tenant_id: z.string().uuid(),
  property_id: z.string().uuid().optional(),
  status: z
    .string()
    .toLowerCase()
    .optional()
    .refine(
      (value) =>
        !value || PaymentStatusEnum.options.map((status) => status.toLowerCase()).includes(value),
      { message: "Invalid payment status" },
    ),
  transaction_type: z
    .string()
    .toLowerCase()
    .optional()
    .refine(
      (value) =>
        !value ||
        TransactionTypeEnum.options.map((transaction) => transaction.toLowerCase()).includes(value),
      { message: "Invalid transaction type" },
    ),
  payment_method: z
    .string()
    .toLowerCase()
    .optional()
    .refine(
      (value) =>
        !value || PaymentMethodEnum.options.map((method) => method.toLowerCase()).includes(value),
      { message: "Invalid payment method" },
    ),
  limit: z.coerce.number().int().positive().max(200).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

type BillingListQuery = z.infer<typeof BillingListQuerySchema>;

const BillingListResponseSchema = z.array(BillingPaymentSchema);
const BillingListQueryJsonSchema = schemaFromZod(BillingListQuerySchema, "BillingPaymentsQuery");
const BillingListResponseJsonSchema = schemaFromZod(
  BillingListResponseSchema,
  "BillingPaymentsResponse",
);

// Folio schemas
const FolioListQuerySchema = z.object({
  tenant_id: z.string().uuid(),
  property_id: z.string().uuid().optional(),
  folio_status: z.string().optional(),
  folio_type: z.string().optional(),
  reservation_id: z.string().uuid().optional(),
  guest_id: z.string().uuid().optional(),
  limit: z.coerce.number().int().positive().max(200).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

type FolioListQuery = z.infer<typeof FolioListQuerySchema>;

const FolioListResponseSchema = z.array(FolioListItemSchema);
const FolioListQueryJsonSchema = schemaFromZod(FolioListQuerySchema, "FolioListQuery");
const FolioListResponseJsonSchema = schemaFromZod(FolioListResponseSchema, "FolioListResponse");
const FolioDetailJsonSchema = schemaFromZod(FolioListItemSchema, "FolioDetail");

// Charge posting schemas
const ChargePostingListQuerySchema = z.object({
  tenant_id: z.string().uuid(),
  property_id: z.string().uuid().optional(),
  folio_id: z.string().uuid().optional(),
  transaction_type: z.string().optional(),
  charge_code: z.string().optional(),
  include_voided: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().positive().max(200).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

type ChargePostingListQuery = z.infer<typeof ChargePostingListQuerySchema>;

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
  app.get<{ Querystring: BillingListQuery }>(
    "/v1/billing/payments",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as BillingListQuery).tenant_id,
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
      const { tenant_id, property_id, status, transaction_type, payment_method, limit, offset } =
        BillingListQuerySchema.parse(request.query);

      const payments = await listBillingPayments({
        tenantId: tenant_id,
        propertyId: property_id,
        status,
        transactionType: transaction_type,
        paymentMethod: payment_method,
        limit,
        offset,
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
        transactionType: transaction_type,
        chargeCode: charge_code,
        includeVoided: include_voided,
        limit,
        offset,
      });

      return ChargePostingListResponseSchema.parse(charges);
    },
  );

  // ============================================================================
  // TRIAL BALANCE REPORT
  // ============================================================================

  const TrialBalanceQuerySchema = z.object({
    tenant_id: z.string().uuid(),
    property_id: z.string().uuid().optional(),
    business_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  });

  type TrialBalanceQuery = z.infer<typeof TrialBalanceQuerySchema>;

  const TrialBalanceResponseJsonSchema = schemaFromZod(
    TrialBalanceResponseSchema,
    "TrialBalanceResponse",
  );

  const TrialBalanceQueryJsonSchema = schemaFromZod(TrialBalanceQuerySchema, "TrialBalanceQuery");

  app.get<{ Querystring: TrialBalanceQuery }>(
    "/v1/billing/reports/trial-balance",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as TrialBalanceQuery).tenant_id,
        minRole: "ADMIN",
        requiredModules: "finance-automation",
      }),
      schema: buildRouteSchema({
        tag: BILLING_TAG,
        summary: "Trial balance report — debits vs credits verification",
        description:
          "Generates a trial balance showing charge postings grouped by department and charge code, with aggregate totals and variance check",
        querystring: TrialBalanceQueryJsonSchema,
        response: {
          200: TrialBalanceResponseJsonSchema,
        },
      }),
    },
    async (request) => {
      const { tenant_id, property_id, business_date } = TrialBalanceQuerySchema.parse(
        request.query,
      );

      return getTrialBalance({
        tenantId: tenant_id,
        propertyId: property_id,
        businessDate: business_date,
      });
    },
  );

  // ============================================================================
  // DEPARTMENTAL REVENUE REPORT
  // ============================================================================

  const DateRangeQuerySchema = z.object({
    tenant_id: z.string().uuid(),
    property_id: z.string().uuid().optional(),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  });

  type DateRangeQuery = z.infer<typeof DateRangeQuerySchema>;
  const DateRangeQueryJsonSchema = schemaFromZod(DateRangeQuerySchema, "BillingDateRangeQuery");

  app.get<{ Querystring: DateRangeQuery }>(
    "/v1/billing/reports/departmental-revenue",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as DateRangeQuery).tenant_id,
        minRole: "ADMIN",
        requiredModules: "finance-automation",
      }),
      schema: buildRouteSchema({
        tag: BILLING_TAG,
        summary: "Departmental revenue — gross/net revenue breakdown by department",
        querystring: DateRangeQueryJsonSchema,
      }),
    },
    async (request) => {
      const { tenant_id, property_id, start_date, end_date } = DateRangeQuerySchema.parse(
        request.query,
      );
      return getDepartmentalRevenue({
        tenantId: tenant_id,
        propertyId: property_id,
        startDate: start_date,
        endDate: end_date,
      });
    },
  );

  // ============================================================================
  // TAX SUMMARY REPORT
  // ============================================================================

  app.get<{ Querystring: DateRangeQuery }>(
    "/v1/billing/reports/tax-summary",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as DateRangeQuery).tenant_id,
        minRole: "ADMIN",
        requiredModules: "finance-automation",
      }),
      schema: buildRouteSchema({
        tag: BILLING_TAG,
        summary: "Tax summary — taxes collected by type, jurisdiction, and charge code",
        querystring: DateRangeQueryJsonSchema,
      }),
    },
    async (request) => {
      const { tenant_id, property_id, start_date, end_date } = DateRangeQuerySchema.parse(
        request.query,
      );
      return getTaxSummary({
        tenantId: tenant_id,
        propertyId: property_id,
        startDate: start_date,
        endDate: end_date,
      });
    },
  );

  // ============================================================================
  // COMMISSION REPORT
  // ============================================================================

  app.get<{ Querystring: DateRangeQuery }>(
    "/v1/billing/reports/commissions",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as DateRangeQuery).tenant_id,
        minRole: "ADMIN",
        requiredModules: "finance-automation",
      }),
      schema: buildRouteSchema({
        tag: BILLING_TAG,
        summary: "Commission report — OTA/agent commission accruals by source",
        querystring: DateRangeQueryJsonSchema,
      }),
    },
    async (request) => {
      const { tenant_id, property_id, start_date, end_date } = DateRangeQuerySchema.parse(
        request.query,
      );
      return getCommissionReport({
        tenantId: tenant_id,
        propertyId: property_id,
        startDate: start_date,
        endDate: end_date,
      });
    },
  );

  // ============================================================================
  // PRE-AUDIT CHECKLIST
  // ============================================================================

  const PreAuditQuerySchema = z.object({
    tenant_id: z.string().uuid(),
    property_id: z.string().uuid(),
  });

  type PreAuditQuery = z.infer<typeof PreAuditQuerySchema>;

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

  const BucketCheckQuerySchema = z.object({
    tenant_id: z.string().uuid(),
    property_id: z.string().uuid(),
    business_date: z.string().optional(),
  });

  type BucketCheckQuery = z.infer<typeof BucketCheckQuerySchema>;

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
};
