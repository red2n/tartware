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

  await queryFn(INSERT_AUDIT_LOG_SQL, [
    params.tenantId,
    params.propertyId,
    params.actorId,
    params.userName,
    params.userEmail,
    params.userRole,
    params.action,
    params.eventType,
    params.entityType,
    params.entityId,
    params.apiEndpoint,
    params.status ?? "SUCCESS",
    params.errorCode ?? null,
    params.responseTimeMs ?? null,
    JSON.stringify(params.metadata),
  ]);
};
