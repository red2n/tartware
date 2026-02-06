import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import fp from "fastify-plugin";

import { serviceConfig } from "../config.js";

const serviceVersion =
  process.env.RESERVATIONS_COMMAND_VERSION ?? process.env.npm_package_version ?? "1.0.0";

const openApiDocument = {
  info: {
    title: `${serviceConfig.serviceId} API`,
    description:
      "Reservation command ingestion surface that writes to the transactional outbox and lifecycle guard.",
    version: serviceVersion,
  },
  servers: [{ url: "/" }],
};

const swaggerPlugin = fp(async (app) => {
  if (process.env.DISABLE_SWAGGER === "true") {
    app.log.warn("Swagger UI disabled via DISABLE_SWAGGER");
    return;
  }

  await app.register(swagger as never, {
    openapi: openApiDocument,
    mode: "dynamic",
  });

  await app.register(swaggerUi as never, {
    routePrefix: "/docs",
    uiConfig: {
      docExpansion: "list",
      deepLinking: false,
    },
    staticCSP: true,
  });
});

export default swaggerPlugin;
