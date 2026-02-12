import { createSwaggerPlugin } from "@tartware/fastify-server/swagger";

import { config } from "../config.js";

export default createSwaggerPlugin({
  title: `${config.service.name} API`,
  description: "Command orchestration surface for Tartware (central ingress + routing).",
  version: process.env.COMMAND_CENTER_SERVICE_VERSION ?? config.service.version,
});
