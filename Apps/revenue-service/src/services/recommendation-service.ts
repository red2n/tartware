import type { RateRecommendationListItem, RateRecommendationRow } from "@tartware/schemas";
import { query } from "../lib/db.js";
import { toDateString, toIsoString, toNumber } from "../lib/row-mappers.js";
import { RATE_RECOMMENDATION_LIST_SQL } from "../sql/pricing-queries.js";

// ============================================================================
// RATE RECOMMENDATIONS
// ============================================================================

export type { RateRecommendationListItem };

const mapRowToRecommendation = (row: RateRecommendationRow): RateRecommendationListItem => ({
  recommendation_id: row.recommendation_id,
  tenant_id: row.tenant_id,
  property_id: row.property_id,
  property_name: row.property_name ?? undefined,
  room_type_id: row.room_type_id ?? undefined,
  room_type_name: row.room_type_name ?? undefined,
  rate_plan_id: row.rate_plan_id ?? undefined,
  recommendation_date: toDateString(row.recommendation_date) ?? "",
  current_rate: toNumber(row.current_rate),
  recommended_rate: toNumber(row.recommended_rate),
  confidence_score: row.confidence_score != null ? toNumber(row.confidence_score) : undefined,
  recommendation_reason: row.recommendation_reason ?? undefined,
  status: row.status ?? undefined,
  applied_at: toIsoString(row.applied_at),
  created_at: toIsoString(row.created_at) ?? "",
});

export const listRateRecommendations = async (options: {
  limit?: number;
  tenantId: string;
  propertyId?: string;
  status?: string;
  recommendationDate?: string;
  offset?: number;
}): Promise<RateRecommendationListItem[]> => {
  const { rows } = await query<RateRecommendationRow>(RATE_RECOMMENDATION_LIST_SQL, [
    options.limit ?? 100,
    options.tenantId,
    options.propertyId ?? null,
    options.status ?? null,
    options.recommendationDate ?? null,
    options.offset ?? 0,
  ]);
  return rows.map(mapRowToRecommendation);
};
