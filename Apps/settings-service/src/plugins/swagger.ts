import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import fp from "fastify-plugin";

import { config } from "../config.js";

const openApiDocument = {
  info: {
    title: `${config.service.name} API`,
    description: "Settings catalog and amenity management APIs for Tartware PMS.",
    version: config.service.version ?? "1.0.0",
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
