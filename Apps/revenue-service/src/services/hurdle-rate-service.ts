import type { HurdleRateListItem } from "@tartware/schemas";
import { query } from "../lib/db.js";
import { toDateString, toIsoString, toNumber } from "../lib/row-mappers.js";
import { HURDLE_RATE_LIST_SQL, HURDLE_RATE_UPSERT_SQL } from "../sql/pricing-queries.js";

// ============================================================================
// HURDLE RATES
// ============================================================================

type HurdleRateRow = {
  hurdle_rate_id: string;
  tenant_id: string;
  property_id: string;
  property_name: string | null;
  room_type_id: string;
  room_type_name: string | null;
  hurdle_date: string | Date;
  hurdle_rate: number | string;
  currency: string | null;
  segment: string | null;
  source: string | null;
  displacement_analysis: Record<string, unknown> | null;
  confidence_score: number | string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string | Date;
  updated_at: string | Date | null;
};

export type { HurdleRateListItem };

const mapRowToHurdleRate = (row: HurdleRateRow): HurdleRateListItem => ({
  hurdle_rate_id: row.hurdle_rate_id,
  tenant_id: row.tenant_id,
  property_id: row.property_id,
  property_name: row.property_name ?? undefined,
  room_type_id: row.room_type_id,
  room_type_name: row.room_type_name ?? undefined,
  hurdle_date: toDateString(row.hurdle_date) ?? "",
  hurdle_rate: toNumber(row.hurdle_rate),
  currency: row.currency ?? "USD",
  segment: row.segment ?? undefined,
  source: row.source ?? undefined,
  displacement_analysis: row.displacement_analysis ?? undefined,
  confidence_score: row.confidence_score != null ? toNumber(row.confidence_score) : undefined,
  is_active: row.is_active,
  notes: row.notes ?? undefined,
  created_at: toIsoString(row.created_at) ?? "",
  updated_at: toIsoString(row.updated_at),
});

export const listHurdleRates = async (options: {
  limit?: number;
  tenantId: string;
  propertyId?: string;
  roomTypeId?: string;
  segment?: string;
  dateFrom?: string;
  dateTo?: string;
  source?: string;
  offset?: number;
}): Promise<HurdleRateListItem[]> => {
  const { rows } = await query<HurdleRateRow>(HURDLE_RATE_LIST_SQL, [
    options.limit ?? 100,
    options.tenantId,
    options.propertyId ?? null,
    options.roomTypeId ?? null,
    options.segment ?? null,
    options.dateFrom ?? null,
    options.dateTo ?? null,
    options.source ?? null,
    options.offset ?? 0,
  ]);
  return rows.map(mapRowToHurdleRate);
};

export const upsertHurdleRate = async (
  tenantId: string,
  propertyId: string,
  data: {
    roomTypeId: string;
    hurdleDate: string;
    hurdleRate: number;
    currency: string;
    segment?: string | null;
    source: string;
    displacementAnalysis?: Record<string, unknown> | null;
    confidenceScore?: number | null;
    isActive: boolean;
    notes?: string | null;
    metadata?: Record<string, unknown> | null;
  },
  actorId: string | null,
): Promise<{ hurdleRateId: string; createdAt: Date }> => {
  const { rows } = await query<{ hurdle_rate_id: string; created_at: Date }>(
    HURDLE_RATE_UPSERT_SQL,
    [
      tenantId, // $1
      propertyId, // $2
      data.roomTypeId, // $3
      data.hurdleDate, // $4
      data.hurdleRate, // $5
      data.currency, // $6
      data.segment ?? null, // $7
      data.source, // $8
      data.displacementAnalysis ? JSON.stringify(data.displacementAnalysis) : null, // $9
      data.confidenceScore ?? null, // $10
      data.isActive, // $11
      data.notes ?? null, // $12
      data.metadata ? JSON.stringify(data.metadata) : null, // $13
      actorId, // $14
    ],
  );
  const row = rows[0];
  if (!row) throw new Error("UPSERT hurdle_rate did not return a row");
  return { hurdleRateId: row.hurdle_rate_id, createdAt: row.created_at };
};
