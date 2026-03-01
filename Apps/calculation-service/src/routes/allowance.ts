import type {
  AllowanceTrackInput,
  EnhancementItemInput,
  PackageAllocationInput,
} from "@tartware/schemas";
import {
  AllowanceTrackInputSchema,
  EnhancementItemInputSchema,
  PackageAllocationInputSchema,
} from "@tartware/schemas";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import {
  allocatePackageRevenue,
  calculateEnhancementItem,
  trackAllowance,
} from "../engines/allowance.js";
import { observeCalculationDuration, recordCalculation } from "../lib/metrics.js";

export function registerAllowanceRoutes(app: FastifyInstance) {
  app.post(
    "/v1/calculations/allowance/track",
    {
      schema: {
        description: "Track sequential charges against a fixed allowance (CORE.md §9.1)",
        tags: ["allowance"],
      },
    },
    async (request: FastifyRequest<{ Body: AllowanceTrackInput }>, reply: FastifyReply) => {
      const parsed = AllowanceTrackInputSchema.safeParse(request.body);
      if (!parsed.success) return reply.badRequest(parsed.error.message);
      const start = performance.now();
      const result = trackAllowance(parsed.data);
      observeCalculationDuration("allowance", "track", (performance.now() - start) / 1000);
      recordCalculation("allowance", "track", "success");
      return result;
    },
  );

  app.post(
    "/v1/calculations/allowance/enhancement-item",
    {
      schema: {
        description: "Calculate enhancement item totals: price × quantity × dates (CORE.md §9.3)",
        tags: ["allowance"],
      },
    },
    async (request: FastifyRequest<{ Body: EnhancementItemInput }>, reply: FastifyReply) => {
      const parsed = EnhancementItemInputSchema.safeParse(request.body);
      if (!parsed.success) return reply.badRequest(parsed.error.message);
      const start = performance.now();
      const result = calculateEnhancementItem(parsed.data);
      observeCalculationDuration(
        "allowance",
        "enhancement_item",
        (performance.now() - start) / 1000,
      );
      recordCalculation("allowance", "enhancement_item", "success");
      return result;
    },
  );

  app.post(
    "/v1/calculations/allowance/package-allocation",
    {
      schema: {
        description:
          "Allocate package rate across component departments (USALI revenue allocation)",
        tags: ["allowance"],
      },
    },
    async (request: FastifyRequest<{ Body: PackageAllocationInput }>, reply: FastifyReply) => {
      const parsed = PackageAllocationInputSchema.safeParse(request.body);
      if (!parsed.success) return reply.badRequest(parsed.error.message);
      const start = performance.now();
      const result = allocatePackageRevenue(parsed.data);
      observeCalculationDuration(
        "allowance",
        "package_allocation",
        (performance.now() - start) / 1000,
      );
      recordCalculation("allowance", "package_allocation", "success");
      return result;
    },
  );
}
