import type { KpiDashboardInput } from "@tartware/schemas";
import { KpiDashboardInputSchema } from "@tartware/schemas";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { calculateKpiDashboard } from "../engines/revenue.js";
import { observeCalculationDuration, recordCalculation } from "../lib/metrics.js";

export function registerRevenueRoutes(app: FastifyInstance) {
  app.post(
    "/v1/calculations/revenue/kpi-dashboard",
    {
      schema: {
        description:
          "Calculate full KPI dashboard: ADR, RevPAR, TRevPAR, NRevPAR, GOPPAR, occupancy, and competitive indices (CORE.md §4 + STR)",
        tags: ["revenue"],
      },
    },
    async (request: FastifyRequest<{ Body: KpiDashboardInput }>, reply: FastifyReply) => {
      const parsed = KpiDashboardInputSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.badRequest(parsed.error.message);
      }
      const start = performance.now();
      const result = calculateKpiDashboard(parsed.data);
      observeCalculationDuration("revenue", "kpi_dashboard", (performance.now() - start) / 1000);
      recordCalculation("revenue", "kpi_dashboard", "success");
      return result;
    },
  );
}
