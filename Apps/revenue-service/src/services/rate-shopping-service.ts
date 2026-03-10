/**
 * R15: Rate Shopping Automation Service
 *
 * Provides a pluggable provider interface for fetching competitor rates
 * from external sources (OTA Insight, RateGain, webhook endpoints) plus
 * a comparison view for own-vs-competitor rate analysis.
 */
import type {
  CollectedRate,
  RateShoppingItem,
  RateShoppingProvider,
  RateShoppingRow,
} from "@tartware/schemas";
import { query } from "../lib/db.js";
import { toDateString, toIsoString, toNumber } from "../lib/row-mappers.js";
import { RATE_SHOPPING_COMPARISON_SQL } from "../sql/pricing-queries.js";

export type { CollectedRate, RateShoppingProvider };

// ── Built-in providers ──────────────────────────────

/**
 * Console provider — logs the request and returns an empty array.
 * Useful for development and testing the auto-collect pipeline.
 */
export class ConsoleRateShoppingProvider implements RateShoppingProvider {
  readonly name = "console";

  async collectRates(
    tenantId: string,
    propertyId: string,
    startDate: string,
    endDate: string,
  ): Promise<CollectedRate[]> {
    // In production, this would be replaced by a real provider
    // that calls RateGain, OTA Insight, or a webhook endpoint.
    console.log(
      `[RateShopping:console] Would collect rates for tenant=${tenantId} property=${propertyId} range=${startDate}..${endDate}`,
    );
    return [];
  }
}

// ── Provider registry ───────────────────────────────

const providers = new Map<string, RateShoppingProvider>();
providers.set("console", new ConsoleRateShoppingProvider());

/** Get the provider by name, falling back to console. */
export const getProvider = (name?: string): RateShoppingProvider => {
  return providers.get(name ?? "console") ?? providers.get("console")!;
};

// ── Rate Shopping comparison view ───────────────────

const mapRow = (row: RateShoppingRow): RateShoppingItem => ({
  rate_date: toDateString(row.rate_date) ?? "",
  own_rate: toNumber(row.own_rate) ?? null,
  competitor_name: row.competitor_name,
  competitor_rate: toNumber(row.competitor_rate) ?? null,
  rate_difference: toNumber(row.rate_difference) ?? null,
  rate_difference_pct: toNumber(row.rate_difference_pct) ?? null,
  competitor_rooms_left: toNumber(row.competitor_rooms_left) ?? null,
  competitor_occupancy_pct: toNumber(row.competitor_occupancy_pct) ?? null,
  source: row.source ?? null,
  collected_at: toIsoString(row.collected_at) ?? null,
});

/** Get rate shopping comparison grid for a property across a date range. */
export const getRateShoppingComparison = async (options: {
  tenantId: string;
  propertyId: string;
  startDate: string;
  endDate: string;
  competitorName?: string;
  limit?: number;
  offset?: number;
}): Promise<RateShoppingItem[]> => {
  const { rows } = await query<RateShoppingRow>(RATE_SHOPPING_COMPARISON_SQL, [
    options.tenantId,
    options.propertyId,
    options.startDate,
    options.endDate,
    options.competitorName ?? null,
    options.limit ?? 100,
    options.offset ?? 0,
  ]);
  return rows.map(mapRow);
};
