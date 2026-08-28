import { createHealthRoutes } from "@tartware/fastify-server";
import type { FastifyInstance } from "fastify";

import { config } from "../config.js";
import { supportedLocales } from "../locales/index.js";
import { listTemplates } from "../templates/index.js";

/**
 * No dependency checks: this service holds no pool, no broker and no cache.
 * Readiness reports what it can actually render instead.
 */
export const registerHealthRoutes: (app: FastifyInstance) => void = createHealthRoutes({
  serviceName: config.service.name,
  serviceVersion: config.service.version,
  dependencies: [],
  readyExtras: {
    documents: {
      templates: listTemplates().map((template) => template.id),
      locales: supportedLocales(),
    },
  },
});
