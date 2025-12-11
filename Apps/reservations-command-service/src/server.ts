import fastifyHelmet from "@fastify/helmet";
import fastifySensible from "@fastify/sensible";
import fastify, { type FastifyBaseLogger } from "fastify";

import { serviceConfig } from "./config.js";
import { reservationsLogger } from "./logger.js";
import { registerReadyRoutes } from "./routes/ready.js";
import { registerReliabilityRoutes } from "./routes/reliability.js";
import { registerReservationCommandRoutes } from "./routes/reservation-commands.js";
import {
  recordReliabilityIngress,
  recordReliabilityOutcome,
} from "./services/reliability-metrics.js";

const isTrackedCommandRoute = (
  url: string | undefined,
  method: string | undefined,
): boolean => {
  if (!url || !method) {
    return false;
  }

  if (!["POST", "PATCH"].includes(method.toUpperCase())) {
    return false;
  }

  return (
    url.startsWith("/v1/tenants/") && url.includes("/reservations")
  );
};

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

  app.addHook("onRequest", (request, _reply, done) => {
    if (isTrackedCommandRoute(request.raw.url, request.method)) {
      recordReliabilityIngress();
    }
    done();
  });

  app.addHook("onResponse", (request, reply, done) => {
    if (isTrackedCommandRoute(request.raw.url, request.method)) {
      recordReliabilityOutcome(reply.statusCode);
    }
    done();
  });

  registerReadyRoutes(app);
  registerReliabilityRoutes(app);
  registerReservationCommandRoutes(app);

  return app;
};
