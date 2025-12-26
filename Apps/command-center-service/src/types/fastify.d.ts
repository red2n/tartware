import type {
  AuthContext,
  TenantScopeDecorator,
} from "@tartware/tenant-auth";

import type { TenantMembership } from "../services/membership-service.js";

declare module "fastify" {
  interface FastifyRequest {
    auth: AuthContext<TenantMembership>;
  }

  interface FastifyInstance {
    withTenantScope: TenantScopeDecorator<TenantMembership>;
  }
}
