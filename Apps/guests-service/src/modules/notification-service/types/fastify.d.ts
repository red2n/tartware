import type { AuthContext, TenantScopeDecorator } from "@tartware/tenant-auth";

import type { TenantMembership } from "@tartware/tenant-auth/membership";

declare module "fastify" {
  interface FastifyRequest {
    auth: AuthContext<TenantMembership>;
  }

  interface FastifyInstance {
    withTenantScope: TenantScopeDecorator<TenantMembership>;
  }
}
