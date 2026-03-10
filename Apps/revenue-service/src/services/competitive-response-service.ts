/**
 * R16: Competitive Response Pricing Rules Service
 *
 * Stores competitor-tracking rules as pricing_rules with rule_type = 'competitor_based'.
 * When triggered, these rules generate rate recommendations based on competitor
 * rate movements — never auto-applying unless explicitly configured.
 */
import type {
  CompetitiveResponseRuleInput,
  CompetitiveResponseRuleItem,
  CompetitiveResponseRuleRow,
} from "@tartware/schemas";
import { query } from "../lib/db.js";
import { toIsoString, toNumber } from "../lib/row-mappers.js";
import {
  COMPETITIVE_RESPONSE_RULE_LIST_SQL,
  COMPETITIVE_RESPONSE_RULE_UPSERT_SQL,
} from "../sql/pricing-queries.js";

export type { CompetitiveResponseRuleInput };

// ── Row mapping ─────────────────────────────────────

const mapRow = (row: CompetitiveResponseRuleRow): CompetitiveResponseRuleItem => ({
  rule_id: row.rule_id,
  tenant_id: row.tenant_id,
  property_id: row.property_id,
  property_name: row.property_name ?? undefined,
  rule_name: row.rule_name,
  rule_type: row.rule_type,
  track_competitor: row.track_competitor ?? "",
  response_strategy: row.response_strategy ?? "match",
  response_value: toNumber(row.response_value) ?? 0,
  min_rate: toNumber(row.min_rate) ?? 0,
  max_rate: toNumber(row.max_rate) ?? 0,
  auto_apply: row.auto_apply ?? false,
  trigger_threshold_percent: toNumber(row.trigger_threshold_percent) ?? 5,
  is_active: row.is_active,
  notes: row.notes ?? null,
  created_at: toIsoString(row.created_at) ?? "",
  updated_at: toIsoString(row.updated_at) ?? null,
});

// ── List competitive response rules ─────────────────

export const listCompetitiveResponseRules = async (options: {
  tenantId: string;
  propertyId?: string;
  isActive?: boolean;
  limit?: number;
  offset?: number;
}): Promise<CompetitiveResponseRuleItem[]> => {
  const { rows } = await query<CompetitiveResponseRuleRow>(COMPETITIVE_RESPONSE_RULE_LIST_SQL, [
    options.limit ?? 100,
    options.tenantId,
    options.propertyId ?? null,
    options.isActive ?? null,
    options.offset ?? 0,
  ]);
  return rows.map(mapRow);
};

// ── Create / update a competitive response rule ─────

export const upsertCompetitiveResponseRule = async (
  tenantId: string,
  propertyId: string,
  data: CompetitiveResponseRuleInput,
  actorId: string | null,
): Promise<{ ruleId: string }> => {
  const ruleName = `Competitive response: ${data.trackCompetitor}`;

  const conditions = {
    track_competitor: data.trackCompetitor,
    response_strategy: data.responseStrategy,
    response_value: data.responseValue,
    trigger_threshold_percent: data.triggerThresholdPercent,
  };

  const metadata = {
    auto_apply: data.autoApply,
  };

  const { rows } = await query<{ rule_id: string; created_at: Date }>(
    COMPETITIVE_RESPONSE_RULE_UPSERT_SQL,
    [
      tenantId, // $1
      propertyId, // $2
      ruleName, // $3
      JSON.stringify(conditions), // $4
      data.minRate, // $5
      data.maxRate, // $6
      data.isActive, // $7
      data.notes ?? null, // $8
      JSON.stringify(metadata), // $9
      data.roomTypeId ?? null, // $10
      actorId, // $11
    ],
  );

  const row = rows[0];
  if (!row) throw new Error("INSERT competitive response rule did not return a row");
  return { ruleId: row.rule_id };
};
