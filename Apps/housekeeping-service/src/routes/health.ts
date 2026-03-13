import { createHealthRoutes } from "@tartware/fastify-server";
import type { FastifyInstance } from "fastify";

import { config } from "../config.js";
import { query } from "../lib/db.js";

export const registerHealthRoutes: (app: FastifyInstance) => void = createHealthRoutes({
  serviceName: config.service.name,
  serviceVersion: config.service.version,
  dependencies: [
    {
      name: "database",
      check: async () => {
        await query("SELECT 1");
      },
    },
  ],
});
