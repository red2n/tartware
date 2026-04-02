import { createSwaggerPlugin } from "@tartware/fastify-server/swagger";

import { config } from "../config.js";

export default createSwaggerPlugin({
  title: `${config.service.name} API`,
  description:
    "Notification and communication service for Tartware PMS — manages templates, guest communications, push notifications, and automated messaging.",
  version: process.env.NOTIFICATION_SERVICE_VERSION ?? config.service.version,
});
