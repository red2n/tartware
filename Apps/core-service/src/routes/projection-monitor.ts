import type { FastifyInstance } from "fastify";
import { z } from "zod";

import { getProjectionMonitorStats } from "../services/projection-monitor-service.js";

const ProjectionMonitorQuerySchema = z.object({
  tenant_id: z.string().uuid(),
  format: z.enum(["json", "html"]).default("json"),
  limit: z.coerce.number().int().positive().max(100).default(25),
});

const formatLag = (seconds: number): string => {
  if (Number.isNaN(seconds)) {
    return "n/a";
  }
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds.toFixed(0)}s`;
};

const renderHtml = (stats: Awaited<ReturnType<typeof getProjectionMonitorStats>>): string => {
  const rows = stats.topLagging
    .map(
      (row) => `
      <tr>
        <td>${row.id}</td>
        <td>${row.tenant_id}</td>
        <td>${row.property_id}</td>
        <td>${row.status ?? "unknown"}</td>
        <td>${row.last_event_type ?? "n/a"}</td>
        <td>${row.last_event_timestamp ?? "n/a"}</td>
        <td>${row.lag_seconds?.toFixed(1) ?? "0"}</td>
        <td>${row.last_refreshed_at ?? "n/a"}</td>
      </tr>`,
    )
    .join("");

  return `
    <html>
      <head>
        <title>Reservation Projection Monitor</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 2rem; }
          table { border-collapse: collapse; width: 100%; }
          th, td { text-align: left; padding: 8px; border-bottom: 1px solid #ddd; }
          th { background-color: #f2f2f2; }
        </style>
      </head>
      <body>
        <h1>Reservation Projection Monitor</h1>
        <p>Total Rows: ${stats.summary.totalRows}</p>
        <p>Avg Lag: ${formatLag(stats.summary.averageLagSeconds)}</p>
        <p>Max Lag: ${formatLag(stats.summary.maxLagSeconds)}</p>
        <p>Stale &gt;5m: ${stats.summary.staleOver5Minutes} / Stale &gt;15m: ${stats.summary.staleOver15Minutes}</p>
        <table>
          <thead>
            <tr>
              <th>Reservation ID</th>
              <th>Tenant ID</th>
              <th>Property ID</th>
              <th>Status</th>
              <th>Last Event</th>
              <th>Event Timestamp</th>
              <th>Lag (s)</th>
              <th>Last Refreshed</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </body>
    </html>
  `;
};

export const registerProjectionMonitorRoutes = (app: FastifyInstance): void => {
  app.get(
    "/v1/monitoring/reservations/projection",
    {
      preHandler: app.withTenantScope({
        resolveTenantId: (request) =>
          (request.query as z.infer<typeof ProjectionMonitorQuerySchema>).tenant_id,
        minRole: "ADMIN",
        requiredModules: "analytics-bi",
      }),
    },
    async (request, reply) => {
      const { tenant_id, format, limit } = ProjectionMonitorQuerySchema.parse(request.query);
      const stats = await getProjectionMonitorStats(tenant_id, limit);

      if (format === "html") {
        reply.type("text/html; charset=utf-8");
        return renderHtml(stats);
      }

      return stats;
    },
  );
};
