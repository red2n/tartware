import { createSwaggerPlugin } from "@tartware/fastify-server/swagger";

import { config } from "../config.js";

export default createSwaggerPlugin({
  title: `${config.service.name} API`,
  description:
    "Guest self-service for Tartware PMS — mobile check-in, digital registration cards, mobile keys, and direct booking engine.",
  version: process.env.GUEST_EXPERIENCE_SERVICE_VERSION ?? config.service.version,
});
