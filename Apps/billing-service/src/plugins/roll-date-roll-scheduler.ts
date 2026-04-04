import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";

import { config } from "../config.js";
import { buildDateRollScheduler } from "../jobs/roll-date-roll-scheduler.js";

export default fp(async (app: FastifyInstance) => {
  if (!config.roll.dateRollScheduler.enabled) {
    app.log.info("Date roll scheduler disabled via config");
    return;
  }

  if (config.roll.kafka.brokers.length === 0) {
    app.log.warn("No Kafka brokers configured; skipping date roll scheduler");
    return;
  }

  const scheduler = buildDateRollScheduler(app.log, {
    checkIntervalMs: config.roll.dateRollScheduler.checkIntervalMs,
    commandTopic: config.roll.dateRollScheduler.commandTopic,
  });

  app.decorate("dateRollScheduler", scheduler);

  app.addHook("onReady", () => {
    void scheduler.start().catch((error) => {
      app.log.error(error, "Date roll scheduler failed to start");
    });
  });

  app.addHook("onClose", async () => {
    await scheduler.stop();
  });
});
