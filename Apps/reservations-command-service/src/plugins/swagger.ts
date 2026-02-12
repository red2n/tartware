import { createSwaggerPlugin } from "@tartware/fastify-server/swagger";

import { serviceConfig } from "../config.js";

export default createSwaggerPlugin({
  title: `${serviceConfig.serviceId} API`,
  description:
    "Reservation command ingestion surface that writes to the transactional outbox and lifecycle guard.",
  version:
    process.env.RESERVATIONS_COMMAND_VERSION ?? process.env.npm_package_version ?? "1.0.0",
});
