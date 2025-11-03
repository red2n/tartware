import { type FastifyInstance, type FastifyRequest } from 'fastify';
import { z } from 'zod';
import { TenantWithRelationsSchema } from '@tartware/schemas/core/tenants';

import { listTenants } from '../services/tenant-service.js';

const TenantListQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(50),
});

const TenantListResponseSchema = z.array(
  TenantWithRelationsSchema.extend({
    version: z.string(),
  }),
);

type TenantListQuery = z.infer<typeof TenantListQuerySchema>;

export const registerTenantRoutes = (app: FastifyInstance): void => {
  app.get('/v1/tenants', async (request: FastifyRequest<{ Querystring: TenantListQuery }>) => {
    const { limit } = TenantListQuerySchema.parse(request.query);
    const tenants = await listTenants({ limit });
    const sanitize = (value: unknown): unknown => {
      if (typeof value === 'bigint') {
        return value.toString();
      }

      if (Array.isArray(value)) {
        return value.map(sanitize);
      }

      if (value instanceof Date) {
        return value;
      }

      if (value && typeof value === 'object') {
        return Object.fromEntries(
          Object.entries(value as Record<string, unknown>).map(([key, val]) => [key, sanitize(val)]),
        );
      }

      return value;
    };

    const response = sanitize(tenants);
    return TenantListResponseSchema.parse(response);
  });
};
