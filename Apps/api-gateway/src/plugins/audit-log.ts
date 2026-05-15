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

const getUserDetails = async (
  userId: string,
): Promise<{ name: string | null; email: string | null; role: string | null }> => {
  if (!userId || userId === SYSTEM_UUID) {
    return { name: null, email: null, role: null };
  }

  try {
    const { rows } = await query(
      `SELECT
        CONCAT(first_name, ' ', last_name) as name,
        email,
        (SELECT role FROM user_tenant_associations uta WHERE uta.user_id = u.id AND uta.is_active = true LIMIT 1) as role
       FROM users u
       WHERE u.id = $1::uuid AND u.is_active = true`,
      [userId],
    );

    if (rows.length === 0) {
      return { name: null, email: null, role: null };
    }

    const row = rows[0];
    if (!row) {
      return { name: null, email: null, role: null };
    }
    return {
      name: row.name?.trim() || null,
      email: row.email || null,
      role: row.role || null,
    };
  } catch (error) {
    // Log error but don't fail the audit log
    console.error("Failed to fetch user details for audit log:", error);
    return { name: null, email: null, role: null };
  }
};

const buildAuditMetadata = (
  request: FastifyRequest,
  reply: FastifyReply,
): Record<string, unknown> => {
  const correlationId =
    (request.headers["x-correlation-id"] as string) || request.id?.toString() || null;

  const metadata: Record<string, unknown> = {
    route: request.routeOptions?.url ?? request.url,
    request_path: request.raw.url ?? request.url,
    http_method: request.method,
    status_code: reply.statusCode,
    request_id: request.id?.toString() ?? null,
    user_agent: request.headers["user-agent"] ?? null,
    ip_address: request.ip,
    correlation_id: correlationId,
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
  const actorId = request.auth?.userId ?? SYSTEM_UUID;
  const userDetails = await getUserDetails(actorId);
  const action = `${request.method.toUpperCase()} ${request.routeOptions?.url ?? request.url}`;
  const entityId = findEntityId(request);
  const routePattern = request.routeOptions?.url ?? "api";
  const entityType = routePattern.replace(/\/\*$/, "").replace(/^\/v1\//, "") || "api";
  const apiEndpoint = request.url;

  // Deriving status and error code from HTTP status
  const status = reply.statusCode >= 400 ? "FAILURE" : "SUCCESS";
  const errorCode = reply.statusCode >= 400 ? String(reply.statusCode) : null;
  const responseTimeMs = Math.round(reply.elapsedTime);

  await recordAuditLog(query, {
    tenantId,
    propertyId,
    actorId,
    userName: userDetails.name,
    userEmail: userDetails.email,
    userRole: userDetails.role,
    action,
    eventType: request.method.toUpperCase(),
    entityType,
    entityId,
    apiEndpoint,
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
