import { createSwaggerPlugin } from "@tartware/fastify-server/swagger";

import { gatewayConfig } from "../config.js";

export default createSwaggerPlugin({
  title: `${gatewayConfig.serviceId} API`,
  description: "Gateway routes for core, reservation, and settings APIs.",
  version: gatewayConfig.version ?? "1.0.0",
});
