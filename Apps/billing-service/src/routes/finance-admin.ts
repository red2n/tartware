import { buildRouteSchema, schemaFromZod } from "@tartware/openapi";
import {
  FiscalPeriodListResponseSchema,
  GlBatchEntriesResponseSchema,
  GlBatchListQuerySchema,
  GlBatchListResponseSchema,
  type LedgerEntryListQuery,
  LedgerEntryListQuerySchema,
  LedgerEntryListResponseSchema,
  TaxConfigurationListItemSchema,
  TaxConfigurationListResponseSchema,
  TaxTypeEnum,
  TrialBalanceResponseSchema,
} from "@tartware/schemas";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import {
  getCommissionReport,
  getDepartmentalRevenue,
  getGlBatchEntries,
  getTaxConfigurationById,
  getTaxSummary,
  getTrialBalance,
  listFiscalPeriods,
  listGlBatches,
  listLedgerEntries,
  listTaxConfigurations,
} from "../services/finance-admin-service.js";

const FINANCE_TAG = "Finance Admin";

export const registerFinanceAdminRoutes = (app: FastifyInstance): void => {
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

  const TaxConfigListQueryJsonSchema = schemaFromZod(
    TaxConfigListQuerySchema,
    "TaxConfigListQuery",
  );
  const TaxConfigListResponseJsonSchema = schemaFromZod(
    TaxConfigurationListResponseSchema,
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
        tag: FINANCE_TAG,
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

      return TaxConfigurationListResponseSchema.parse({
        data: configs,
        meta: { count: configs.length },
      });
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
        tag: FINANCE_TAG,
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

  const FiscalPeriodListQuerySchema = z.object({
    tenant_id: z.string().uuid(),
    property_id: z.string().uuid().optional(),
  });

  type FiscalPeriodListQuery = z.infer<typeof FiscalPeriodListQuerySchema>;

  const FiscalPeriodListQueryJsonSchema = schemaFromZod(
    FiscalPeriodListQuerySchema,
    "FiscalPeriodListQuery",
  );
  const FiscalPeriodListResponseJsonSchema = schemaFromZod(
    FiscalPeriodListResponseSchema,
    "FiscalPeriodListResponse",
  );

  app.get<{ Querystring: FiscalPeriodListQuery }>(
    "/v1/billing/fiscal-periods",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as FiscalPeriodListQuery).tenant_id,
        minRole: "ADMIN",
        requiredModules: "finance-automation",
      }),
      schema: buildRouteSchema({
        tag: FINANCE_TAG,
        summary: "List fiscal periods for a property",
        description: "Retrieve accounting periods and their close status for a property",
        querystring: FiscalPeriodListQueryJsonSchema,
        response: {
          200: FiscalPeriodListResponseJsonSchema,
        },
      }),
    },
    async (request) => {
      const { tenant_id, property_id } = FiscalPeriodListQuerySchema.parse(request.query);
      const periods = await listFiscalPeriods({
        tenantId: tenant_id,
        propertyId: property_id,
      });

      return FiscalPeriodListResponseSchema.parse({
        data: periods,
        meta: { count: periods.length },
      });
    },
  );

  const LedgerEntryListQueryJsonSchema = schemaFromZod(
    LedgerEntryListQuerySchema,
    "LedgerEntryListQuery",
  );
  const LedgerEntryListResponseJsonSchema = schemaFromZod(
    LedgerEntryListResponseSchema,
    "LedgerEntryListResponse",
  );

  app.get<{ Querystring: LedgerEntryListQuery }>(
    "/v1/billing/ledger",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as LedgerEntryListQuery).tenant_id,
        minRole: "ADMIN",
        requiredModules: "finance-automation",
      }),
      schema: buildRouteSchema({
        tag: FINANCE_TAG,
        summary: "List general ledger entries with finance filters",
        description:
          "Retrieve GL entries joined to batches, folios, and reservations for accounting review.",
        querystring: LedgerEntryListQueryJsonSchema,
        response: {
          200: LedgerEntryListResponseJsonSchema,
        },
      }),
    },
    async (request) => {
      const {
        tenant_id,
        property_id,
        status,
        batch_status,
        gl_account_code,
        department_code,
        start_date,
        end_date,
        limit,
        offset,
      } = LedgerEntryListQuerySchema.parse(request.query);

      const entries = await listLedgerEntries({
        tenantId: tenant_id,
        propertyId: property_id,
        status,
        batchStatus: batch_status,
        glAccountCode: gl_account_code,
        departmentCode: department_code,
        startDate: start_date,
        endDate: end_date,
        limit,
        offset,
      });

      return LedgerEntryListResponseSchema.parse({
        data: entries,
        meta: { count: entries.length },
      });
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
        tag: FINANCE_TAG,
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
  const DateRangeQueryJsonSchema = schemaFromZod(DateRangeQuerySchema, "FinanceDateRangeQuery");

  app.get<{ Querystring: DateRangeQuery }>(
    "/v1/billing/reports/departmental-revenue",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as DateRangeQuery).tenant_id,
        minRole: "ADMIN",
        requiredModules: "finance-automation",
      }),
      schema: buildRouteSchema({
        tag: FINANCE_TAG,
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
        tag: FINANCE_TAG,
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
        tag: FINANCE_TAG,
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
  // GL BATCHES (GAP-01: GL Journal Entry Wiring)
  // ============================================================================

  type GlBatchListQueryType = z.infer<typeof GlBatchListQuerySchema>;

  const GlBatchListQueryJsonSchema = schemaFromZod(GlBatchListQuerySchema, "GlBatchListQuery");
  const GlBatchListResponseJsonSchema = schemaFromZod(
    GlBatchListResponseSchema,
    "GlBatchListResponse",
  );

  app.get<{ Querystring: GlBatchListQueryType }>(
    "/v1/billing/gl-batches",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as GlBatchListQueryType).tenant_id,
        minRole: "MANAGER",
        requiredModules: "finance-automation",
      }),
      schema: buildRouteSchema({
        tag: FINANCE_TAG,
        summary: "List general ledger batches with optional date/status filters",
        querystring: GlBatchListQueryJsonSchema,
        response: {
          200: GlBatchListResponseJsonSchema,
        },
      }),
    },
    async (request) => {
      const { tenant_id, property_id, start_date, end_date, batch_status, limit, offset } =
        GlBatchListQuerySchema.parse(request.query);
      const data = await listGlBatches({
        tenantId: tenant_id,
        propertyId: property_id,
        startDate: start_date,
        endDate: end_date,
        batchStatus: batch_status,
        limit,
        offset,
      });
      return GlBatchListResponseSchema.parse({ data, meta: { count: data.length } });
    },
  );

  const GlBatchEntriesQuerySchema = z.object({
    tenant_id: z.string().uuid(),
    limit: z.coerce.number().int().positive().max(5000).default(1000),
    offset: z.coerce.number().int().min(0).default(0),
  });

  type GlBatchEntriesQueryType = z.infer<typeof GlBatchEntriesQuerySchema>;

  const GlBatchEntriesResponseJsonSchema = schemaFromZod(
    GlBatchEntriesResponseSchema,
    "GlBatchEntriesResponse",
  );

  app.get<{ Params: { batchId: string }; Querystring: GlBatchEntriesQueryType }>(
    "/v1/billing/gl-batches/:batchId/entries",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as GlBatchEntriesQueryType).tenant_id,
        minRole: "MANAGER",
        requiredModules: "finance-automation",
      }),
      schema: buildRouteSchema({
        tag: FINANCE_TAG,
        summary: "Get all entries for a specific GL batch",
        response: {
          200: GlBatchEntriesResponseJsonSchema,
        },
      }),
    },
    async (request) => {
      const { tenant_id, limit, offset } = GlBatchEntriesQuerySchema.parse(request.query);
      const { batchId } = request.params;
      return getGlBatchEntries({ tenantId: tenant_id, batchId, limit, offset });
    },
  );
};
