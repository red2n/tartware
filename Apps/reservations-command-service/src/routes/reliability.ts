import type { FastifyInstance } from "fastify";

import {
  type ReliabilitySnapshot,
  getReliabilitySnapshot,
} from "../services/reliability-dashboard-service.js";

const renderSnapshotHtml = (snapshot: ReliabilitySnapshot): string => {
  const rows = [
    ["Incoming", snapshot.incoming],
    ["Outgoing", snapshot.outgoing],
    ["Acknowledged", snapshot.acknowledged],
    ["Failed", snapshot.failed],
    ["Retried", snapshot.retried],
    ["Unauthorized", snapshot.unauthorized],
    ["Unknown", snapshot.unknown],
  ]
    .map(
      ([label, count]) =>
        `<tr><th>${label}</th><td>${count.toLocaleString()}</td></tr>`,
    )
    .join("");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Reservation Command Reliability</title>
    <style>
      body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 2rem; background: #0f172a; color: #f8fafc; }
      h1 { margin-bottom: 0.5rem; }
      table { border-collapse: collapse; width: 360px; background: #1e293b; border-radius: 8px; overflow: hidden; }
      th, td { padding: 0.75rem 1rem; text-align: left; }
      th { background: #334155; width: 55%; }
      tr + tr th { border-top: 1px solid #475569; }
      tr + tr td { border-top: 1px solid #475569; }
      .timestamp { margin-top: 0.5rem; font-size: 0.85rem; color: #cbd5f5; }
    </style>
  </head>
  <body>
    <h1>Reservation Command Reliability</h1>
    <p class="timestamp">Updated: ${snapshot.timestamp}</p>
    <table>${rows}</table>
  </body>
</html>`;
};

export const registerReliabilityRoutes = (app: FastifyInstance): void => {
  app.get("/v1/reliability/status", async () => getReliabilitySnapshot());

  app.get("/reliability/dashboard", async (_request, reply) => {
    const snapshot = await getReliabilitySnapshot();
    reply.type("text/html").send(renderSnapshotHtml(snapshot));
  });
};
