import { createSwaggerPlugin } from "@tartware/fastify-server/swagger";

import { config } from "../config.js";

export default createSwaggerPlugin({
  title: `${config.service.name} API`,
  description:
    "Core platform APIs for tenants, reservations, rooms, billing, and super-admin operations.",
  version: config.service.version ?? "1.0.0",
});
