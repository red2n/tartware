import fastifyHelmet from "@fastify/helmet";
import fastifySensible from "@fastify/sensible";
import fastify from "fastify";

import { serviceConfig } from "./config.js";
import { registerReservationCommandRoutes } from "./routes/reservation-commands.js";

export const buildServer = () => {
  const app = fastify({
    logger: {
      transport:
        process.env.NODE_ENV === "production"
          ? undefined
          : {
              target: "pino-pretty",
              options: {
                colorize: true,
              },
            },
    },
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
