import { createSwaggerPlugin } from "@tartware/fastify-server/swagger";

import { config } from "../config.js";

export default createSwaggerPlugin({
  title: `${config.service.name} API`,
  description: "Tax configuration, fiscal periods, reports, commissions, and pricing",
  version: process.env.FINANCE_ADMIN_SERVICE_VERSION ?? config.service.version,
});
