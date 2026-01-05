import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";

import { config } from "../config.js";
import { isOutsideComplianceHours } from "../lib/compliance-policies.js";
import { recordOffHoursAccessEvent } from "../lib/metrics.js";

const complianceMonitorPlugin: FastifyPluginAsync = async (fastify) => {
  const { offHoursStartHour, offHoursEndHour } = config.compliance.monitoring;
  const monitorOffHours = offHoursStartHour !== offHoursEndHour;

  if (monitorOffHours) {
    fastify.addHook("preHandler", async (request) => {
      if (!request.auth?.isAuthenticated) {
        return;
      }

      if (isOutsideComplianceHours(new Date(), offHoursStartHour, offHoursEndHour)) {
        const userId = request.auth.userId ?? "unknown";
        const routePath = request.routeOptions?.url ?? request.url;
        recordOffHoursAccessEvent(routePath, userId);
        request.log.warn(
          {
            userId,
            route: routePath,
            offHoursStartHour,
            offHoursEndHour,
          },
          "off-hours tenant data access detected",
        );
      }
    });
  }
};

export default fp(complianceMonitorPlugin, {
  name: "compliance-monitor",
});
