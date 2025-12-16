import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import fp from "fastify-plugin";

import { serviceConfig } from "../config.js";

const serviceVersion =
  process.env.RESERVATION_COMMAND_VERSION ??
  process.env.npm_package_version ??
  "1.0.0";

const openApiDocument = {
  info: {
    title: `${serviceConfig.serviceId} API`,
    description:
      "Reservation command ingestion service for Tartware PMS (lifecycle guard + fallback enforcement).",
    version: serviceVersion,
  },
  servers: [{ url: "/" }],
};

const swaggerPlugin = fp(async (app) => {
  await app.register(swagger, {
    openapi: openApiDocument,
  });

  await app.register(swaggerUi, {
    routePrefix: "/docs",
    uiConfig: {
      docExpansion: "list",
      deepLinking: false,
    },
    staticCSP: true,
  });
});

export default swaggerPlugin;
