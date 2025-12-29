import fp from "fastify-plugin";

import { config } from "../config.js";
import { startGrpcServer } from "../grpc/server.js";

export default fp((app) => {
  let controller: Awaited<ReturnType<typeof startGrpcServer>> | null = null;
  const SHUTDOWN_TIMEOUT_MS = 5_000;

  app.log.info("Starting gRPC server for Availability Guard");
  void startGrpcServer(app.log)
    .then((started) => {
      controller = started;
      app.log.info({ host: config.grpc.host, port: config.grpc.port }, "gRPC server started");
    })
    .catch((err) => {
      app.log.error({ err }, "Failed to start gRPC server");
    });

  app.addHook("onClose", async () => {
    if (controller) {
      const timer = setTimeout(() => {
        app.log.error(
          { timeoutMs: SHUTDOWN_TIMEOUT_MS },
          "gRPC shutdown timed out",
        );
      }, SHUTDOWN_TIMEOUT_MS);
      timer.unref();

      try {
        await controller.stop();
        app.log.info("gRPC server stopped");
      } catch (err) {
        app.log.error({ err }, "Failed to stop gRPC server");
      } finally {
        clearTimeout(timer);
      }
    }
  });
});
