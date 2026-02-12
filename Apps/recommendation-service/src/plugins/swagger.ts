import { createSwaggerPlugin } from "@tartware/fastify-server/swagger";

import { config } from "../config.js";

export default createSwaggerPlugin({
  title: "Recommendation Service API",
  description: "Room recommendation service for Tartware PMS",
  version: config.service.version,
});
