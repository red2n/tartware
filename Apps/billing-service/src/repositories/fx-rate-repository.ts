/**
 * DEV DOC
 * Module: fx-rate-repository.ts
 * Purpose: Repository for FX reference rates (ACCT-13 multi-currency rate locking).
 *          Rates are low-velocity reference data written by finance admins or a
 *          rate-feed import, then read by `lib/fx-rate-lookup.ts` at posting time.
 * Ownership: billing-service (owner of the fx_rates table)
 */

import type { FxRateListQuery, FxRateRow, FxRateUpsertRequest } from "@tartware/schemas";

import { auditAsync } from "../lib/audit-logger.js";
import { query } from "../lib/db.js";
import { appLogger } from "../lib/logger.js";

const logger = appLogger.child({ module: "fx-rate-repository" });

// ─── SQL ─────────────────────────────────────────────────────────────────────

/**
 * Upsert on (tenant_id, rate_date, from_currency, to_currency).
 *
 * A same-day correction overwrites the rate rather than erroring: postings lock
 * their rate onto the charge/payment row at posting time, so amending today's
 * reference rate never retroactively restates a booked transaction.
 *
 * `xmax = 0` is true only for a freshly inserted tuple, which is how the caller
 * distinguishes a create (201) from a correction (200).
 */
const UPSERT_FX_RATE_SQL = `
  INSERT INTO public.fx_rates (
    tenant_id, from_currency, to_currency, rate, rate_date,
    rate_source, rate_source_ref, created_by
  ) VALUES (
    $1::uuid, $2, $3, $4::decimal, $5::date,
    $6, $7, $8::uuid
  )
  ON CONFLICT ON CONSTRAINT uq_fx_rates_date_pair DO UPDATE
  SET rate            = EXCLUDED.rate,
      rate_source     = EXCLUDED.rate_source,
      rate_source_ref = EXCLUDED.rate_source_ref,
      created_by      = EXCLUDED.created_by
  RETURNING rate_id, (xmax = 0) AS created
`;

const LIST_FX_RATES_SQL = `
  SELECT
    rate_id, tenant_id, from_currency, to_currency,
    rate, rate_date, rate_source, rate_source_ref,
    created_at, created_by
  FROM public.fx_rates
  WHERE (tenant_id = $1::uuid OR ($2::boolean AND tenant_id IS NULL))
    AND ($3::char(3) IS NULL OR from_currency = $3::char(3))
    AND ($4::char(3) IS NULL OR to_currency = $4::char(3))
    AND ($5::date IS NULL OR rate_date = $5::date)
  ORDER BY rate_date DESC, from_currency, to_currency, tenant_id NULLS LAST
  LIMIT $6 OFFSET $7
`;

// ─── Repository ──────────────────────────────────────────────────────────────

/** Result of an FX rate upsert: the row id and whether it was newly inserted. */
type FxRateUpsertResult = { rateId: string; created: boolean };

/**
 * Insert an FX reference rate, or correct the existing rate for the same
 * tenant/date/currency-pair.
 *
 * @param userId Actor UUID recorded on the row and in the audit trail.
 */
export async function upsertFxRate(
  userId: string,
  input: FxRateUpsertRequest,
): Promise<FxRateUpsertResult> {
  const result = await query<{ rate_id: string; created: boolean }>(UPSERT_FX_RATE_SQL, [
    input.tenant_id,
    input.from_currency,
    input.to_currency,
    input.rate,
    input.rate_date,
    input.rate_source,
    input.rate_source_ref ?? null,
    userId,
  ]);

  const row = result.rows[0];
  if (!row) throw new Error("Failed to upsert FX rate — no row returned");

  logger.info(
    {
      rateId: row.rate_id,
      tenantId: input.tenant_id,
      pair: `${input.from_currency}/${input.to_currency}`,
      rate: input.rate,
      rateDate: input.rate_date,
      created: row.created,
    },
    row.created ? "FX rate created" : "FX rate corrected",
  );

  auditAsync({
    tenantId: input.tenant_id,
    userId,
    action: row.created ? "CREATE_FX_RATE" : "UPDATE_FX_RATE",
    entityType: "fx_rates",
    entityId: row.rate_id,
    category: "CONFIGURATION",
    severity: "INFO",
    description: `${row.created ? "Set" : "Corrected"} ${input.from_currency}→${input.to_currency} rate to ${input.rate} for ${input.rate_date}`,
    newValues: input as unknown as Record<string, unknown>,
  });

  return { rateId: row.rate_id, created: row.created };
}

/** List FX rates visible to a tenant, optionally filtered by pair and date. */
export async function listFxRates(params: FxRateListQuery): Promise<FxRateRow[]> {
  const result = await query<FxRateRow>(LIST_FX_RATES_SQL, [
    params.tenant_id,
    params.include_global,
    params.from_currency ?? null,
    params.to_currency ?? null,
    params.rate_date ?? null,
    params.limit,
    params.offset,
  ]);
  return result.rows;
}
