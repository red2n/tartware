import { buildRouteSchema, schemaFromZod } from "@tartware/openapi";
import {
  CashierSessionListItemSchema,
  ChargePostingListItemSchema,
  FolioListItemSchema,
  InvoiceListItemSchema,
  InvoiceStatusEnum,
  PaymentMethodEnum,
  PaymentStatusEnum,
  TaxConfigurationListItemSchema,
  TaxTypeEnum,
  TransactionTypeEnum,
  TrialBalanceResponseSchema,
} from "@tartware/schemas";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import {
  BillingPaymentSchema,
  getCashierSessionById,
  getCommissionReport,
  getDepartmentalRevenue,
  getFolioById,
  getInvoiceById,
  getTaxConfigurationById,
  getTaxSummary,
  getTrialBalance,
  listBillingPayments,
  listCashierSessions,
  listChargePostings,
  listFolios,
  listInvoices,
  listTaxConfigurations,
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

// Invoice schemas
const InvoiceListQuerySchema = z.object({
  tenant_id: z.string().uuid(),
  property_id: z.string().uuid().optional(),
  status: z
    .string()
    .toLowerCase()
    .optional()
    .refine(
      (value) => !value || InvoiceStatusEnum.options.map((s) => s.toLowerCase()).includes(value),
      { message: "Invalid invoice status" },
    ),
  reservation_id: z.string().uuid().optional(),
  guest_id: z.string().uuid().optional(),
  limit: z.coerce.number().int().positive().max(200).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

type InvoiceListQuery = z.infer<typeof InvoiceListQuerySchema>;

const InvoiceListResponseSchema = z.array(InvoiceListItemSchema);
const InvoiceListQueryJsonSchema = schemaFromZod(InvoiceListQuerySchema, "InvoiceListQuery");
const InvoiceListResponseJsonSchema = schemaFromZod(
  InvoiceListResponseSchema,
  "InvoiceListResponse",
);
const InvoiceDetailJsonSchema = schemaFromZod(InvoiceListItemSchema, "InvoiceDetail");

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
  // INVOICES
  // ============================================================================

  app.get<{ Querystring: InvoiceListQuery }>(
    "/v1/billing/invoices",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as InvoiceListQuery).tenant_id,
        minRole: "ADMIN",
        requiredModules: "finance-automation",
      }),
      schema: buildRouteSchema({
        tag: BILLING_TAG,
        summary: "List invoices with optional filters",
        querystring: InvoiceListQueryJsonSchema,
        response: {
          200: InvoiceListResponseJsonSchema,
        },
      }),
    },
    async (request) => {
      const { tenant_id, property_id, status, reservation_id, guest_id, limit, offset } =
        InvoiceListQuerySchema.parse(request.query);

      const invoices = await listInvoices({
        tenantId: tenant_id,
        propertyId: property_id,
        status,
        reservationId: reservation_id,
        guestId: guest_id,
        limit,
        offset,
      });

      return InvoiceListResponseSchema.parse(invoices);
    },
  );

  app.get<{
    Params: { invoiceId: string };
    Querystring: { tenant_id: string };
  }>(
    "/v1/billing/invoices/:invoiceId",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as { tenant_id: string }).tenant_id,
        minRole: "ADMIN",
        requiredModules: "finance-automation",
      }),
      schema: buildRouteSchema({
        tag: BILLING_TAG,
        summary: "Get invoice by ID",
        params: schemaFromZod(z.object({ invoiceId: z.string().uuid() }), "InvoiceIdParam"),
        querystring: schemaFromZod(z.object({ tenant_id: z.string().uuid() }), "TenantIdQuery"),
        response: {
          200: InvoiceDetailJsonSchema,
        },
      }),
    },
    async (request, reply) => {
      const { invoiceId } = request.params;
      const { tenant_id } = request.query;

      const invoice = await getInvoiceById(invoiceId, tenant_id);

      if (!invoice) {
        reply.notFound("INVOICE_NOT_FOUND");
        return;
      }

      return InvoiceListItemSchema.parse(invoice);
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

  const CashierSessionListResponseSchema = z.array(CashierSessionListItemSchema);
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
        tag: BILLING_TAG,
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

      return CashierSessionListResponseSchema.parse(sessions);
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
        tag: BILLING_TAG,
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
  // TAX CONFIGURATIONS
  // ============================================================================

  const TaxConfigListQuerySchema = z.object({
    tenant_id: z.string().uuid(),
    property_id: z.string().uuid().optional(),
    tax_type: z
      .string()
      .toLowerCase()
      .optional()
      .refine(
        (value) => !value || TaxTypeEnum.options.map((t) => t.toLowerCase()).includes(value),
        { message: "Invalid tax type" },
      ),
    is_active: z.coerce.boolean().optional(),
    country_code: z.string().max(3).optional(),
    jurisdiction_level: z.string().optional(),
    limit: z.coerce.number().int().positive().max(500).default(200),
    offset: z.coerce.number().int().min(0).default(0),
  });

  type TaxConfigListQuery = z.infer<typeof TaxConfigListQuerySchema>;

  const TaxConfigListResponseSchema = z.array(TaxConfigurationListItemSchema);
  const TaxConfigListQueryJsonSchema = schemaFromZod(
    TaxConfigListQuerySchema,
    "TaxConfigListQuery",
  );
  const TaxConfigListResponseJsonSchema = schemaFromZod(
    TaxConfigListResponseSchema,
    "TaxConfigListResponse",
  );
  const TaxConfigDetailJsonSchema = schemaFromZod(
    TaxConfigurationListItemSchema,
    "TaxConfigDetail",
  );

  app.get<{ Querystring: TaxConfigListQuery }>(
    "/v1/billing/tax-configurations",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as TaxConfigListQuery).tenant_id,
        minRole: "ADMIN",
        requiredModules: "finance-automation",
      }),
      schema: buildRouteSchema({
        tag: BILLING_TAG,
        summary: "List tax configurations with optional filters",
        description:
          "Retrieve tax rules, rates, and configurations by jurisdiction, type, and status",
        querystring: TaxConfigListQueryJsonSchema,
        response: {
          200: TaxConfigListResponseJsonSchema,
        },
      }),
    },
    async (request) => {
      const {
        tenant_id,
        property_id,
        tax_type,
        is_active,
        country_code,
        jurisdiction_level,
        limit,
        offset,
      } = TaxConfigListQuerySchema.parse(request.query);

      const configs = await listTaxConfigurations({
        tenantId: tenant_id,
        propertyId: property_id,
        taxType: tax_type,
        isActive: is_active,
        countryCode: country_code,
        jurisdictionLevel: jurisdiction_level,
        limit,
        offset,
      });

      return TaxConfigListResponseSchema.parse(configs);
    },
  );

  app.get<{
    Params: { taxConfigId: string };
    Querystring: { tenant_id: string };
  }>(
    "/v1/billing/tax-configurations/:taxConfigId",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as { tenant_id: string }).tenant_id,
        minRole: "ADMIN",
        requiredModules: "finance-automation",
      }),
      schema: buildRouteSchema({
        tag: BILLING_TAG,
        summary: "Get tax configuration by ID",
        description: "Retrieve detailed information about a specific tax configuration",
        params: schemaFromZod(z.object({ taxConfigId: z.string().uuid() }), "TaxConfigIdParam"),
        querystring: schemaFromZod(z.object({ tenant_id: z.string().uuid() }), "TenantIdQueryTax"),
        response: {
          200: TaxConfigDetailJsonSchema,
        },
      }),
    },
    async (request, reply) => {
      const { taxConfigId } = request.params;
      const { tenant_id } = request.query;

      const config = await getTaxConfigurationById({
        taxConfigId,
        tenantId: tenant_id,
      });

      if (!config) {
        reply.notFound("TAX_CONFIGURATION_NOT_FOUND");
        return;
      }

      return TaxConfigurationListItemSchema.parse(config);
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
};
