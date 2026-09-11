/**
 * DEV DOC
 * Module: repositories/payment-gateway-repository.ts
 * Purpose: Which processor this property is actually wired to.
 * Ownership: billing-service
 *
 * `payment_gateway_configurations` has thirty-odd columns — provider, credential
 * refs, supported currencies, transaction limits, 3DS flags, timeouts — and
 * until now exactly one reader: `webhook-dispatcher.ts`, which fetches
 * `webhook_secret_ref` to verify an inbound webhook. Nothing on the *payment*
 * path read it at all.
 *
 * That is why `billing.payment.authorize` could write `status = 'AUTHORIZED'`
 * with `gateway_name` and `gateway_reference` taken from the request body: the
 * handler had no way to ask which processor it was supposed to be talking to,
 * so it took the caller's word for the answer. The row then reads as a bank
 * approval, and a folio settles against it.
 *
 * This is the read that makes the column mean something.
 */

import type { ResolvedGateway } from "@tartware/schemas";

import { query } from "../lib/db.js";

/**
 * The configuration a card operation runs against.
 *
 * Ordered `is_primary DESC`: a property may hold several rows — a live acquirer
 * and a sandbox, or two acquirers during a migration — and the primary is the
 * one the desk transacts on. Ties break on `created_at` so the answer is stable
 * rather than whatever the planner returns first.
 *
 * Property-scoped with a tenant-wide fallback (`property_id IS NULL`), because
 * a small estate configures one processor for the whole tenant and a large one
 * configures per property. `property_id = $2` sorts first so the specific row
 * always wins over the general one.
 */
const RESOLVE_GATEWAY_SQL = `
  SELECT config_id,
         gateway_provider,
         gateway_label,
         gateway_environment,
         api_key_ref,
         merchant_id,
         supported_currencies,
         min_transaction_amount,
         max_transaction_amount,
         request_timeout_ms
    FROM public.payment_gateway_configurations
   WHERE tenant_id = $1::uuid
     AND (property_id = $2::uuid OR property_id IS NULL)
     AND is_active = TRUE
     AND COALESCE(is_deleted, FALSE) = FALSE
   ORDER BY (property_id IS NOT NULL) DESC, is_primary DESC, created_at ASC
   LIMIT 1
`;

type GatewayRow = {
  config_id: string;
  gateway_provider: string;
  gateway_label: string;
  gateway_environment: string;
  api_key_ref: string | null;
  merchant_id: string | null;
  supported_currencies: string[] | null;
  min_transaction_amount: string | null;
  max_transaction_amount: string | null;
  request_timeout_ms: number | null;
};

/**
 * The active processor for this property, or `null` when there is none.
 *
 * `null` is a real answer and the caller must treat it as a refusal, not as a
 * default. A property with no configured processor cannot take a card, and
 * saying so is the whole point of this function existing.
 */
export const resolveGatewayConfig = async (
  tenantId: string,
  propertyId: string | null,
): Promise<ResolvedGateway | null> => {
  const { rows } = await query<GatewayRow>(RESOLVE_GATEWAY_SQL, [tenantId, propertyId]);
  const row = rows[0];
  if (!row) return null;

  return {
    configId: row.config_id,
    // Upper-cased here rather than trusted: the column is VARCHAR(50) with no
    // CHECK, so "stripe" and "STRIPE" are both already possible in it.
    provider: row.gateway_provider.toUpperCase(),
    label: row.gateway_label,
    environment: row.gateway_environment,
    credentialRef: row.api_key_ref,
    merchantId: row.merchant_id,
    supportedCurrencies: row.supported_currencies,
    // NUMERIC arrives as a string; parsed at the edge so the caller compares
    // numbers rather than re-deriving that decision per call site.
    minAmount: row.min_transaction_amount === null ? null : Number(row.min_transaction_amount),
    maxAmount: row.max_transaction_amount === null ? null : Number(row.max_transaction_amount),
    requestTimeoutMs: row.request_timeout_ms,
  };
};
