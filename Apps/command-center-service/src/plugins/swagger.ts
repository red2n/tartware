import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import fp from "fastify-plugin";

import { config } from "../config.js";

const serviceVersion =
  process.env.COMMAND_CENTER_SERVICE_VERSION ?? config.service.version;

const swaggerPlugin = fp(async (app) => {
  await app.register(swagger as never, {
    openapi: {
      info: {
        title: `${config.service.name} API`,
        version: serviceVersion,
        description:
          "Command orchestration surface for Tartware (central ingress + routing).",
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
