import { createSwaggerPlugin } from "@tartware/fastify-server/swagger";

import { config } from "../config.js";

export default createSwaggerPlugin({
  title: `${config.service.name} API`,
  description: "Document rendering service for Tartware PMS",
  version: process.env.DOCUMENT_SERVICE_VERSION ?? config.service.version,
});
