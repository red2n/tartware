import fp from "fastify-plugin";

import { config } from "../config.js";
import { startGrpcServer } from "../grpc/server.js";

export default fp((app) => {
  let controller: Awaited<ReturnType<typeof startGrpcServer>> | null = null;

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
      await controller.stop();
    }
  });
});
