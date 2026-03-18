import { createSwaggerPlugin } from "@tartware/fastify-server/swagger";

import { config } from "../config.js";

export default createSwaggerPlugin({
  title: `${config.service.name} API`,
  description: "Accounts receivable and invoicing service for Tartware PMS",
  version: process.env.ACCOUNTS_SERVICE_VERSION ?? config.service.version,
});
