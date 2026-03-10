import type {
  ListRateRestrictionsOptions,
  RateRestrictionListItem,
  RateRestrictionRow,
  UpsertRateRestrictionInput,
} from "@tartware/schemas";
import { query } from "../lib/db.js";
import { toDateString, toIsoString } from "../lib/row-mappers.js";
import {
  RATE_RESTRICTION_LIST_SQL,
  RATE_RESTRICTION_REMOVE_SQL,
  RATE_RESTRICTION_UPSERT_SQL,
} from "../sql/pricing-queries.js";

// ============================================================================
// RATE RESTRICTIONS
// ============================================================================

export type { RateRestrictionListItem };

const mapRowToRestriction = (row: RateRestrictionRow): RateRestrictionListItem => ({
  restriction_id: row.restriction_id,
  tenant_id: row.tenant_id,
  property_id: row.property_id,
  property_name: row.property_name ?? undefined,
  room_type_id: row.room_type_id ?? undefined,
  room_type_name: row.room_type_name ?? undefined,
  rate_plan_id: row.rate_plan_id ?? undefined,
  restriction_date: toDateString(row.restriction_date) ?? "",
  restriction_type: row.restriction_type,
  restriction_value: row.restriction_value,
  is_active: row.is_active,
  source: row.source ?? undefined,
  reason: row.reason ?? undefined,
  created_at: toIsoString(row.created_at) ?? "",
  updated_at: toIsoString(row.updated_at),
});

export const listRateRestrictions = async (
  options: ListRateRestrictionsOptions,
): Promise<RateRestrictionListItem[]> => {
  const { rows } = await query<RateRestrictionRow>(RATE_RESTRICTION_LIST_SQL, [
    options.limit ?? 100,
    options.tenantId,
    options.propertyId ?? null,
    options.roomTypeId ?? null,
    options.ratePlanId ?? null,
    options.restrictionType ?? null,
    options.dateFrom ?? null,
    options.dateTo ?? null,
    options.isActive ?? null,
    options.offset ?? 0,
  ]);
  return rows.map(mapRowToRestriction);
};

export const upsertRateRestriction = async (
  tenantId: string,
  propertyId: string,
  data: UpsertRateRestrictionInput,
  actorId: string | null,
): Promise<{ restrictionId: string; createdAt: Date }> => {
  const { rows } = await query<{ restriction_id: string; created_at: Date }>(
    RATE_RESTRICTION_UPSERT_SQL,
    [
      tenantId, // $1
      propertyId, // $2
      data.roomTypeId ?? null, // $3
      data.ratePlanId ?? null, // $4
      data.restrictionDate, // $5
      data.restrictionType, // $6
      data.restrictionValue, // $7
      data.isActive, // $8
      data.source, // $9
      data.reason ?? null, // $10
      data.metadata ? JSON.stringify(data.metadata) : null, // $11
      actorId, // $12
    ],
  );
  const row = rows[0];
  if (!row) throw new Error("UPSERT rate_restriction did not return a row");
  return { restrictionId: row.restriction_id, createdAt: row.created_at };
};

export const removeRateRestriction = async (
  tenantId: string,
  propertyId: string,
  restrictionDate: string,
  restrictionType: string,
  actorId: string | null,
  roomTypeId?: string | null,
  ratePlanId?: string | null,
): Promise<{ restrictionId: string } | null> => {
  const { rows } = await query<{ restriction_id: string }>(RATE_RESTRICTION_REMOVE_SQL, [
    tenantId,
    propertyId,
    restrictionDate,
    restrictionType,
    actorId,
    roomTypeId ?? null,
    ratePlanId ?? null,
  ]);
  const row = rows[0];
  return row ? { restrictionId: row.restriction_id } : null;
};
