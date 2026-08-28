import { createHash } from "node:crypto";

/**
 * SHA-256 hashing for sensitive identifiers (tenant_id, reservation_id, guest_id)
 * to allow audit linking without exposing raw UUIDs in plain text.
 */
export const hashIdentifier = (id: string): string => {
  if (!id) return "";
  return createHash("sha256").update(id).digest("hex");
};

/** Matches a canonical UUID, used to keep non-UUID entity ids out of a uuid column. */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
 * Fallback actor used when a command carries no authenticated user.
 * public.audit_logs.user_id is NOT NULL, so a null actor must resolve to the
 * seeded system.actor row rather than reaching the database as null.
 */
export const SYSTEM_ACTOR_ID = "00000000-0000-0000-0000-000000000000";

/**
 * Shared audit log parameters.
 */
export interface AuditLogParams {
  tenantId: string;
  propertyId: string | null;
  actorId: string | null;
  action: string;
  eventType: string;
  entityType: string;
  entityId: string | null;
  metadata: Record<string, unknown>;
}

/**
 * SQL for inserting an audit log.
 */
export const INSERT_AUDIT_LOG_SQL = `
  INSERT INTO public.audit_logs (
    tenant_id, property_id, user_id, action,
    event_type, entity_type, entity_id, metadata,
    audit_timestamp
  ) VALUES (
    $1::uuid, $2::uuid, $3::uuid, $4,
    $5, $6, $7, $8::jsonb,
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
  // audit_logs.entity_id is a UUID column, but callers legitimately pass a
  // hashIdentifier() digest or a composite key (e.g. "<property>:<date>") when
  // the entity has no UUID of its own. Those are carried in metadata as
  // entity_id_hash — the same shape billing-service already writes — so the
  // insert never fails with 22P02 on an unparseable UUID.
  const isUuid = params.entityId != null && UUID_PATTERN.test(params.entityId);
  const entityId = isUuid ? params.entityId : null;
  const metadata =
    params.entityId != null && !isUuid
      ? { ...params.metadata, entity_id_hash: params.entityId }
      : params.metadata;

  await queryFn(INSERT_AUDIT_LOG_SQL, [
    params.tenantId,
    params.propertyId,
    params.actorId ?? SYSTEM_ACTOR_ID,
    params.action,
    params.eventType,
    params.entityType,
    entityId,
    JSON.stringify(metadata),
  ]);
};

/**
 * A gate bypass — an operator overriding a flow precondition.
 *
 * flow_approvals is append-only and exists so every override of a blocking
 * control leaves a trail (who, which gate, why). Night audit already writes
 * here when skip_preconditions is used; any other `force`-style bypass of a
 * financial or operational gate must do the same, otherwise the control is
 * silently skippable.
 */
export interface FlowApprovalParams {
  tenantId: string;
  propertyId: string | null;
  /** Flow the gate belongs to, e.g. "check_in". */
  flowName: string;
  /** Gate being bypassed, e.g. "deposit_required_check". */
  gateName: string;
  entityType: string;
  entityId: string | null;
  approvedBy: string | null;
  /**
   * The role the approver actually held, as a snapshot — which is what the
   * column's own comment promises. Not a description of the override: the
   * command path used to pass literals like "FORCE_OVERRIDE" and "GM_OVERRIDE"
   * here, which read as roles, matched no role the product defines, and left no
   * way to ask what authority a bypass was made under. Use `forced` for that.
   */
  roleAtApproval: string;
  /**
   * Whether the operator bypassed the gate rather than satisfying it.
   *
   * Kept as its own field because most call sites carry it in `reasonCode`
   * (FORCE_CHECK_IN, FORCE_CHECK_OUT) but the two that let the operator choose
   * the reason code — room move and reversals — have nowhere else to put it.
   * Folded into `reasonNotes` behind a stable `FORCED:` prefix so a reader can
   * filter on it without a migration.
   */
  forced?: boolean;
  reasonCode: string;
  reasonNotes?: string | null;
  correlationId?: string | null;
}

/**
 * SQL for recording a gate bypass approval.
 */
export const INSERT_FLOW_APPROVAL_SQL = `
  INSERT INTO public.flow_approvals (
    tenant_id, property_id, flow_name, gate_name,
    entity_type, entity_id, approved_by, role_at_approval,
    reason_code, reason_notes, approved_at, correlation_id
  ) VALUES (
    $1::uuid, $2::uuid, $3, $4,
    $5, $6::uuid, $7::uuid, $8,
    $9, $10, NOW(), $11::uuid
  )
`;

/**
 * Records a gate bypass using a provided query function.
 *
 * Never throws: an override that cannot be logged must not also fail the
 * operation the operator deliberately forced. Callers pass an onError hook to
 * surface the failure in their own logger.
 */
export const recordFlowApproval = async (
  queryFn: (sql: string, params: unknown[]) => Promise<unknown>,
  params: FlowApprovalParams,
  onError?: (error: unknown) => void,
): Promise<void> => {
  try {
    await queryFn(INSERT_FLOW_APPROVAL_SQL, [
      params.tenantId,
      params.propertyId,
      params.flowName,
      params.gateName,
      params.entityType,
      params.entityId,
      params.approvedBy ?? SYSTEM_ACTOR_ID,
      params.roleAtApproval,
      params.reasonCode,
      params.forced
        ? `FORCED: ${params.reasonNotes ?? "gate bypassed"}`
        : (params.reasonNotes ?? null),
      params.correlationId ?? null,
    ]);
  } catch (error) {
    onError?.(error);
  }
};
