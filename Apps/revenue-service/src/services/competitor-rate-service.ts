import type {
  CompetitorRateListItem,
  CompetitorRateRow,
  CreateCompetitorRateInput,
} from "@tartware/schemas";
import { query } from "../lib/db.js";
import { toDateString, toIsoString, toNumber } from "../lib/row-mappers.js";
import { COMPETITOR_RATE_INSERT_SQL, COMPETITOR_RATE_LIST_SQL } from "../sql/pricing-queries.js";

// ============================================================================
// COMPETITOR RATES
// ============================================================================

export type { CompetitorRateListItem, CreateCompetitorRateInput };

const mapRowToCompetitorRate = (row: CompetitorRateRow): CompetitorRateListItem => ({
  competitor_rate_id: row.competitor_rate_id,
  tenant_id: row.tenant_id,
  property_id: row.property_id,
  property_name: row.property_name ?? undefined,
  competitor_name: row.competitor_name,
  competitor_property_name: row.competitor_property_name ?? undefined,
  room_type_category: row.room_type_category ?? undefined,
  rate_date: toDateString(row.rate_date) ?? "",
  rate_amount: toNumber(row.rate_amount),
  currency: row.currency ?? "USD",
  source: row.source ?? undefined,
  collected_at: toIsoString(row.collected_at),
  created_at: toIsoString(row.created_at) ?? "",
});

export const listCompetitorRates = async (options: {
  limit?: number;
  tenantId: string;
  propertyId?: string;
  rateDate?: string;
  offset?: number;
}): Promise<CompetitorRateListItem[]> => {
  const { rows } = await query<CompetitorRateRow>(COMPETITOR_RATE_LIST_SQL, [
    options.limit ?? 100,
    options.tenantId,
    options.propertyId ?? null,
    options.rateDate ?? null,
    options.offset ?? 0,
  ]);
  return rows.map(mapRowToCompetitorRate);
};

export const createCompetitorRate = async (
  tenantId: string,
  propertyId: string,
  data: CreateCompetitorRateInput,
  createdBy: string | null,
): Promise<{ competitorRateId: string; createdAt: Date }> => {
  const { rows } = await query<{ competitor_rate_id: string; created_at: Date }>(
    COMPETITOR_RATE_INSERT_SQL,
    [
      tenantId, // $1
      propertyId, // $2
      data.competitorName, // $3
      data.competitorPropertyName ?? null, // $4
      data.roomTypeCategory ?? null, // $5
      data.rateDate, // $6
      data.rateAmount, // $7
      data.currency, // $8
      data.source ?? null, // $9
      data.includesBreakfast ?? null, // $10
      data.includesParking ?? null, // $11
      data.includesWifi ?? null, // $12
      data.taxesIncluded ?? null, // $13
      data.roomsLeft ?? null, // $14
      data.estimatedOccupancyPercent ?? null, // $15
      data.notes ?? null, // $16
      createdBy, // $17
    ],
  );
  const row = rows[0];
  if (!row) throw new Error("INSERT competitor_rate did not return a row");
  return { competitorRateId: row.competitor_rate_id, createdAt: row.created_at };
};
