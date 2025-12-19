import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import fp from "fastify-plugin";

import { config } from "../config.js";

const serviceVersion =
  process.env.BILLING_SERVICE_VERSION ?? config.service.version;

const swaggerPlugin = fp(async (app) => {
  await app.register(swagger as never, {
    openapi: {
      info: {
        title: `${config.service.name} API`,
        version: serviceVersion,
        description: "Billing and payments service for Tartware PMS",
      },
      servers: [{ url: "/" }],
    },
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
