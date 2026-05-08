import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import { Kafka } from "kafkajs";

import { config } from "../config.js";
import { BusinessCalendarSettingsService } from "../services/business-calendar-settings-service.js";

declare module "fastify" {
  interface FastifyInstance {
    businessCalendarSettings: BusinessCalendarSettingsService;
  }
}

export default fp(async (app: FastifyInstance) => {
  const service = new BusinessCalendarSettingsService(app.log);

  app.decorate("businessCalendarSettings", service);

  // Startup load
  app.addHook("onReady", async () => {
    await service.loadAllSettings();

    // Start Kafka consumer for hot-reload
    if (config.kafka.brokers.length > 0) {
      const kafka = new Kafka({
        clientId: `${config.kafka.clientId}-settings-consumer`,
        brokers: config.kafka.brokers,
      });

      const consumer = kafka.consumer({
        groupId: `${config.kafka.clientId}-settings-group`,
      });

      await consumer.connect();
      // Assume the topic for settings events
      await consumer.subscribe({
        topic: "platform.settings.events",
        fromBeginning: false,
      });

      await consumer.run({
        eachMessage: async ({ message }) => {
          if (!message.value) return;
          try {
            const event = JSON.parse(message.value.toString());
            // Map event to hot-reload call
            // Expected event: { type: 'settings.value.set', payload: { tenant_id, property_id, code, value } }
            if (event.type === "settings.value.set") {
              const { tenant_id, property_id, code, value } = event.payload;
              await service.handleHotReload(tenant_id, property_id, code, value);
            }
          } catch (err) {
            app.log.error(err, "Failed to process settings hot-reload event");
          }
        },
      });

      app.addHook("onClose", async () => {
        await consumer.disconnect();
      });
    }
  });
});
