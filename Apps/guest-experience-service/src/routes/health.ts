import type { FastifyInstance } from "fastify";

import { config } from "../config.js";

export const registerHealthRoutes = (app: FastifyInstance): void => {
  app.get("/health", async () => ({
    status: "ok",
    service: config.service.name,
    version: config.service.version,
  }));

  app.get("/ready", async () => ({
    status: "ready",
    service: config.service.name,
    version: config.service.version,
    kafka: {
      activeCluster: config.kafka.activeCluster,
      brokers: config.kafka.brokers,
      primaryBrokers: config.kafka.primaryBrokers,
      failoverBrokers: config.kafka.failoverBrokers,
      topic: config.commandCenter.topic,
    },
  }));
};
