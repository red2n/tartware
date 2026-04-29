import type { FastifyPluginAsync } from "fastify";
import fp from "fastify-plugin";

import { config } from "../config.js";
import { isOutsideComplianceHours } from "../lib/compliance-policies.js";
import { recordOffHoursAccessEvent } from "../lib/metrics.js";

// Suppress duplicate warnings for the same userId within this window.
// Prevents log floods during seed/test runs and night-audit service calls
// while preserving at-least-one alert per window for genuine human sessions.
const OFF_HOURS_WARN_COOLDOWN_MS = Number(process.env.OFF_HOURS_WARN_COOLDOWN_MS) || 5 * 60 * 1000; // 5 minutes

const complianceMonitorPlugin: FastifyPluginAsync = async (fastify) => {
  const { offHoursStartHour, offHoursEndHour } = config.compliance.monitoring;
  const monitorOffHours = offHoursStartHour !== offHoursEndHour;

  if (monitorOffHours) {
    const lastWarnedAt = new Map<string, number>();

    fastify.addHook("preHandler", async (request) => {
      if (!request.auth?.isAuthenticated) {
        return;
      }

      if (isOutsideComplianceHours(new Date(), offHoursStartHour, offHoursEndHour)) {
        const userId = request.auth.userId ?? "unknown";
        const routePath = request.routeOptions?.url ?? request.url;
        recordOffHoursAccessEvent(routePath, userId);

        const now = Date.now();
        const lastWarn = lastWarnedAt.get(userId) ?? 0;
        if (now - lastWarn >= OFF_HOURS_WARN_COOLDOWN_MS) {
          lastWarnedAt.set(userId, now);
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
      }
    });
  }
};

export default fp(complianceMonitorPlugin, {
  name: "compliance-monitor",
});
