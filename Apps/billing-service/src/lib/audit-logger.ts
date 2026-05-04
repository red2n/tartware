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
    action,
    action_category,
    severity,
    old_values,
    new_values,
    is_pci_relevant,
    is_gdpr_relevant,
    description,
    metadata,
    status
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
    $11::jsonb,
    $12::jsonb,
    $13,
    $14,
    $15,
    $16::jsonb,
    'SUCCESS'
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
    e.action, // $8  action
    e.category ?? "FINANCIAL", // $9  action_category
    e.severity ?? "INFO", // $10 severity
    e.oldValues != null ? JSON.stringify(e.oldValues) : null, // $11 old_values
    e.newValues != null ? JSON.stringify(e.newValues) : null, // $12 new_values
    e.isPciRelevant ?? false, // $13 is_pci_relevant
    e.isGdprRelevant ?? false, // $14 is_gdpr_relevant
    e.description ?? null, // $15 description
    e.metadata != null ? JSON.stringify(e.metadata) : null, // $16 metadata
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
 */
export async function auditWithClient(
  client: PoolClient,
  event: BillingAuditEventInput,
): Promise<void> {
  await queryWithClient(client, INSERT_AUDIT_SQL, buildParams(event));
}

/**
 * Write an audit entry **asynchronously** (fire-and-forget).
 *
 * Use this for non-PCI financial operations (charge post, invoice finalize,
 * folio close, AR write-off) where audit failure must not block the response.
 *
 * Failures are logged to stderr but never thrown. This function returns void
 * immediately and the INSERT runs after the current call stack unwinds.
 */
export function auditAsync(event: BillingAuditEventInput): void {
  setImmediate(() => {
    query(INSERT_AUDIT_SQL, buildParams(event)).catch((err: unknown) => {
      // Audit failures must never crash a command. The financial operation
      // has already committed. Log for ops alerting and continue.
      const errMsg = err instanceof Error ? err.message : String(err);
      process.stderr.write(
        `[audit-logger] async write failed action=${event.action} entity=${event.entityId ?? "?"} err=${errMsg}\n`,
      );
    });
  });
}
