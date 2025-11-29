import fastifyHelmet from "@fastify/helmet";
import fastifySensible from "@fastify/sensible";
import fastify, { type FastifyBaseLogger } from "fastify";

import { serviceConfig } from "./config.js";
import { reservationsLogger } from "./logger.js";
import { registerReservationCommandRoutes } from "./routes/reservation-commands.js";

export const buildServer = () => {
  const app = fastify({
    logger: reservationsLogger as FastifyBaseLogger,
  });

  app.register(fastifyHelmet, { global: true });
  app.register(fastifySensible);

  app.get("/health", async () => ({
    status: "ok",
    service: serviceConfig.serviceId,
  }));

  registerReservationCommandRoutes(app);

  return app;
};
