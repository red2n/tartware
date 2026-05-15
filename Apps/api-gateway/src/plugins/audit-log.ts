import { recordAuditLog, redactPayload } from "@tartware/config";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { query } from "../lib/db.js";

const SYSTEM_UUID = "00000000-0000-0000-0000-000000000000";
const SKIPPED_ROUTE_PREFIXES = ["/health", "/ready", "/metrics", "/docs", "/swagger"];

const isUuid = (value: string): boolean =>
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value);

const findEntityId = (request: FastifyRequest): string | null => {
  const candidates = [request.params, request.query, request.body] as Array<
    Record<string, unknown> | undefined
  >;

  for (const container of candidates) {
    if (!container || typeof container !== "object") continue;
    for (const value of Object.values(container)) {
      if (typeof value === "string" && isUuid(value)) {
        return value;
      }
    }
  }

  return null;
};

const extractTenantId = (request: FastifyRequest): string => {
  const paramTenantId = (request.params as Record<string, unknown> | undefined)?.tenantId;
  const queryTenantId = (request.query as Record<string, unknown> | undefined)?.tenant_id;

  if (typeof paramTenantId === "string" && isUuid(paramTenantId)) {
    return paramTenantId;
  }

  if (typeof queryTenantId === "string" && isUuid(queryTenantId)) {
    return queryTenantId;
  }

  const authTenantId = request.auth?.authorizedTenantIds?.values().next().value;
  if (typeof authTenantId === "string" && isUuid(authTenantId)) {
    return authTenantId;
  }

  return SYSTEM_UUID;
};

const extractPropertyId = (request: FastifyRequest): string | null => {
  const paramPropertyId = (request.params as Record<string, unknown> | undefined)?.propertyId;
  const queryPropertyId = (request.query as Record<string, unknown> | undefined)?.property_id;
  const bodyPropertyId = (request.body as Record<string, unknown> | undefined)?.property_id;

  if (typeof paramPropertyId === "string" && isUuid(paramPropertyId)) {
    return paramPropertyId;
  }

  if (typeof queryPropertyId === "string" && isUuid(queryPropertyId)) {
    return queryPropertyId;
  }

  if (typeof bodyPropertyId === "string" && isUuid(bodyPropertyId)) {
    return bodyPropertyId;
  }

  return null;
};

const shouldSkipRoute = (request: FastifyRequest): boolean => {
  const routePath = request.routeOptions?.url ?? request.url;
  return SKIPPED_ROUTE_PREFIXES.some((prefix) => routePath.startsWith(prefix));
};

/**
 * Resolves the user's role for the request's tenant.
 * Falls back to the highest-privilege role across all memberships if we can't
 * pinpoint a single tenant, or null if the user is unauthenticated.
 */
const resolveUserRole = (request: FastifyRequest, tenantId: string): string | null => {
  if (!request.auth?.isAuthenticated) return null;

  // Prefer role for the specific tenant being accessed
  const membership = request.auth.getMembership?.(tenantId);
  if (membership?.role) return membership.role;

  // Fallback: highest-privilege membership (OWNER > ADMIN > MANAGER > STAFF > VIEWER)
  const ROLE_RANK: Record<string, number> = {
    OWNER: 500, ADMIN: 400, MANAGER: 300, STAFF: 200, VIEWER: 100,
  };
  let best: string | null = null;
  let bestRank = -1;
  for (const m of request.auth.memberships ?? []) {
    const rank = ROLE_RANK[m.role] ?? 0;
    if (rank > bestRank) {
      bestRank = rank;
      best = m.role;
    }
  }
  return best;
};

const buildAuditMetadata = (
  request: FastifyRequest,
  reply: FastifyReply,
): Record<string, unknown> => {
  const metadata: Record<string, unknown> = {
    // route template — useful for categorisation / wildcard matching
    route: request.routeOptions?.url ?? request.url,
    // actual path — useful for full-text search and specific endpoint filtering
    request_path: request.raw.url ?? request.url,
    http_method: request.method,
    status_code: reply.raw.statusCode,
    request_id: request.id?.toString() ?? null,
    user_agent: request.headers["user-agent"] ?? null,
    ip_address: request.ip,
  };

  if (request.query && Object.keys(request.query).length > 0) {
    metadata.query = redactPayload(request.query);
  }

  if (request.method.toUpperCase() !== "GET" && request.body && typeof request.body === "object") {
    metadata.body = redactPayload(request.body);
  }

  return metadata;
};

const writeGatewayAuditLog = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  if (shouldSkipRoute(request)) {
    return;
  }

  const tenantId = extractTenantId(request);
  if (tenantId === SYSTEM_UUID) {
    return;
  }

  const propertyId = extractPropertyId(request);

  // ── User attribution ─────────────────────────────────────────────────────
  // request.auth is populated by the tenant-auth plugin from the JWT payload.
  // No DB lookup needed — userId, userName, userEmail come directly from the token.
  const actorId = request.auth?.userId ?? SYSTEM_UUID;
  const userName = request.auth?.userName ?? null;
  const userEmail = request.auth?.userEmail ?? null;
  const userRole = resolveUserRole(request, tenantId);

  // ── Correlation ID ────────────────────────────────────────────────────────
  // Prefer the client-supplied X-Correlation-Id for distributed tracing.
  // Fall back to the per-request UUID (Fastify X-Request-Id) so the field is
  // NEVER null — domain event audit rows can be joined by this value.
  const correlationId =
    (request.headers["x-correlation-id"] as string) || request.id?.toString() || null;

  // ── Action / entity ───────────────────────────────────────────────────────
  const action = `${request.method.toUpperCase()} ${request.routeOptions?.url ?? request.url}`;
  const entityId = findEntityId(request);
  // entity_type uses the route template (strip wildcard suffix, strip /v1/ prefix)
  const routeTemplate = request.routeOptions?.url ?? "api";
  const entityType = routeTemplate.replace(/\/\*$/, "").replace(/^\/v1\//, "") || "api";

  // ── api_endpoint: use actual request path, NOT the route wildcard template ──
  // This makes `WHERE api_endpoint LIKE '/v1/billing/folios/%'` queries work.
  const apiEndpoint = request.url;

  // ── HTTP status → audit status ────────────────────────────────────────────
  const status = reply.raw.statusCode >= 400 ? "FAILURE" : "SUCCESS";
  const errorCode = reply.raw.statusCode >= 400 ? String(reply.raw.statusCode) : null;
  const responseTimeMs = Math.round(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (typeof (reply as any).getResponseTime === "function" ? (reply as any).getResponseTime() : 0) || 0
  );

  await recordAuditLog(query, {
    tenantId,
    propertyId,
    actorId,
    userName,
    userEmail,
    userRole,
    action,
    eventType: request.method.toUpperCase(),
    entityType,
    entityId,
    apiEndpoint,
    correlationId,
    status,
    errorCode,
    responseTimeMs,
    metadata: buildAuditMetadata(request, reply),
  });
};

export default function auditLogPlugin(app: FastifyInstance): void {
  app.addHook("onResponse", async (request, reply) => {
    try {
      await writeGatewayAuditLog(request, reply);
    } catch (error) {
      request.log.error({ err: error }, "Failed to write API gateway audit log");
    }
  });
}
