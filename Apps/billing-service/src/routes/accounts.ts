import { buildRouteSchema, schemaFromZod } from "@tartware/openapi";
import {
  AccountsReceivableDetailSchema,
  AccountsReceivableListItemSchema,
  ArAgingSummarySchema,
  InvoiceListItemSchema,
  InvoiceListResponseSchema,
} from "@tartware/schemas";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import {
  getAccountsReceivableById,
  getArAgingSummary,
  getInvoiceById,
  listAccountsReceivable,
  listInvoices,
} from "../services/accounts-service.js";

const ACCOUNTS_TAG = "Accounts";

export const registerAccountsRoutes = (app: FastifyInstance): void => {
  // ============================================================================
  // INVOICES
  // ============================================================================

  const InvoiceListQuerySchema = z.object({
    tenant_id: z.string().uuid(),
    property_id: z.string().uuid().optional(),
    status: z.string().optional(),
    reservation_id: z.string().uuid().optional(),
    guest_id: z.string().uuid().optional(),
    limit: z.coerce.number().int().positive().max(200).default(100),
    offset: z.coerce.number().int().min(0).default(0),
  });

  type InvoiceListQuery = z.infer<typeof InvoiceListQuerySchema>;

  const InvoiceListQueryJsonSchema = schemaFromZod(InvoiceListQuerySchema, "InvoiceListQuery");
  const InvoiceListResponseJsonSchema = schemaFromZod(
    InvoiceListResponseSchema,
    "InvoiceListResponse",
  );

  app.get<{ Querystring: InvoiceListQuery }>(
    "/v1/billing/invoices",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as InvoiceListQuery).tenant_id,
        minRole: "ADMIN",
        requiredModules: "finance-automation",
      }),
      schema: buildRouteSchema({
        tag: ACCOUNTS_TAG,
        summary: "List invoices with optional filters",
        querystring: InvoiceListQueryJsonSchema,
        response: { 200: InvoiceListResponseJsonSchema },
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
      return InvoiceListResponseSchema.parse({
        data: invoices,
        meta: { count: invoices.length },
      });
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
        tag: ACCOUNTS_TAG,
        summary: "Get invoice by ID",
        params: schemaFromZod(z.object({ invoiceId: z.string().uuid() }), "InvoiceIdParam"),
        querystring: schemaFromZod(
          z.object({ tenant_id: z.string().uuid() }),
          "TenantIdQueryInvoice",
        ),
        response: {
          200: schemaFromZod(InvoiceListItemSchema, "InvoiceDetail"),
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

      return invoice;
    },
  );

  // ============================================================================
  // ACCOUNTS RECEIVABLE
  // ============================================================================

  const ArListQuerySchema = z.object({
    tenant_id: z.string().uuid(),
    property_id: z.string().uuid().optional(),
    reservation_id: z.string().uuid().optional(),
    status: z.string().optional(),
    account_type: z.string().optional(),
    aging_bucket: z.string().optional(),
    limit: z.coerce.number().int().positive().max(500).default(100),
    offset: z.coerce.number().int().min(0).default(0),
  });

  type ArListQuery = z.infer<typeof ArListQuerySchema>;

  const ArListResponseSchema = z.array(AccountsReceivableListItemSchema);
  const ArAgingSummaryResponseSchema = z.array(ArAgingSummarySchema);
  const ArListQueryJsonSchema = schemaFromZod(ArListQuerySchema, "ArListQuery");
  const ArListResponseJsonSchema = schemaFromZod(ArListResponseSchema, "ArListResponse");
  const ArAgingSummaryResponseJsonSchema = schemaFromZod(
    ArAgingSummaryResponseSchema,
    "ArAgingSummaryResponse",
  );
  const ArDetailJsonSchema = schemaFromZod(AccountsReceivableDetailSchema, "ArDetail");

  /**
   * DEPRECATED — transaction-level AR over the `accounts_receivable` table.
   *
   * `ar_accounts` is the canonical AR model as of 2026-08-11 (ui-gaps/04-duplicate-ar-surface.md):
   * it carries the account master, credit terms, dunning, disputes and risk scoring, and checkout
   * already resolves city-ledger transfers against it. These three routes stay as a read view so the
   * existing *Accounts → Receivable* screen keeps working; new work belongs on `/v1/billing/ar/*`.
   *
   * Do not add endpoints here, and prefer `GET /v1/billing/ar/aging-report` over the
   * `aging-summary` below — two aging computations over two tables is exactly the divergence the
   * decision was made to end.
   */
  app.get<{ Querystring: ArListQuery }>(
    "/v1/billing/accounts-receivable",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as ArListQuery).tenant_id,
        minRole: "ADMIN",
        requiredModules: "finance-automation",
      }),
      schema: buildRouteSchema({
        tag: ACCOUNTS_TAG,
        summary:
          "List accounts receivable with optional filters (deprecated — see /v1/billing/ar/accounts)",
        querystring: ArListQueryJsonSchema,
        response: { 200: ArListResponseJsonSchema },
      }),
    },
    async (request) => {
      const {
        tenant_id,
        property_id,
        status,
        account_type,
        aging_bucket,
        limit,
        offset,
        reservation_id,
      } = ArListQuerySchema.parse(request.query);
      return listAccountsReceivable({
        tenantId: tenant_id,
        propertyId: property_id,
        status,
        accountType: account_type,
        agingBucket: aging_bucket,
        limit,
        offset,
        reservationId: reservation_id,
      });
    },
  );

  app.get<{ Querystring: { tenant_id: string; property_id?: string } }>(
    "/v1/billing/accounts-receivable/aging-summary",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as { tenant_id: string }).tenant_id,
        minRole: "ADMIN",
        requiredModules: "finance-automation",
      }),
      schema: buildRouteSchema({
        tag: ACCOUNTS_TAG,
        summary: "AR aging summary by property (deprecated — see /v1/billing/ar/aging-report)",
        querystring: schemaFromZod(
          z.object({
            tenant_id: z.string().uuid(),
            property_id: z.string().uuid().optional(),
          }),
          "ArAgingSummaryQuery",
        ),
        response: { 200: ArAgingSummaryResponseJsonSchema },
      }),
    },
    async (request) => {
      const { tenant_id, property_id } = request.query;
      return getArAgingSummary({ tenantId: tenant_id, propertyId: property_id });
    },
  );

  app.get<{
    Params: { arId: string };
    Querystring: { tenant_id: string };
  }>(
    "/v1/billing/accounts-receivable/:arId",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as { tenant_id: string }).tenant_id,
        minRole: "ADMIN",
        requiredModules: "finance-automation",
      }),
      schema: buildRouteSchema({
        tag: ACCOUNTS_TAG,
        summary: "Get AR transaction detail by ID (deprecated — see /v1/billing/ar/accounts)",
        params: schemaFromZod(z.object({ arId: z.string().uuid() }), "ArIdParam"),
        querystring: schemaFromZod(z.object({ tenant_id: z.string().uuid() }), "TenantIdQueryAr"),
        response: { 200: ArDetailJsonSchema },
      }),
    },
    async (request, reply) => {
      const { arId } = request.params;
      const { tenant_id } = request.query;

      const ar = await getAccountsReceivableById({ arId, tenantId: tenant_id });

      if (!ar) {
        reply.notFound("AR_ACCOUNT_NOT_FOUND");
        return;
      }

      return ar;
    },
  );
};
