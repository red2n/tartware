import {
  type AuthContext,
  createTenantAuthPlugin,
  type TenantScopeDecorator,
} from "@tartware/tenant-auth";

import { extractBearerToken, verifyAccessToken } from "../lib/jwt.js";
import { getUserMemberships, type TenantMembership } from "../services/membership-service.js";

declare module "fastify" {
  interface FastifyRequest {
    auth: AuthContext<TenantMembership>;
  }

  interface FastifyInstance {
    withTenantScope: TenantScopeDecorator<TenantMembership>;
  }
}

const authContextPlugin = createTenantAuthPlugin<TenantMembership>({
  getUserMemberships,
  extractBearerToken,
  verifyAccessToken,
  rolePriority: {
    OWNER: 500,
    ADMIN: 400,
    MANAGER: 300,
    STAFF: 200,
    VIEWER: 100,
  },
});

export default authContextPlugin;
