import { bootstrapService } from "@tartware/fastify-server";

import { config } from "./config.js";
import { buildServer } from "./server.js";

const app = buildServer();

// No `db` and no `kafka`: this service renders what it is handed and depends on
// neither, so it must not wait on either to come up.
await bootstrapService({ app, config });
