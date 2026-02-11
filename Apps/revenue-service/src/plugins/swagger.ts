import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import fp from "fastify-plugin";

import { config } from "../config.js";

const swaggerPlugin = fp(async (app) => {
  if (process.env.DISABLE_SWAGGER === "true") {
    app.log.warn("Swagger UI disabled via DISABLE_SWAGGER");
    return;
  }

  await app.register(swagger, {
    openapi: {
      info: {
        title: `${config.service.name} API`,
        description: "Revenue management and dynamic pricing APIs.",
        version: config.service.version ?? "1.0.0",
      },
      servers: [{ url: "/" }],
    },
    mode: "dynamic",
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
