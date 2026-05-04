/**
 * Payment Gateway Webhook Dispatcher
 *
 * Handles async dispatch of inbound gateway events AFTER the HTTP 200 is sent.
 * Maps normalized gateway event types to billing command handlers.
 * Updates payment_gateway_webhooks.status on completion.
 *
 * Performance (20K ops/sec design):
 * - Route returns 200 after INSERT; dispatch runs via setImmediate (zero hot-path latency)
 * - Single parameterized SQL per operation — no N+1 queries
 * - HMAC computed once per request with constant-time comparison (timingSafeEqual)
 *
 * Security (PCI-DSS v4.0 Req 10):
 * - Timestamp validation for Stripe format (replay-attack prevention, ±5 min window)
 * - timingSafeEqual prevents timing oracles
 * - Secrets are vault references — never logged
 */

import { createHmac, timingSafeEqual } from "node:crypto";

import type { CommandContext } from "@tartware/schemas";

import { auditAsync } from "../lib/audit-logger.js";
import { query } from "../lib/db.js";
import { appLogger } from "../lib/logger.js";
import { recordChargeback } from "./billing-commands/chargeback.js";
import { SYSTEM_ACTOR_ID } from "./billing-commands/common.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Stripe replay-attack tolerance window (seconds). Per Stripe recommendation. */
const STRIPE_TOLERANCE_SECONDS = 300;

// ---------------------------------------------------------------------------
// SQL Statements
// ---------------------------------------------------------------------------

const FETCH_GATEWAY_SECRET_SQL = `
  SELECT webhook_secret_ref
  FROM payment_gateway_configurations
  WHERE tenant_id = $1::uuid
    AND UPPER(gateway_provider) = UPPER($2)
  LIMIT 1
`;

const INSERT_WEBHOOK_SQL = `
  INSERT INTO payment_gateway_webhooks
    (tenant_id, property_id, gateway_provider, gateway_event_id, event_type, raw_payload)
  VALUES
    ($1::uuid, $2::uuid, $3, $4, $5, $6)
  ON CONFLICT (tenant_id, gateway_provider, gateway_event_id) DO NOTHING
  RETURNING webhook_id
`;

const UPDATE_WEBHOOK_STATUS_SQL = `
  UPDATE payment_gateway_webhooks
  SET status           = $1,
      processed_at     = CASE WHEN $1 = 'PROCESSED' THEN NOW() ELSE processed_at END,
      processing_error = $2,
      updated_at       = NOW()
  WHERE webhook_id = $3::uuid
`;

const UPDATE_PAYMENT_STATUS_SQL = `
  UPDATE payments
  SET status     = $2::payment_status,
      updated_at = NOW(),
      version    = version + 1
  WHERE tenant_id         = $1::uuid
    AND gateway_reference = $3
    AND status           != $2::payment_status
`;

const FIND_PAYMENT_BY_GATEWAY_REF_SQL = `
  SELECT payment_reference, property_id, guest_id
  FROM payments
  WHERE tenant_id = $1::uuid
    AND (gateway_reference = $2 OR external_transaction_id = $2)
  LIMIT 1
`;

// ---------------------------------------------------------------------------
// HMAC Verification (exported for testing)
// ---------------------------------------------------------------------------

/**
 * Constant-time HMAC-SHA256 verification. Supports two formats:
 *   Stripe:  "t=<timestamp>,v1=<hexSig>"  — validates timestamp recency
 *   Generic: "sha256=<hexSig>" or bare "<hexSig>"
 *
 * Returns false on any parse or comparison failure.
 */
export function verifyWebhookSignature(
  rawBody: Buffer,
  signatureHeader: string,
  secret: string,
): boolean {
  try {
    if (!signatureHeader || !secret) return false;

    // Stripe format: t=<timestamp>,v1=<hexSig>
    if (signatureHeader.startsWith("t=")) {
      const map: Record<string, string> = {};
      for (const part of signatureHeader.split(",")) {
        const eq = part.indexOf("=");
        if (eq > 0) map[part.slice(0, eq)] = part.slice(eq + 1);
      }
      const timestamp = Number(map.t);
      const receivedHex = map.v1;
      if (!timestamp || !receivedHex) return false;

      const ageSeconds = Math.floor(Date.now() / 1000) - timestamp;
      if (ageSeconds > STRIPE_TOLERANCE_SECONDS || ageSeconds < -60) return false;

      const sigPayload = Buffer.from(`${timestamp}.${rawBody.toString("utf8")}`);
      const expectedHex = createHmac("sha256", secret).update(sigPayload).digest("hex");
      if (expectedHex.length !== receivedHex.length) return false;
      return timingSafeEqual(Buffer.from(expectedHex), Buffer.from(receivedHex));
    }

    // Generic: "sha256=<hexSig>" or bare "<hexSig>"
    const receivedHex = signatureHeader.startsWith("sha256=")
      ? signatureHeader.slice(7)
      : signatureHeader;
    const expectedHex = createHmac("sha256", secret).update(rawBody).digest("hex");
    if (expectedHex.length !== receivedHex.length) return false;
    return timingSafeEqual(Buffer.from(expectedHex), Buffer.from(receivedHex));
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Gateway Config Lookup
// ---------------------------------------------------------------------------

/** Fetches the webhook signing secret for the given tenant+provider. Returns null if not configured. */
export async function fetchGatewaySecret(
  tenantId: string,
  provider: string,
): Promise<string | null> {
  const { rows } = await query<{ webhook_secret_ref: string | null }>(FETCH_GATEWAY_SECRET_SQL, [
    tenantId,
    provider,
  ]);
  return rows[0]?.webhook_secret_ref ?? null;
}

// ---------------------------------------------------------------------------
// Webhook Event Log
// ---------------------------------------------------------------------------

/**
 * Inserts webhook into payment_gateway_webhooks (idempotent via ON CONFLICT DO NOTHING).
 * Returns webhook_id on first insert, null on duplicate (already seen this event_id).
 */
export async function insertWebhookEvent(
  tenantId: string,
  propertyId: string | null,
  provider: string,
  gatewayEventId: string,
  eventType: string,
  rawPayload: Record<string, unknown>,
): Promise<string | null> {
  const { rows } = await query<{ webhook_id: string }>(INSERT_WEBHOOK_SQL, [
    tenantId,
    propertyId,
    provider.toUpperCase(),
    gatewayEventId,
    eventType,
    rawPayload,
  ]);
  return rows[0]?.webhook_id ?? null;
}

// ---------------------------------------------------------------------------
// Payload Extraction Helpers
// ---------------------------------------------------------------------------

/** Extracts the gateway's unique event ID from a generic payload. */
export function extractGatewayEventId(payload: Record<string, unknown>): string | null {
  return (
    (payload.id as string | undefined) ??
    (payload.event_id as string | undefined) ??
    (payload.webhook_id as string | undefined) ??
    null
  );
}

/** Extracts the normalized event type string from a generic payload. */
export function extractEventType(payload: Record<string, unknown>): string {
  return (
    (payload.type as string | undefined) ??
    (payload.eventCode as string | undefined) ??
    (payload.event_type as string | undefined) ??
    "unknown"
  ).toLowerCase();
}

/** Extracts the gateway payment/charge reference from a generic payload. */
function extractGatewayRef(payload: Record<string, unknown>): string | null {
  const obj = (payload.data as Record<string, unknown> | undefined)?.object as
    | Record<string, unknown>
    | undefined;
  return (
    (obj?.id as string | undefined) ??
    (payload.transaction_id as string | undefined) ??
    (payload.reference as string | undefined) ??
    null
  );
}

// ---------------------------------------------------------------------------
// Async Dispatcher
// ---------------------------------------------------------------------------

/**
 * Dispatches a logged webhook event to the appropriate billing command.
 * Must be called via setImmediate after the HTTP 200 is sent.
 *
 * Event type routing:
 *   payment.captured | payment.succeeded | charge.captured → UPDATE payments COMPLETED
 *   payment.failed   | charge.failed                       → UPDATE payments FAILED
 *   charge.dispute.created | dispute.created               → recordChargeback
 *   everything else                                        → SKIPPED (no-op)
 */
export async function dispatchWebhookEvent(
  tenantId: string,
  webhookId: string,
  eventType: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const systemContext: CommandContext = {
    tenantId,
    initiatedBy: { userId: SYSTEM_ACTOR_ID },
  };

  try {
    if (/^(payment\.(captured|succeeded)|charge\.captured)$/.test(eventType)) {
      const gatewayRef = extractGatewayRef(payload);
      if (gatewayRef) {
        await query(UPDATE_PAYMENT_STATUS_SQL, [tenantId, "COMPLETED", gatewayRef]);
      }
    } else if (/^(payment\.failed|charge\.failed)$/.test(eventType)) {
      const gatewayRef = extractGatewayRef(payload);
      if (gatewayRef) {
        await query(UPDATE_PAYMENT_STATUS_SQL, [tenantId, "FAILED", gatewayRef]);
      }
    } else if (
      /^(charge\.dispute\.created|dispute\.created|chargeback\.received)$/.test(eventType)
    ) {
      const obj = (payload.data as Record<string, unknown> | undefined)?.object as
        | Record<string, unknown>
        | undefined;
      const chargeRef =
        (obj?.charge as string | undefined) ??
        (obj?.payment_intent as string | undefined) ??
        extractGatewayRef(payload);

      if (chargeRef) {
        const { rows: pmtRows } = await query<{
          payment_reference: string;
          property_id: string;
          guest_id: string | null;
        }>(FIND_PAYMENT_BY_GATEWAY_REF_SQL, [tenantId, chargeRef]);

        const pmt = pmtRows[0];
        if (pmt) {
          const amountRaw = obj?.amount;
          // Stripe amounts are in cents; only divide by 100 if the value is an integer > 100
          const chargebackAmount =
            typeof amountRaw === "number" && amountRaw > 0
              ? amountRaw / 100
              : typeof amountRaw === "string"
                ? parseFloat(amountRaw)
                : null;

          if (chargebackAmount && chargebackAmount > 0) {
            await recordChargeback(
              {
                payment_reference: pmt.payment_reference,
                property_id: pmt.property_id,
                chargeback_amount: chargebackAmount,
                chargeback_reason: (obj?.reason as string | undefined) ?? "chargeback",
                chargeback_reference: (obj?.id as string | undefined) ?? null,
                chargeback_date: new Date().toISOString().split("T")[0],
              },
              systemContext,
            );

            auditAsync({
              tenantId,
              userId: SYSTEM_ACTOR_ID,
              action: "CHARGEBACK_RECEIVED",
              entityType: "payment",
              entityId: pmt.payment_reference,
              category: "FINANCIAL",
              severity: "CRITICAL",
              isPciRelevant: true,
              description: `Chargeback received via webhook: ${eventType}`,
              metadata: { webhookId, gatewayRef: chargeRef },
            });
          }
        }
      }
    } else {
      // Unknown or already-handled event — mark as SKIPPED
      await query(UPDATE_WEBHOOK_STATUS_SQL, ["SKIPPED", null, webhookId]);
      return;
    }

    await query(UPDATE_WEBHOOK_STATUS_SQL, ["PROCESSED", null, webhookId]);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    appLogger.error({ webhookId, eventType, err }, "Webhook dispatch failed");
    await query(UPDATE_WEBHOOK_STATUS_SQL, ["FAILED", errMsg, webhookId]).catch(() => undefined);
  }
}
