import Fastify, { type FastifyInstance } from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyHelmet from '@fastify/helmet';
import fastifySensible from '@fastify/sensible';

import { registerHealthRoutes } from './routes/health.js';
import { registerTenantRoutes } from './routes/tenants.js';

export const buildServer = (): FastifyInstance => {
  const app = Fastify({
    logger: true,
  });

  app.register(fastifySensible);
  app.register(fastifyHelmet, { global: true });
  app.register(fastifyCors, { origin: true });

  registerHealthRoutes(app);
  registerTenantRoutes(app);

  return app;
};
