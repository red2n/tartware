import fp from "fastify-plugin";

import { config } from "../config.js";
import { buildLifecycleConsumer } from "../services/lifecycle-consumer.js";

/**
 * Registers the roll lifecycle Kafka consumer.
 *
 * Consumer startup is deferred to the `onReady` hook (fire-and-forget) to avoid
 * blocking Fastify plugin registration. KafkaJS connect + subscribe + run can
 * exceed the default 10 s plugin timeout, causing FST_ERR_PLUGIN_TIMEOUT.
 */
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

  app.addHook("onReady", () => {
    void consumer.start().catch((error) => {
      app.log.error(error, "Roll lifecycle consumer failed to start");
    });
  });

  app.addHook("onClose", async () => {
    await consumer.stop();
  });
});
