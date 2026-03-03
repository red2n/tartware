import { createSwaggerPlugin } from "@tartware/fastify-server/swagger";

import { config } from "../config.js";

export default createSwaggerPlugin({
  title: `${config.service.name} API`,
  description:
    "Service registry and discovery dashboard for Tartware PMS microservices — register, heartbeat, and monitor service health",
  version: config.service.version,
});
