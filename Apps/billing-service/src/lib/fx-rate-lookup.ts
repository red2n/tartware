/**
 * FX Rate Lookup — ACCT-13 Multi-Currency Rate Locking
 *
 * Provides locked exchange rates for charge and payment postings.
 *
 * Lookup priority:
 *   1. Tenant-specific rate for today in `fx_rates` (matching tenant_id)
 *   2. Global rate for today in `fx_rates` (tenant_id IS NULL)
 *   3. Most recent rate within the last 7 days (fallback for weekends/holidays)
 *   4. 1.0 if no rate found (same-currency pass-through or unconfigured)
 *
 * Design: uses a PoolClient from the caller's transaction so the rate read
 * and the posting INSERT share the same snapshot.
 */

import type { PoolClient } from "pg";

import { queryWithClient } from "./db.js";
import { appLogger } from "./logger.js";

/** Result of a rate lookup: the locked rate and base amount. */
interface FxLockResult {
  /** The exchange rate: 1 unit of `fromCurrency` = `rate` units of `toCurrency`. */
  rate: number;
  /** `amount * rate`, rounded to 2 decimal places. */
  baseAmount: number;
  /** Indicates the rate was the same-currency no-op (rate=1.0, fromCurrency=toCurrency). */
  isSameCurrency: boolean;
  /** Indicates no rate was found and 1.0 was used as fallback. */
  isFallback: boolean;
}

/**
 * Look up and lock the FX rate for a transaction.
 * Returns `{ rate: 1.0, baseAmount: amount, isSameCurrency: true }` when
 * `fromCurrency === toCurrency` (no conversion needed).
 *
 * @param client   PoolClient from the caller's active transaction.
 * @param tenantId Tenant ID for tenant-specific rate lookup.
 * @param fromCurrency ISO 4217 source currency (e.g. "EUR").
 * @param toCurrency   ISO 4217 target/base currency (e.g. "USD").
 * @param amount       The transaction amount in `fromCurrency`.
 */
export const lockFxRate = async (
  client: PoolClient,
  tenantId: string,
  fromCurrency: string,
  toCurrency: string,
  amount: number,
): Promise<FxLockResult> => {
  // Same currency — no conversion
  if (fromCurrency === toCurrency) {
    return { rate: 1.0, baseAmount: amount, isSameCurrency: true, isFallback: false };
  }

  // Query: prefer tenant-specific rate for today, then global, then recent fallback
  const { rows } = await queryWithClient<{ rate: string; rate_date: string }>(
    client,
    `
      SELECT rate::text, rate_date::text
      FROM public.fx_rates
      WHERE from_currency = UPPER($3)
        AND to_currency   = UPPER($4)
        AND rate_date     BETWEEN CURRENT_DATE - INTERVAL '7 days' AND CURRENT_DATE
        AND (tenant_id = $1::uuid OR tenant_id IS NULL)
      ORDER BY
        rate_date DESC,                   -- most recent first
        (tenant_id = $1::uuid) DESC       -- tenant-specific preferred over global
      LIMIT 1
    `,
    [tenantId, null, fromCurrency.toUpperCase(), toCurrency.toUpperCase()],
  );

  if (!rows[0]) {
    appLogger.warn(
      { tenantId, fromCurrency, toCurrency },
      "No FX rate found for currency pair — falling back to rate 1.0 (no conversion). Configure fx_rates.",
    );
    return { rate: 1.0, baseAmount: amount, isSameCurrency: false, isFallback: true };
  }

  const rate = Number.parseFloat(rows[0].rate);
  const baseAmount = Math.round(amount * rate * 100) / 100;

  appLogger.debug(
    { tenantId, fromCurrency, toCurrency, rate, rateDate: rows[0].rate_date, baseAmount },
    "FX rate locked",
  );

  return { rate, baseAmount, isSameCurrency: false, isFallback: false };
};

/**
 * Look up the property base currency from the properties table.
 * Returns 'USD' if not found.
 */
export const getPropertyBaseCurrency = async (
  client: PoolClient,
  tenantId: string,
  propertyId: string,
): Promise<string> => {
  const { rows } = await queryWithClient<{ base_currency: string | null }>(
    client,
    `SELECT currency AS base_currency FROM public.properties WHERE id = $1::uuid AND tenant_id = $2::uuid LIMIT 1`,
    [propertyId, tenantId],
  );
  return rows[0]?.base_currency ?? "USD";
};
