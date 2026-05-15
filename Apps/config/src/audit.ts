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
  if (payload instanceof Date) return payload.toISOString();
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
  status?: "SUCCESS" | "FAILURE" | "PARTIAL";
  errorCode?: string | null;
  responseTimeMs?: number | null;
  metadata: Record<string, unknown>;
}

/**
 * SQL for inserting an audit log.
 */
export const INSERT_AUDIT_LOG_SQL = `
  INSERT INTO public.audit_logs (
    tenant_id, property_id, user_id, user_name, user_email, user_role, action,
    event_type, entity_type, entity_id, api_endpoint, status, error_code, 
    response_time_ms, metadata,
    audit_timestamp
  ) VALUES (
    $1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7,
    $8, $9, $10, $11, $12, $13, $14, $15::jsonb,
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
const serializeDates = (obj: unknown): unknown => {
  if (obj instanceof Date) return obj.toISOString();
  if (Array.isArray(obj)) return obj.map(serializeDates);
  if (obj !== null && typeof obj === "object") {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([k, v]) => [k, serializeDates(v)]),
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

  // Sanitize inputs
  const propertyId = sanitizePropertyId(params.propertyId);
  const metadata = serializeDates(params.metadata);

  await queryFn(INSERT_AUDIT_LOG_SQL, [
    params.tenantId,
    propertyId,
    params.actorId,
    params.userName,
    params.userEmail,
    params.userRole,
    params.action,
    params.eventType,
    params.entityType,
    params.entityId,
    params.apiEndpoint,
    status,
    errorCode,
    params.responseTimeMs ?? null,
    JSON.stringify(metadata),
  ]);
};
