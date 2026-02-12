import { createSwaggerPlugin } from "@tartware/fastify-server/swagger";

import { config } from "../config.js";

export default createSwaggerPlugin({
  title: `${config.service.name} API`,
  description: "Revenue management and dynamic pricing APIs.",
  version: config.service.version ?? "1.0.0",
});
