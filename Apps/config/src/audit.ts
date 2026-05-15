import { createHash } from "node:crypto";

/**
 * SHA-256 hashing for sensitive identifiers (tenant_id, reservation_id, guest_id)
 * to allow audit linking without exposing raw UUIDs in plain text.
 */
export const hashIdentifier = (id: string): string => {
  if (!id) return "";
  return createHash("sha256").update(id).digest("hex");
};

/**
 * Redacts sensitive PII fields from a payload object before audit persistence.
 */
export const redactPayload = (payload: unknown): unknown => {
  if (payload instanceof Date || Object.prototype.toString.call(payload) === "[object Date]") {
    return (payload as Date).toISOString();
  }
  if (!payload || typeof payload !== "object") return payload;

  const sensitiveKeys = [
    "guest_name",
    "first_name",
    "last_name",
    "email",
    "phone",
    "guest_email",
    "guest_phone",
    "address",
    "billing_address",
    "credit_card",
    "card_number",
    "cvv",
    "payment_method_details",
    "password",
    "token",
    "secret",
  ];

  const redacted: Record<string, unknown> = Array.isArray(payload)
    ? ([...payload] as unknown as Record<string, unknown>)
    : { ...(payload as Record<string, unknown>) };

  for (const key in redacted) {
    const value = redacted[key];
    if (sensitiveKeys.some((sk) => key.toLowerCase().includes(sk))) {
      redacted[key] = "[REDACTED]";
    } else if (value && typeof value === "object") {
      redacted[key] = redactPayload(value);
    }
  }

  return redacted;
};

/**
 * Shared audit log parameters.
 */
export interface AuditLogParams {
  tenantId: string;
  propertyId: string | null;
  actorId: string | null;
  userName?: string | null;
  userEmail?: string | null;
  userRole?: string | null;
  action: string;
  eventType: string;
  entityType: string;
  entityId: string | null;
  apiEndpoint?: string | null;
  /** Distributed trace ID — links gateway HTTP row to downstream domain event rows. */
  correlationId?: string | null;
  status?: "SUCCESS" | "FAILURE" | "PARTIAL";
  errorCode?: string | null;
  responseTimeMs?: number | null;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
}

/**
 * SQL for inserting an audit log.
 * Explicitly includes all compliance-relevant columns.
 */
export const INSERT_AUDIT_LOG_SQL = `
  INSERT INTO public.audit_logs (
    tenant_id, property_id, user_id, user_name, user_email, user_role, action,
    event_type, entity_type, entity_id, api_endpoint, correlation_id,
    status, error_code, response_time_ms,
    old_values, new_values, metadata,
    request_id, http_method, ip_address, user_agent,
    audit_timestamp
  ) VALUES (
    $1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7,
    $8, $9, $10, $11, $12,
    $13, $14, $15,
    $16::jsonb, $17::jsonb, $18::jsonb,
    $19, $20, $21, $22,
    NOW()
  )
`;

/**
 * Sanitizes property_id to prevent FK violations.
 * If property_id is not a valid UUID (e.g. "system", empty string), it is nullified.
 */
const sanitizePropertyId = (id: string | null | undefined): string | null => {
  if (!id || id === "system") return null;
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id) ? id : null;
};

/**
 * Ensures all Date objects in an object (recursively) are converted to ISO strings
 * to prevent empty objects {} in JSON serialization.
 */
const serializeDates = (obj: unknown, key?: string): unknown => {
  if (obj instanceof Date || Object.prototype.toString.call(obj) === "[object Date]") {
    const date = obj as Date;
    // For specific date fields, use YYYY-MM-DD to match DB expectations and avoid {}
    if (key?.includes("check_in") || key?.includes("check_out") || key?.includes("birth_date")) {
      return date.toISOString().split("T")[0];
    }
    return date.toISOString();
  }
  if (Array.isArray(obj)) return obj.map((v) => serializeDates(v));
  if (obj !== null && typeof obj === "object") {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([k, v]) => [k, serializeDates(v, k)]),
    );
  }
  return obj;
};

/**
 * Helper to record an audit log using a provided query function.
 */
export const recordAuditLog = async (
  queryFn: (sql: string, params: unknown[]) => Promise<unknown>,
  params: AuditLogParams,
): Promise<void> => {
  const NIL_UUID = "00000000-0000-0000-0000-000000000000";
  if (!params.tenantId || params.tenantId === NIL_UUID) {
    return;
  }

  // Derive status and error code from metadata status_code if provided
  const responseStatusCode = params.metadata?.status_code ?? 200;
  const status = params.status ?? (Number(responseStatusCode) >= 400 ? "FAILURE" : "SUCCESS");
  const errorCode =
    params.errorCode ?? (Number(responseStatusCode) >= 400 ? String(responseStatusCode) : null);

  // Sanitize and serialize inputs
  const propertyId = sanitizePropertyId(params.propertyId);
  const metadata = serializeDates(params.metadata) as Record<string, unknown>;
  const oldValues = params.oldValues ? serializeDates(params.oldValues) : null;
  const newValues = params.newValues ? serializeDates(params.newValues) : null;

  await queryFn(INSERT_AUDIT_LOG_SQL, [
    params.tenantId, // $1  tenant_id
    propertyId, // $2  property_id
    params.actorId, // $3  user_id
    params.userName ?? null, // $4  user_name
    params.userEmail ?? null, // $5  user_email
    params.userRole ?? null, // $6  user_role
    params.action, // $7  action
    params.eventType, // $8  event_type
    params.entityType, // $9  entity_type
    params.entityId ?? null, // $10 entity_id
    params.apiEndpoint ?? null, // $11 api_endpoint
    params.correlationId ?? null, // $12 correlation_id
    status, // $13 status
    errorCode, // $14 error_code
    params.responseTimeMs ?? null, // $15 response_time_ms
    oldValues ? JSON.stringify(oldValues) : null, // $16 old_values
    newValues ? JSON.stringify(newValues) : null, // $17 new_values
    JSON.stringify(metadata), // $18 metadata
    // Extract HTTP context from metadata (set by gateway audit-log.ts)
    metadata?.request_id ?? null, // $19 request_id
    metadata?.http_method ?? null, // $20 http_method
    metadata?.ip_address ?? null, // $21 ip_address
    metadata?.user_agent ?? null, // $22 user_agent
  ]);
};
