import type {
  AuthContext,
  TenantScopeDecorator,
} from "../plugins/auth-context.js";

declare module "fastify" {
  interface FastifyRequest {
    auth: AuthContext;
  }

  interface FastifyInstance {
    withTenantScope: TenantScopeDecorator;
  }
}
