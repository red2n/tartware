import type { AuthRtdcInput, AuthTdacInput } from "@tartware/schemas";
import { AuthRtdcInputSchema, AuthTdacInputSchema } from "@tartware/schemas";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { calculateAuthRtdc, calculateAuthTdac } from "../engines/authorization.js";
import { observeCalculationDuration, recordCalculation } from "../lib/metrics.js";

export function registerAuthorizationRoutes(app: FastifyInstance) {
  app.post(
    "/v1/calculations/authorization/tdac",
    {
      schema: {
        description: "Calculate Total Deposit Authorization at Checkin (TDAC) (CORE.md §7.1)",
        tags: ["authorization"],
      },
    },
    async (request: FastifyRequest<{ Body: AuthTdacInput }>, reply: FastifyReply) => {
      const parsed = AuthTdacInputSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.badRequest(parsed.error.message);
      }
      const start = performance.now();
      const result = calculateAuthTdac(parsed.data);
      observeCalculationDuration("authorization", "tdac", (performance.now() - start) / 1000);
      recordCalculation("authorization", "tdac", "success");
      return result;
    },
  );

  app.post(
    "/v1/calculations/authorization/rtdc",
    {
      schema: {
        description: "Calculate Room-Tax-Deposit Credit (RTDC) authorization (CORE.md §7.2)",
        tags: ["authorization"],
      },
    },
    async (request: FastifyRequest<{ Body: AuthRtdcInput }>, reply: FastifyReply) => {
      const parsed = AuthRtdcInputSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.badRequest(parsed.error.message);
      }
      const start = performance.now();
      const result = calculateAuthRtdc(parsed.data);
      observeCalculationDuration("authorization", "rtdc", (performance.now() - start) / 1000);
      recordCalculation("authorization", "rtdc", "success");
      return result;
    },
  );
}
