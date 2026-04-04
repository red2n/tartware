import "@fastify/sensible"; // Expose FastifyReply augmentations (.unauthorized, .forbidden, etc.)
import type { AuthContext, AuthUser, TenantScopeDecorator } from "./auth.js";

declare module "fastify" {
  interface FastifyInstance {
    withTenantScope: TenantScopeDecorator;
    settingsAuthenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }

  interface FastifyRequest {
    auth: AuthContext;
    authUser?: AuthUser;
  }
}
