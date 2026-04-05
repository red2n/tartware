/**
 * Settings auth plugin — compatibility adapter.
 *
 * Absorbed from settings-service. Sets `request.authUser` using core-service's
 * JWT verification and DB pool, so the absorbed settings routes work without
 * modification. Decorates `app.settingsAuthenticate` for use as `onRequest`.
 */
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";

import { query } from "../lib/db.js";
import { extractBearerToken, verifyAccessToken } from "../lib/jwt.js";

const isValidUuid = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

const USER_TENANT_MEMBERSHIP_SQL = `
  SELECT
    uta.tenant_id,
    uta.role,
    uta.is_active,
    uta.permissions,
    uta.modules
  FROM public.user_tenant_associations uta
  JOIN public.tenants t ON t.id = uta.tenant_id
  WHERE uta.user_id = $1::uuid
    AND uta.tenant_id = $2::uuid
    AND COALESCE(uta.is_deleted, false) = false
    AND uta.deleted_at IS NULL
    AND COALESCE(t.is_deleted, false) = false
    AND t.deleted_at IS NULL
`;

const AUTH_DISABLED = process.env.DISABLE_AUTH === "true";

export const settingsAuthPlugin = fp(async (app: FastifyInstance) => {
  app.decorate(
    "settingsAuthenticate",
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      if (AUTH_DISABLED) {
        const tenantId = (request.query as Record<string, string>).tenant_id;
        request.authUser = {
          sub: "dev-user",
          tenantId,
          scope: ["settings:read", "settings:write"],
        };
        return;
      }

      const token = extractBearerToken(request.headers.authorization);
      if (!token) {
        return reply.unauthorized("Unauthorized");
      }

      let payload: ReturnType<typeof verifyAccessToken>;
      try {
        payload = verifyAccessToken(token);
      } catch {
        return reply.unauthorized("Unauthorized");
      }

      if (!payload?.sub) {
        return reply.unauthorized("Unauthorized");
      }

      // Guard: sub must be a valid UUID before passing to DB ($1::uuid cast)
      if (!isValidUuid(payload.sub)) {
        return reply.unauthorized("Unauthorized");
      }
      // Resolve tenant ID in priority order:
      //   1. JWT payload field (legacy / future-proofing)
      //   2. Explicit query param (e.g. ?tenant_id=...)
      //   3. First active membership from the authContextPlugin (already verified)
      //
      // The authContextPlugin runs its onRequest hook at the root scope before
      // this child-scope hook, so request.auth.memberships is already populated.
      const rawTenantId =
        (payload.tenantId as string | undefined) ??
        (request.query as Record<string, string>).tenant_id ??
        request.auth?.memberships?.find((m) => m.isActive)?.tenantId ??
        undefined;

      const tenantId = rawTenantId && isValidUuid(rawTenantId) ? rawTenantId : undefined;

      if (!tenantId) {
        // Allow unauthenticated-tenant requests (e.g. catalog reads that don't scope to a tenant)
        request.authUser = {
          sub: payload.sub,
          scope: ["settings:read"],
        };
        return;
      }

      const { rows } = await query<{
        tenant_id: string;
        role: string;
        is_active: boolean;
        permissions: Record<string, unknown> | null;
        modules: string[];
      }>(USER_TENANT_MEMBERSHIP_SQL, [payload.sub, tenantId]);

      const membership = rows[0];
      if (!membership) {
        request.log.warn({ tenantId, userId: payload.sub }, "Tenant membership missing");
        return reply.forbidden("Tenant access denied");
      }
      if (!membership.is_active) {
        request.log.warn({ tenantId, userId: payload.sub }, "Tenant membership inactive");
        return reply.forbidden("Tenant access inactive");
      }

      const scopes: string[] = ["settings:read"];
      if (["OWNER", "ADMIN", "MANAGER"].includes(membership.role)) {
        scopes.push("settings:write");
      }

      request.authUser = {
        sub: payload.sub,
        tenantId,
        scope: scopes,
        permissions: membership.permissions ?? {},
      };
    },
  );
});
