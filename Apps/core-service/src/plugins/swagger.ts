import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import fp from "fastify-plugin";

import { config } from "../config.js";

const openApiDocument = {
  info: {
    title: `${config.service.name} API`,
    description:
      "Tartware Core Service endpoints covering tenants, users, reservations, and operational modules.",
    version: config.service.version ?? "1.0.0",
  },
  servers: [{ url: "/" }],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http" as const,
        scheme: "bearer" as const,
        bearerFormat: "JWT",
      },
    },
  },
  security: [{ bearerAuth: [] as string[] }],
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
