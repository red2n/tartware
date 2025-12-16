import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { buildRouteSchema, schemaFromZod } from "../lib/openapi.js";
import { getPerformanceReport, PerformanceReportSchema } from "../services/report-service.js";

const PerformanceReportQuerySchema = z.object({
  tenant_id: z.string().uuid(),
  property_id: z.string().uuid().optional(),
  start_date: z
    .string()
    .optional()
    .refine((value) => !value || !Number.isNaN(Date.parse(value)), {
      message: "start_date must be a valid ISO date string",
    }),
  end_date: z
    .string()
    .optional()
    .refine((value) => !value || !Number.isNaN(Date.parse(value)), {
      message: "end_date must be a valid ISO date string",
    }),
});

type PerformanceReportQuery = z.infer<typeof PerformanceReportQuerySchema>;
const PerformanceReportQueryJsonSchema = schemaFromZod(
  PerformanceReportQuerySchema,
  "PerformanceReportQuery",
);
const PerformanceReportResponseJsonSchema = schemaFromZod(
  PerformanceReportSchema,
  "PerformanceReportResponse",
);

const REPORTS_TAG = "Reports";

export const registerReportRoutes = (app: FastifyInstance): void => {
  app.get<{ Querystring: PerformanceReportQuery }>(
    "/v1/reports/performance",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) => (request.query as PerformanceReportQuery).tenant_id,
        minRole: "ADMIN",
        requiredModules: "analytics-bi",
      }),
      schema: buildRouteSchema({
        tag: REPORTS_TAG,
        summary: "Generate a performance report",
        querystring: PerformanceReportQueryJsonSchema,
        response: {
          200: PerformanceReportResponseJsonSchema,
        },
      }),
    },
    async (request) => {
      const { tenant_id, property_id, start_date, end_date } = PerformanceReportQuerySchema.parse(
        request.query,
      );

      const report = await getPerformanceReport({
        tenantId: tenant_id,
        propertyId: property_id,
        startDate: start_date,
        endDate: end_date,
      });

      return PerformanceReportSchema.parse(report);
    },
  );
};
