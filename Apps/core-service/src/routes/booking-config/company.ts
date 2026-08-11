import { buildRouteSchema, errorResponseSchema, schemaFromZod } from "@tartware/openapi";
import { CompanyListItemSchema, CompanyTypeEnum, CreditStatusEnum } from "@tartware/schemas";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import {
  createCompany,
  getCompanyById,
  listCompanies,
  updateCompany,
} from "../../services/booking-config/company.js";

// =====================================================
// ROUTE REGISTRATION
// =====================================================

export const registerCompanyRoutes = (app: FastifyInstance): void => {
  const CompanyListQuerySchema = z.object({
    tenant_id: z.string().uuid(),
    company_type: z
      .string()
      .toLowerCase()
      .optional()
      .refine((val) => !val || CompanyTypeEnum.options.map((t) => t.toLowerCase()).includes(val), {
        message: "Invalid company type",
      }),
    is_active: z.coerce.boolean().optional(),
    credit_status: z
      .string()
      .toLowerCase()
      .optional()
      .refine(
        (val) => !val || CreditStatusEnum.options.map((s: string) => s.toLowerCase()).includes(val),
        {
          message: "Invalid credit status",
        },
      ),
    is_blacklisted: z.coerce.boolean().optional(),
    limit: z.coerce.number().int().positive().max(500).default(200),
    offset: z.coerce.number().int().min(0).default(0),
  });

  type CompanyListQuery = z.infer<typeof CompanyListQuerySchema>;

  const CompanyListResponseSchema = z.array(CompanyListItemSchema);
  const CompanyListQueryJsonSchema = schemaFromZod(CompanyListQuerySchema, "CompanyListQuery");
  const CompanyListResponseJsonSchema = schemaFromZod(
    CompanyListResponseSchema,
    "CompanyListResponse",
  );
  const CompanyDetailResponseJsonSchema = schemaFromZod(
    CompanyListItemSchema,
    "CompanyDetailResponse",
  );
  const CompanyParamsSchema = z.object({ companyId: z.string().uuid() });
  const CompanyIdParamJsonSchema = schemaFromZod(CompanyParamsSchema, "CompanyIdParam");

  const COMPANIES_TAG = "Companies";

  app.get<{ Querystring: CompanyListQuery }>(
    "/v1/companies",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as CompanyListQuery).tenant_id,
        minRole: "MANAGER",
        requiredModules: "core",
      }),
      schema: buildRouteSchema({
        tag: COMPANIES_TAG,
        summary: "List companies",
        description: "Retrieve corporate clients, travel agencies, and business partners",
        querystring: CompanyListQueryJsonSchema,
        response: { 200: CompanyListResponseJsonSchema },
      }),
    },
    async (request) => {
      const { tenant_id, company_type, is_active, credit_status, is_blacklisted, limit, offset } =
        CompanyListQuerySchema.parse(request.query);
      const companies = await listCompanies({
        tenantId: tenant_id,
        companyType: company_type,
        isActive: is_active,
        creditStatus: credit_status,
        isBlacklisted: is_blacklisted,
        limit,
        offset,
      });
      return CompanyListResponseSchema.parse(companies);
    },
  );

  app.get<{ Params: z.infer<typeof CompanyParamsSchema>; Querystring: { tenant_id: string } }>(
    "/v1/companies/:companyId",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as { tenant_id: string }).tenant_id,
        minRole: "MANAGER",
        requiredModules: "core",
      }),
      schema: buildRouteSchema({
        tag: COMPANIES_TAG,
        summary: "Get company details",
        description: "Retrieve detailed information about a specific company",
        params: CompanyIdParamJsonSchema,
        querystring: schemaFromZod(
          z.object({ tenant_id: z.string().uuid() }),
          "CompanyDetailQuery",
        ),
        response: { 200: CompanyDetailResponseJsonSchema, 404: errorResponseSchema },
      }),
    },
    async (request, reply) => {
      const { companyId } = CompanyParamsSchema.parse(request.params);
      const { tenant_id } = z.object({ tenant_id: z.string().uuid() }).parse(request.query);
      const company = await getCompanyById({ companyId, tenantId: tenant_id });
      if (!company) {
        return reply.notFound("Company not found");
      }
      return CompanyListItemSchema.parse(company);
    },
  );

  /**
   * Write surface. `/v1/companies` was read-only, which left COV-03's AR account
   * management unusable — `ar.account.create` needs a `company_id` and nothing
   * could create one. See ui-gaps/16-booking-reference-data.md.
   *
   * The enum values here are lowercase because that is what the table's CHECK
   * constraints allow and what the reads return. Note `CompanyTypeEnum` in
   * @tartware/schemas is UPPERCASE and therefore cannot be used for a write
   * against this table — a mismatch worth resolving separately.
   */
  const CompanyWriteBodySchema = z.object({
    tenant_id: z.string().uuid(),
    company_name: z.string().min(1).max(255),
    company_type: z.enum([
      "corporate",
      "travel_agency",
      "wholesaler",
      "ota",
      "event_planner",
      "airline",
      "government",
      "educational",
      "consortium",
      "partner",
    ]),
    legal_name: z.string().max(255).optional(),
    company_code: z.string().max(50).optional(),
    primary_contact_name: z.string().max(255).optional(),
    primary_contact_email: z.string().email().max(255).optional(),
    primary_contact_phone: z.string().max(50).optional(),
    billing_contact_name: z.string().max(255).optional(),
    billing_contact_email: z.string().email().max(255).optional(),
    address_line1: z.string().max(255).optional(),
    city: z.string().max(100).optional(),
    state_province: z.string().max(100).optional(),
    postal_code: z.string().max(20).optional(),
    country: z.string().max(100).optional(),
    credit_limit: z.coerce.number().nonnegative().optional(),
    payment_terms_type: z
      .enum(["due_on_receipt", "net_15", "net_30", "net_45", "net_60", "net_90", "custom"])
      .optional(),
    credit_status: z
      .enum([
        "pending",
        "active",
        "suspended",
        "blocked",
        "under_review",
        "expired",
        "revoked",
        "cancelled",
      ])
      .optional(),
    commission_rate: z.coerce.number().min(0).max(100).optional(),
    commission_type: z
      .enum(["percentage", "flat_rate", "tiered", "net_rate", "none"])
      .optional(),
    is_active: z.boolean().optional(),
  });

  const CompanyUpdateBodySchema = CompanyWriteBodySchema.partial().extend({
    tenant_id: z.string().uuid(),
  });

  const CompanyWriteBodyJsonSchema = schemaFromZod(CompanyWriteBodySchema, "CompanyWriteBody");
  const CompanyUpdateBodyJsonSchema = schemaFromZod(CompanyUpdateBodySchema, "CompanyUpdateBody");

  type CompanyWriteBody = z.infer<typeof CompanyWriteBodySchema>;
  type CompanyUpdateBody = z.infer<typeof CompanyUpdateBodySchema>;

  const toWriteInput = (body: CompanyUpdateBody) => ({
    companyName: body.company_name as string,
    companyType: body.company_type as string,
    legalName: body.legal_name,
    companyCode: body.company_code,
    primaryContactName: body.primary_contact_name,
    primaryContactEmail: body.primary_contact_email,
    primaryContactPhone: body.primary_contact_phone,
    billingContactName: body.billing_contact_name,
    billingContactEmail: body.billing_contact_email,
    addressLine1: body.address_line1,
    city: body.city,
    stateProvince: body.state_province,
    postalCode: body.postal_code,
    country: body.country,
    creditLimit: body.credit_limit,
    paymentTermsType: body.payment_terms_type,
    creditStatus: body.credit_status,
    commissionRate: body.commission_rate,
    commissionType: body.commission_type,
    isActive: body.is_active,
  });

  app.post<{ Body: CompanyWriteBody }>(
    "/v1/companies",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.body as { tenant_id?: string })?.tenant_id,
        minRole: "MANAGER",
        requiredModules: "core",
      }),
      schema: buildRouteSchema({
        tag: COMPANIES_TAG,
        summary: "Create a company (corporate account, travel agency, OTA).",
        body: CompanyWriteBodyJsonSchema,
        response: {
          201: schemaFromZod(CompanyListItemSchema, "CompanyCreated"),
          400: errorResponseSchema,
        },
      }),
    },
    async (request, reply) => {
      const body = CompanyWriteBodySchema.parse(request.body);
      const company = await createCompany(
        body.tenant_id,
        toWriteInput(body),
        (request as { userId?: string }).userId,
      );
      if (!company) {
        return reply.internalServerError("Failed to create company");
      }
      return reply.status(201).send(CompanyListItemSchema.parse(company));
    },
  );

  app.put<{ Params: z.infer<typeof CompanyParamsSchema>; Body: CompanyUpdateBody }>(
    "/v1/companies/:companyId",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.body as { tenant_id?: string })?.tenant_id,
        minRole: "MANAGER",
        requiredModules: "core",
      }),
      schema: buildRouteSchema({
        tag: COMPANIES_TAG,
        summary: "Update a company.",
        params: CompanyIdParamJsonSchema,
        body: CompanyUpdateBodyJsonSchema,
        response: {
          200: schemaFromZod(CompanyListItemSchema, "CompanyUpdated"),
          404: errorResponseSchema,
        },
      }),
    },
    async (request, reply) => {
      const body = CompanyUpdateBodySchema.parse(request.body);
      const company = await updateCompany(
        body.tenant_id,
        request.params.companyId,
        toWriteInput(body),
        (request as { userId?: string }).userId,
      );
      if (!company) {
        return reply.notFound("Company not found");
      }
      return CompanyListItemSchema.parse(company);
    },
  );
};
