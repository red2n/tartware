import { serviceConfig } from "./config.js";
import {
  shutdownReservationConsumer,
  startReservationConsumer,
} from "./kafka/consumer.js";
import { shutdownProducer } from "./kafka/producer.js";
import { buildServer } from "./server.js";
import {
  startCommandRetryWorker,
  stopCommandRetryWorker,
} from "./services/command-retry-worker.js";

const app = buildServer();

const proc = globalThis.process;
let isShuttingDown = false;

const start = async () => {
  try {
    await startReservationConsumer();
    startCommandRetryWorker();
    await app.listen({ port: serviceConfig.port, host: serviceConfig.host });
    app.log.info(
      {
        service: serviceConfig.serviceId,
        port: serviceConfig.port,
        host: serviceConfig.host,
      },
      "reservations command service listening",
    );
  } catch (error) {
    app.log.error(error, "failed to start reservations command service");
    await shutdown();
    proc?.exit(1);
  }
};

const shutdown = async () => {
  if (isShuttingDown) {
    app.log.info("Shutdown already in progress");
    return;
  }
  isShuttingDown = true;
  try {
    await shutdownReservationConsumer();
    await shutdownProducer();
    stopCommandRetryWorker();
    await app.close();
  } catch (error) {
    app.log.error(error, "error during graceful shutdown");
  }
};

if (proc && "on" in proc && typeof proc.on === "function") {
  proc.on("SIGTERM", () => {
    app.log.info("SIGTERM received, shutting down");
    shutdown().finally(() => proc.exit(0));
  });
  proc.on("SIGINT", () => {
    app.log.info("SIGINT received, shutting down");
    shutdown().finally(() => proc.exit(0));
  });
}

start().catch((error) => {
  app.log.error(error, "Unhandled error on startup");
});
