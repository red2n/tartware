import { type FastifyInstance } from 'fastify';
import { z } from 'zod';

const HealthResponseSchema = z.object({ status: z.literal('ok') });

type HealthResponse = z.infer<typeof HealthResponseSchema>;

export const registerHealthRoutes = (app: FastifyInstance): void => {
  app.get('/health', async () => {
    const payload: HealthResponse = { status: 'ok' };
    return HealthResponseSchema.parse(payload);
  });
};
