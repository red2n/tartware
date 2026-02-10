import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import fp from "fastify-plugin";

import { config } from "../config.js";

const serviceVersion = process.env.NOTIFICATION_SERVICE_VERSION ?? config.service.version;

const swaggerPlugin = fp(async (app) => {
  if (process.env.DISABLE_SWAGGER === "true") {
    app.log.warn("Swagger UI disabled via DISABLE_SWAGGER");
    return;
  }

  await app.register(swagger as never, {
    openapi: {
      info: {
        title: `${config.service.name} API`,
        version: serviceVersion,
        description:
          "Notification and communication service for Tartware PMS — manages templates, guest communications, push notifications, and automated messaging.",
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
