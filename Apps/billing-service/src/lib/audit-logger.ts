/**
 * Billing Audit Logger
 *
 * Thin, zero-overhead utility for writing PCI-DSS Req 10 / SOC 2 / GDPR-compliant
 * audit trail entries from billing-service command handlers.
 *
 * Design for 20K ops/sec:
 * - PCI-relevant events (payment capture/refund/void): synchronous within the
 *   caller's existing transaction using queryWithClient — no extra round-trip.
 * - All other financial events (charges, invoices, folios, AR write-off):
 *   async fire-and-forget via setImmediate — zero latency on the hot path.
 * - No Zod parsing; no object allocation beyond a single flat params array.
 * - ON CONFLICT DO NOTHING makes every write idempotent.
 */

import { randomUUID } from "node:crypto";

import { hashIdentifier, redactPayload } from "@tartware/config";
import type { BillingAuditEventInput } from "@tartware/schemas";
import type { PoolClient } from "pg";

import { query, queryWithClient } from "./db.js";

// ---------------------------------------------------------------------------
// SQL — single parameterized statement reused across all callers.
// Columns must match audit_logs DDL (scripts/tables/07-analytics/27_audit_logs.sql).
// ---------------------------------------------------------------------------
const INSERT_AUDIT_SQL = `
  INSERT INTO public.audit_logs (
    audit_id,
    tenant_id,
    property_id,
    audit_timestamp,
    event_type,
    entity_type,
    entity_id,
    user_id,
    user_name,
    user_email,
    user_role,
    action,
    action_category,
    severity,
    old_values,
    new_values,
    api_endpoint,
    is_pci_relevant,
    is_gdpr_relevant,
    description,
    metadata,
    status,
    error_code,
    response_time_ms
  ) VALUES (
    $1::uuid,
    $2::uuid,
    $3::uuid,
    NOW(),
    $4,
    $5,
    $6::uuid,
    $7::uuid,
    $8,
    $9,
    $10,
    $11,
    $12,
    $13,
    $14::jsonb,
    $15::jsonb,
    $16,
    $17,
    $18,
    $19,
    $20::jsonb,
    $21,
    $22,
    $23
  )
  ON CONFLICT DO NOTHING
`;

function buildParams(e: BillingAuditEventInput): unknown[] {
  return [
    randomUUID(), // $1  audit_id
    e.tenantId, // $2  tenant_id
    e.propertyId ?? null, // $3  property_id
    `BILLING.${e.action}`, // $4  event_type
    e.entityType, // $5  entity_type
    e.entityId ?? null, // $6  entity_id
    e.userId, // $7  user_id
    e.userName ?? null, // $8  user_name
    e.userEmail ?? null, // $9  user_email
    e.userRole ?? null, // $10 user_role
    e.action, // $11 action
    e.category ?? "FINANCIAL", // $12 action_category
    e.severity ?? "INFO", // $13 severity
    e.oldValues != null ? JSON.stringify(redactPayload(e.oldValues)) : null, // $14 old_values
    e.newValues != null ? JSON.stringify(redactPayload(e.newValues)) : null, // $15 new_values
    e.apiEndpoint ?? null, // $16 api_endpoint
    e.isPciRelevant ?? false, // $17 is_pci_relevant
    e.isGdprRelevant ?? false, // $18 is_gdpr_relevant
    e.description ?? null, // $19 description
    e.metadata != null
      ? JSON.stringify({
          ...(redactPayload(e.metadata) as Record<string, unknown>),
          entity_id_hash: e.entityId ? hashIdentifier(e.entityId) : null,
          correlation_id: e.correlationId ?? null,
        })
      : JSON.stringify({ correlation_id: e.correlationId ?? null }), // $20 metadata
    e.status ?? "SUCCESS", // $21 status
    e.errorCode ?? null, // $22 error_code
    e.responseTimeMs ?? null, // $23 response_time_ms
  ];
}

/**
 * Write an audit entry **synchronously within an existing database transaction**.
 *
 * Use this for PCI-relevant operations (payment capture, refund, void) where
 * the audit record must be atomically committed with the financial transaction.
 * If the transaction rolls back, the audit entry is also rolled back.
 *
 * @param client - Active pg PoolClient with an open transaction.
 * @param event - Audit event details.
 * @param context - Optional command context for automatic user/correlation attribution.
 */
export async function auditWithClient(
  client: PoolClient,
  event: BillingAuditEventInput,
  context?: {
    tenantId: string;
    initiatedBy?: {
      userId?: string;
      userName?: string | null;
      userEmail?: string | null;
      role?: string | null;
    } | null;
    correlationId?: string;
  },
): Promise<void> {
  const fullEvent = context ? await createAuditEvent(context, event) : event;
  await queryWithClient(client, INSERT_AUDIT_SQL, buildParams(fullEvent));
}

/**
 * Write an audit entry **asynchronously** (fire-and-forget).
 *
 * Use this for non-PCI financial operations (charge post, invoice finalize,
 * folio close, AR write-off) where audit failure must not block the response.
 *
 * Failures are logged to stderr but never thrown. This function returns void
 * immediately and the INSERT runs after the current call stack unwinds.
 *
 * @param event - Audit event details.
 * @param context - Optional command context for automatic user/correlation attribution.
 */
export function auditAsync(
  event: BillingAuditEventInput,
  context?: {
    tenantId: string;
    initiatedBy?: {
      userId?: string;
      userName?: string | null;
      userEmail?: string | null;
      role?: string | null;
    } | null;
    correlationId?: string;
  },
): void {
  setImmediate(async () => {
    try {
      const fullEvent = context ? await createAuditEvent(context, event) : event;
      await query(INSERT_AUDIT_SQL, buildParams(fullEvent));
    } catch (err: unknown) {
      // Audit failures must never crash a command. The financial operation
      // has already committed. Log for ops alerting and continue.
      const action = event.action || "unknown";
      const entityId = event.entityId || "?";
      const errMsg = err instanceof Error ? err.message : String(err);
      process.stderr.write(
        `[audit-logger] async write failed action=${action} entity=${entityId} err=${errMsg}\n`,
      );
    }
  });
}

/**
 * Helper to create a complete audit event with user details fetched from DB.
 * Use this in command handlers to ensure all audit fields are populated.
 */
export async function createAuditEvent(
  context: {
    tenantId: string;
    initiatedBy?: {
      userId?: string;
      userName?: string | null;
      userEmail?: string | null;
      role?: string | null;
    } | null;
    correlationId?: string;
  },
  event: Omit<
    BillingAuditEventInput,
    "tenantId" | "userId" | "userName" | "userEmail" | "userRole" | "correlationId"
  >,
): Promise<BillingAuditEventInput> {
  const { getUserDetails, resolveActorId } = await import("../services/billing-commands/common.js");
  const userId = resolveActorId(context.initiatedBy);

  // Optimization: use details from context if available, otherwise fetch from DB
  const hasDetails = context.initiatedBy?.userName && context.initiatedBy?.userEmail;
  const userDetails = hasDetails
    ? {
        name: context.initiatedBy?.userName ?? null,
        email: context.initiatedBy?.userEmail ?? null,
        role: context.initiatedBy?.role ?? null,
      }
    : await getUserDetails(userId);

  return {
    ...event,
    tenantId: context.tenantId,
    userId,
    userName: userDetails.name,
    userEmail: userDetails.email,
    userRole: userDetails.role,
    correlationId: context.correlationId,
  };
}
