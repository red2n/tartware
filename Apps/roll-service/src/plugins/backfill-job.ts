import fp from "fastify-plugin";

import { config } from "../config.js";
import { buildBackfillJob } from "../jobs/backfill.js";

export default fp(async (app) => {
  if (!config.backfill.enabled) {
    app.log.info("Roll backfill job disabled via config");
    return;
  }

  const job = buildBackfillJob(app.log, {
    batchSize: config.backfill.batchSize,
    intervalMs: config.backfill.intervalMs,
  });

  await job.start();

  app.addHook("onClose", async () => {
    await job.stop();
  });
});
