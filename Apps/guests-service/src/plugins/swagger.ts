import { createSwaggerPlugin } from "@tartware/fastify-server/swagger";

import { config } from "../config.js";

export default createSwaggerPlugin({
  title: `${config.service.name} API`,
  description: "Guests domain service for Tartware PMS",
  version: process.env.GUESTS_SERVICE_VERSION ?? config.service.version,
});
