import { createSwaggerPlugin } from "@tartware/fastify-server/swagger";

import { config } from "../config.js";

export default createSwaggerPlugin({
  title: `${config.service.name} API`,
  description:
    "Stateless financial calculation engine for Tartware PMS — tax, rate, folio, KPI, split, deposit, commission, yield, and forex calculations",
  version: config.service.version,
});
