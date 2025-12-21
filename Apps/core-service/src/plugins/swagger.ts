import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import fp from "fastify-plugin";

import { config } from "../config.js";

const swaggerPlugin = fp(async (app) => {
  await app.register(swagger, {
    openapi: {
      info: {
        title: `${config.service.name} API`,
        description:
          "Core platform APIs for tenants, reservations, rooms, billing, and super-admin operations.",
        version: config.service.version ?? "1.0.0",
      },
      servers: [{ url: "/" }],
    },
    mode: "dynamic",
  });
  if (process.env.DISABLE_SWAGGER === "true") {
    app.log.warn("Swagger UI disabled via DISABLE_SWAGGER");
    return;
  }

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
