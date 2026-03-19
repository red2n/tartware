import { createSwaggerPlugin } from "@tartware/fastify-server/swagger";

import { config } from "../config.js";

export default createSwaggerPlugin({
  title: `${config.service.name} API`,
  description: "Cashier session management service for Tartware PMS",
  version: process.env.CASHIER_SERVICE_VERSION ?? config.service.version,
});
