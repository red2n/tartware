import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import type { FastifyInstance } from "fastify";
import fastifyPlugin from "fastify-plugin";

import { config } from "../config.js";

async function swaggerPluginFn(app: FastifyInstance) {
  await app.register(fastifySwagger, {
    openapi: {
      info: {
        title: "Recommendation Service API",
        description: "Room recommendation service for Tartware PMS",
        version: config.service.version,
      },
      servers: [
        {
          url: `http://localhost:${config.port}`,
          description: "Development server",
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
          },
        },
      },
      security: [{ bearerAuth: [] }],
    },
  });

  await app.register(fastifySwaggerUi, {
    routePrefix: "/docs",
    uiConfig: {
      docExpansion: "list",
      deepLinking: false,
    },
  });
}

export default fastifyPlugin(swaggerPluginFn, {
  name: "swagger",
  fastify: "5.x",
});
