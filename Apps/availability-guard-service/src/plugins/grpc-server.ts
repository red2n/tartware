import fp from "fastify-plugin";

import { startGrpcServer } from "../grpc/server.js";

export default fp((app) => {
  let controller: Awaited<ReturnType<typeof startGrpcServer>> | null = null;

  app.addHook("onReady", async () => {
    controller = await startGrpcServer(app.log);
  });

  app.addHook("onClose", async () => {
    await controller?.stop();
  });
});
