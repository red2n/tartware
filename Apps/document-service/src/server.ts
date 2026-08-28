import { readFileSync } from "node:fs";

import { buildFastifyServer, type FastifyInstance } from "@tartware/fastify-server";

import { config } from "./config.js";
import { registerDocumentFont } from "./emitters/pdf.js";
import { appLogger } from "./lib/logger.js";
import { metricsRegistry } from "./lib/metrics.js";
import authContextPlugin from "./plugins/auth-context.js";
import swaggerPlugin from "./plugins/swagger.js";
import { registerDocumentRoutes } from "./routes/documents.js";
import { registerHealthRoutes } from "./routes/health.js";
import { assertTemplateCoverage } from "./templates/index.js";

export const buildServer = (): FastifyInstance => {
  // Fail here rather than on a guest's folio: a template with an untranslated
  // label renders the key itself, which is survivable but visible.
  assertTemplateCoverage();

  // A configured font that cannot be read is a deployment error, not something
  // to fall back from — silently reverting to Helvetica would render a CJK
  // folio as blanks and look like a data problem.
  if (config.render.bodyFontPath) {
    registerDocumentFont("body", readFileSync(config.render.bodyFontPath));
    appLogger.info(
      { path: config.render.bodyFontPath },
      "Registered PDF body font; non-Latin scripts will render",
    );
  }

  const app = buildFastifyServer({
    logger: appLogger,
    enableRequestLogging: config.log.requestLogging,
    corsOrigin: false,
    enableMetricsEndpoint: true,
    metricsRegistry,
    // A folio payload is the whole document; the default 1 MB body limit is too
    // small for a group master with a few thousand postings.
    serverOptions: { bodyLimit: config.render.maxPayloadBytes },
    beforeRoutes: (app) => {
      app.register(authContextPlugin);
      app.register(swaggerPlugin);
    },
    registerRoutes: (app) => {
      registerHealthRoutes(app);
      registerDocumentRoutes(app);
    },
  });

  return app;
};
