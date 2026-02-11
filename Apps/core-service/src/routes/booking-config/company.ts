import { buildRouteSchema, errorResponseSchema, schemaFromZod } from "@tartware/openapi";
import { CompanyListItemSchema, CompanyTypeEnum, CreditStatusEnum } from "@tartware/schemas";
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { getCompanyById, listCompanies } from "../../services/booking-config/company.js";

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
        return reply.status(404).send({ error: "Company not found" });
      }
      return CompanyListItemSchema.parse(company);
    },
  );
};
