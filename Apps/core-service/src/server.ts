import fastifyCors from "@fastify/cors";
import fastifyHelmet from "@fastify/helmet";
import fastifySensible from "@fastify/sensible";
import Fastify, { type FastifyInstance } from "fastify";

import { registerGuestRoutes } from "./routes/guests.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerPropertyRoutes } from "./routes/properties.js";
import { registerTenantRoutes } from "./routes/tenants.js";
import { registerUserTenantAssociationRoutes } from "./routes/user-tenant-associations.js";
import { registerUserRoutes } from "./routes/users.js";

export const buildServer = (): FastifyInstance => {
  const app = Fastify({
    logger: true,
  });

  app.register(fastifySensible);
  app.register(fastifyHelmet, { global: true });
  app.register(fastifyCors, { origin: true });

  registerHealthRoutes(app);
  registerTenantRoutes(app);
  registerPropertyRoutes(app);
  registerUserRoutes(app);
  registerGuestRoutes(app);
  registerUserTenantAssociationRoutes(app);

  return app;
};
