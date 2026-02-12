import { createSwaggerPlugin } from "@tartware/fastify-server/swagger";

import { config } from "../config.js";

export default createSwaggerPlugin({
  title: `${config.service.name} API`,
  description: "Billing and payments service for Tartware PMS",
  version: process.env.BILLING_SERVICE_VERSION ?? config.service.version,
});
