import fp from "fastify-plugin";

import { config } from "../config.js";
import { buildLifecycleConsumer } from "../services/lifecycle-consumer.js";

export default fp(async (app) => {
  if (!config.kafka.consumerEnabled) {
    app.log.info("Roll lifecycle consumer disabled via config");
    return;
  }

  if (config.kafka.brokers.length === 0) {
    app.log.warn("No Kafka brokers configured; skipping lifecycle consumer");
    return;
  }

  const consumer = buildLifecycleConsumer(app.log);
  await consumer.start();

  app.addHook("onClose", async () => {
    await consumer.stop();
  });
});
