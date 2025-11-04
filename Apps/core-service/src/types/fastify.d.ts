import type { AuthContext, TenantScopeDecorator } from "./auth.js";

declare module "fastify" {
  interface FastifyInstance {
    withTenantScope: TenantScopeDecorator;
  }

  interface FastifyRequest {
    auth: AuthContext;
  }
}
