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
  action: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown>;
}

/**
 * SQL for inserting an audit log.
 */
export const INSERT_AUDIT_LOG_SQL = `
  INSERT INTO public.audit_logs (
    tenant_id, property_id, actor_id, action,
    entity_type, entity_id, metadata,
    created_at
  ) VALUES (
    $1::uuid, $2::uuid, $3::uuid, $4,
    $5, $6, $7::jsonb,
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
  await queryFn(INSERT_AUDIT_LOG_SQL, [
    params.tenantId,
    params.propertyId,
    params.actorId,
    params.action,
    params.entityType,
    params.entityId,
    JSON.stringify(params.metadata),
  ]);
};
