import { enterTenantScope } from "@tartware/config/db";
import type { TenantMembership } from "@tartware/schemas";
import {
  type AuthContext,
  createTenantAuthPlugin,
  type TenantScopeDecorator,
} from "@tartware/tenant-auth";
import type { FastifyRequest } from "fastify";

import { extractBearerToken, verifyAccessToken } from "../lib/jwt.js";
import { getUserMemberships } from "../services/membership-service.js";

declare module "fastify" {
  interface FastifyRequest {
    auth: AuthContext<TenantMembership>;
  }

  interface FastifyInstance {
    withTenantScope: TenantScopeDecorator<TenantMembership>;
  }
}

const ROLE_PRIORITY: Record<string, number> = {
  OWNER: 500,
  ADMIN: 400,
  MANAGER: 300,
  STAFF: 200,
  VIEWER: 100,
};

const authContextPlugin = createTenantAuthPlugin<TenantMembership>({
  getUserMemberships,
  extractBearerToken,
  verifyAccessToken,
  rolePriority: ROLE_PRIORITY,
  onTenantResolved: enterTenantScope,
  shouldBypassAuth: (request: FastifyRequest) => {
    // Health and readiness endpoints should stay unauthenticated for infra probes.
    // Use the registered route pattern (not request.url) to prevent query-string bypass.
    const routePath = request.routeOptions?.url ?? request.url;
    return routePath === "/health" || routePath === "/ready";
  },
});

export default authContextPlugin;
