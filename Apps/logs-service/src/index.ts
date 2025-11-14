import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import sensible from "@fastify/sensible";
import fastify from "fastify";

import { config } from "./config.js";
import logsRoute from "./routes/logs.js";

const app = fastify({
  logger: {
    level: "info",
  },
  ignoreTrailingSlash: true,
});

await app.register(cors, {
  origin: true,
  methods: ["GET", "OPTIONS"],
});

await app.register(helmet, { global: true });
await app.register(sensible);

app.get("/health", async () => ({
  status: "ok",
  service: "@tartware/logs-service",
  timestamp: new Date().toISOString(),
}));

await app.register(logsRoute);

const start = async () => {
  try {
    await app.listen({ port: config.port, host: "0.0.0.0" });
    app.log.info(`Logs service listening on port ${config.port}`);
  } catch (error) {
    app.log.error(error, "Failed to start logs service");
    process.exit(1);
  }
};

void start();
