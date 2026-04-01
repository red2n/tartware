import type {
  CreatePricingRuleInput,
  PricingRuleListItem,
  PricingRuleRow,
  UpdatePricingRuleInput,
} from "@tartware/schemas";
import { query } from "../lib/db.js";
import { toDateString, toIsoString, toNumber } from "../lib/row-mappers.js";
import {
  PRICING_RULE_ACTIVATE_SQL,
  PRICING_RULE_BY_ID_SQL,
  PRICING_RULE_DEACTIVATE_SQL,
  PRICING_RULE_INSERT_SQL,
  PRICING_RULE_LIST_SQL,
  PRICING_RULE_SOFT_DELETE_SQL,
  PRICING_RULE_UPDATE_SQL,
} from "../sql/pricing-queries.js";

// ============================================================================
// PRICING RULES
// ============================================================================

export type { CreatePricingRuleInput, PricingRuleListItem, UpdatePricingRuleInput };

const mapRowToPricingRule = (row: PricingRuleRow): PricingRuleListItem => ({
  rule_id: row.rule_id,
  tenant_id: row.tenant_id,
  property_id: row.property_id,
  property_name: row.property_name ?? undefined,
  rule_name: row.rule_name,
  rule_type: row.rule_type,
  priority: row.priority,
  is_active: row.is_active,
  effective_from: toDateString(row.effective_from),
  effective_to: toDateString(row.effective_to),
  applies_to_room_types: row.applies_to_room_types ?? undefined,
  applies_to_rate_plans: row.applies_to_rate_plans ?? undefined,
  condition_type: row.condition_type ?? undefined,
  adjustment_type: row.adjustment_type ?? undefined,
  adjustment_value: row.adjustment_value != null ? toNumber(row.adjustment_value) : undefined,
  min_rate: row.min_rate != null ? toNumber(row.min_rate) : undefined,
  max_rate: row.max_rate != null ? toNumber(row.max_rate) : undefined,
  created_at: toIsoString(row.created_at) ?? "",
  updated_at: toIsoString(row.updated_at),
});

export const listPricingRules = async (options: {
  limit?: number;
  tenantId: string;
  propertyId?: string;
  ruleType?: string;
  isActive?: boolean;
  offset?: number;
}): Promise<PricingRuleListItem[]> => {
  const { rows } = await query<PricingRuleRow>(PRICING_RULE_LIST_SQL, [
    options.limit ?? 100,
    options.tenantId,
    options.propertyId ?? null,
    options.ruleType ?? null,
    options.isActive ?? null,
    options.offset ?? 0,
  ]);
  return rows.map(mapRowToPricingRule);
};

export const getPricingRuleById = async (
  ruleId: string,
  tenantId: string,
): Promise<PricingRuleListItem | null> => {
  const { rows } = await query<PricingRuleRow>(PRICING_RULE_BY_ID_SQL, [ruleId, tenantId]);
  const [row] = rows;
  return row ? mapRowToPricingRule(row) : null;
};

export const createPricingRule = async (
  tenantId: string,
  data: CreatePricingRuleInput,
  createdBy: string | null,
): Promise<{ ruleId: string; createdAt: Date; updatedAt: Date }> => {
  const approvalStatus = data.requiresApproval ? "draft" : "approved";
  const { rows } = await query<{ rule_id: string; created_at: Date; updated_at: Date }>(
    PRICING_RULE_INSERT_SQL,
    [
      tenantId, // $1
      data.propertyId, // $2
      data.ruleName, // $3
      data.description ?? null, // $4
      data.ruleType, // $5
      data.ruleCategory ?? null, // $6
      data.priority, // $7
      data.isActive, // $8
      data.effectiveFrom, // $9
      data.effectiveUntil ?? null, // $10
      data.appliesToRoomTypes ?? null, // $11
      data.appliesToRatePlans ?? null, // $12
      data.appliesToChannels ?? null, // $13
      data.appliesToSegments ?? null, // $14
      data.appliesMonday ?? true, // $15
      data.appliesTuesday ?? true, // $16
      data.appliesWednesday ?? true, // $17
      data.appliesThursday ?? true, // $18
      data.appliesFriday ?? true, // $19
      data.appliesSaturday ?? true, // $20
      data.appliesSunday ?? true, // $21
      JSON.stringify(data.conditions), // $22
      data.adjustmentType, // $23
      data.adjustmentValue, // $24
      data.adjustmentCapMin ?? null, // $25
      data.adjustmentCapMax ?? null, // $26
      data.minRate ?? null, // $27
      data.maxRate ?? null, // $28
      data.minLengthOfStay ?? null, // $29
      data.maxLengthOfStay ?? null, // $30
      data.applyClosedToArrival ?? false, // $31
      data.applyClosedToDeparture ?? false, // $32
      data.applyStopSell ?? false, // $33
      data.canCombineWithOtherRules, // $34
      data.requiresApproval, // $35
      approvalStatus, // $36
      data.metadata ? JSON.stringify(data.metadata) : null, // $37
      createdBy, // $38
    ],
  );
  const row = rows[0];
  if (!row) throw new Error("INSERT pricing_rule did not return a row");
  return { ruleId: row.rule_id, createdAt: row.created_at, updatedAt: row.updated_at };
};

export const updatePricingRule = async (
  ruleId: string,
  tenantId: string,
  data: UpdatePricingRuleInput,
  updatedBy: string | null,
): Promise<{ ruleId: string; updatedAt: Date }> => {
  const { rows } = await query<{ rule_id: string; updated_at: Date }>(PRICING_RULE_UPDATE_SQL, [
    ruleId, // $1
    tenantId, // $2
    data.ruleName ?? null, // $3
    data.description ?? null, // $4
    data.priority ?? null, // $5
    data.effectiveFrom ?? null, // $6
    data.effectiveUntil ?? null, // $7
    data.appliesToRoomTypes ?? null, // $8
    data.appliesToRatePlans ?? null, // $9
    data.appliesToChannels ?? null, // $10
    data.appliesToSegments ?? null, // $11
    data.appliesMonday ?? null, // $12
    data.appliesTuesday ?? null, // $13
    data.appliesWednesday ?? null, // $14
    data.appliesThursday ?? null, // $15
    data.appliesFriday ?? null, // $16
    data.appliesSaturday ?? null, // $17
    data.appliesSunday ?? null, // $18
    data.conditions ? JSON.stringify(data.conditions) : null, // $19
    data.adjustmentType ?? null, // $20
    data.adjustmentValue ?? null, // $21
    data.adjustmentCapMin ?? null, // $22
    data.adjustmentCapMax ?? null, // $23
    data.minRate ?? null, // $24
    data.maxRate ?? null, // $25
    data.minLengthOfStay ?? null, // $26
    data.maxLengthOfStay ?? null, // $27
    data.applyClosedToArrival ?? null, // $28
    data.applyClosedToDeparture ?? null, // $29
    data.applyStopSell ?? null, // $30
    data.canCombineWithOtherRules ?? null, // $31
    data.requiresApproval ?? null, // $32
    data.lastModifiedReason ?? null, // $33
    data.metadata ? JSON.stringify(data.metadata) : null, // $34
    updatedBy, // $35
  ]);
  const row = rows[0];
  if (!row) throw new Error(`Pricing rule ${ruleId} not found or already deleted`);
  return { ruleId: row.rule_id, updatedAt: row.updated_at };
};

const togglePricingRuleStatus = async (
  ruleId: string,
  tenantId: string,
  updatedBy: string | null,
  sql: string,
): Promise<{ ruleId: string; updatedAt: Date }> => {
  const { rows } = await query<{ rule_id: string; updated_at: Date }>(sql, [
    ruleId,
    tenantId,
    updatedBy,
  ]);
  const row = rows[0];
  if (!row) throw new Error(`Pricing rule ${ruleId} not found or already deleted`);
  return { ruleId: row.rule_id, updatedAt: row.updated_at };
};

export const activatePricingRule = (
  ruleId: string,
  tenantId: string,
  updatedBy: string | null,
): Promise<{ ruleId: string; updatedAt: Date }> =>
  togglePricingRuleStatus(ruleId, tenantId, updatedBy, PRICING_RULE_ACTIVATE_SQL);

export const deactivatePricingRule = (
  ruleId: string,
  tenantId: string,
  updatedBy: string | null,
): Promise<{ ruleId: string; updatedAt: Date }> =>
  togglePricingRuleStatus(ruleId, tenantId, updatedBy, PRICING_RULE_DEACTIVATE_SQL);

export const deletePricingRule = async (
  ruleId: string,
  tenantId: string,
  deletedBy: string | null,
): Promise<{ ruleId: string }> => {
  const { rows } = await query<{ rule_id: string }>(PRICING_RULE_SOFT_DELETE_SQL, [
    ruleId,
    tenantId,
    deletedBy,
  ]);
  const row = rows[0];
  if (!row) throw new Error(`Pricing rule ${ruleId} not found or already deleted`);
  return { ruleId: row.rule_id };
};
