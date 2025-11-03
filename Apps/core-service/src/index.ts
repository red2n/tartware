import { buildServer } from './server.js';
import { config } from './config.js';

const app = buildServer();
const proc = (globalThis as { process?: { exit(code?: number): void } }).process;

app
  .listen({ port: config.port, host: config.host })
  .then(() => {
    app.log.info({ port: config.port, host: config.host }, 'core-service listening');
  })
  .catch(async (error: unknown) => {
    app.log.error(error, 'failed to start core-service');
    await app.close();
    proc?.exit(1);
  });
