import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";

import { config } from "../config.js";
import { buildBackfillJob } from "../jobs/roll-backfill.js";

/**
 * Registers the roll backfill periodic job.
 *
 * Job startup is deferred to the `onReady` hook to avoid blocking Fastify
 * plugin registration (the first batch hits the database synchronously).
 */
export default fp(async (app: FastifyInstance) => {
  if (!config.roll.backfill.enabled) {
    app.log.info("Roll backfill job disabled via config");
    return;
  }

  const job = buildBackfillJob(app.log, {
    batchSize: config.roll.backfill.batchSize,
    intervalMs: config.roll.backfill.intervalMs,
  });

  app.addHook("onReady", () => {
    void job.start().catch((error) => {
      app.log.error(error, "Roll backfill job failed to start");
    });
  });

  app.addHook("onClose", async () => {
    await job.stop();
  });
});
