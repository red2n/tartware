import { createSwaggerPlugin } from "@tartware/fastify-server/swagger";

import { config } from "../config.js";

export default createSwaggerPlugin({
  title: `${config.service.name} API`,
  description: "Rooms domain service for Tartware PMS",
  version: process.env.ROOMS_SERVICE_VERSION ?? config.service.version,
});
