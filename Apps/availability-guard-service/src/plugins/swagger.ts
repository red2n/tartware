import { createSwaggerPlugin } from "@tartware/fastify-server/swagger";

import { config } from "../config.js";

export default createSwaggerPlugin({
  title: `${config.service.name} API`,
  description: "Availability guard service for Tartware PMS",
  version: process.env.AVAILABILITY_GUARD_SERVICE_VERSION ?? config.service.version,
});
