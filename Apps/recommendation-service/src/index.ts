import process from "node:process";

import { config } from "./config.js";
import { closePool, pool } from "./lib/db.js";
import { appLogger } from "./lib/logger.js";
import { buildServer } from "./server.js";
import { initializePipeline } from "./services/index.js";

const app = buildServer();
const proc = process;

/**
 * Check if a TCP service is reachable.
 */
async function checkDependency(name: string, host: string, port: number): Promise<boolean> {
  try {
    // Simple connection test using pg pool
    const result = await pool.query("SELECT 1");
    return result.rowCount === 1;
  } catch (error) {
    appLogger.warn({ error, name, host, port }, `Dependency ${name} not ready`);
    return false;
  }
}

const start = async () => {
  try {
    // Check database connectivity
    const dbOk = await checkDependency("PostgreSQL", config.db.host, config.db.port);
    if (!dbOk) {
      app.log.warn("Database not available; exiting");
      if (proc) {
        proc.exit(0);
      } else {
        return;
      }
    }

    // Initialize the recommendation pipeline
    initializePipeline();

    await app.listen({ port: config.port, host: config.host });
    app.log.info(
      {
        port: config.port,
        host: config.host,
        environment: config.nodeEnv,
      },
      `${config.service.name} started`,
    );
  } catch (error) {
    app.log.error(error, `Failed to start ${config.service.name}`);
    await app.close();
    proc?.exit(1);
  }
};

const shutdown = async (signal: NodeJS.Signals) => {
  app.log.info({ signal }, "shutdown signal received");
  try {
    await closePool();
    await app.close();
    proc?.exit(0);
  } catch (error) {
    app.log.error(error, "error during shutdown");
    proc?.exit(1);
  }
};

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));

await start();
