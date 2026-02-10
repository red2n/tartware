import { randomUUID } from "node:crypto";

import { query } from "../../lib/db.js";
import { appLogger } from "../../lib/logger.js";
import {
  BillingPricingBulkRecommendCommandSchema,
  BillingPricingEvaluateCommandSchema,
} from "../../schemas/billing-commands.js";
import {
  type CommandContext,
  resolveActorId,
} from "./common.js";

/**
 * Pricing rule condition. Mirrors the JSONB `conditions` column
 * on the pricing_rules table.
 */
interface PricingCondition {
  field: string;
  operator: string;
  value: unknown;
}

/**
 * Evaluate a single condition against the provided context.
 */
const evalCondition = (cond: PricingCondition, ctx: Record<string, unknown>): boolean => {
  const actual = ctx[cond.field];
  if (actual === undefined || actual === null) return false;
  const numActual = Number(actual);
  const numValue = Number(cond.value);
  switch (cond.operator) {
    case ">=":
      return numActual >= numValue;
    case "<=":
      return numActual <= numValue;
    case ">":
      return numActual > numValue;
    case "<":
      return numActual < numValue;
    case "=":
    case "==":
      return String(actual) === String(cond.value);
    case "!=":
      return String(actual) !== String(cond.value);
    case "in":
      return (
        Array.isArray(cond.value) && (cond.value as unknown[]).map(String).includes(String(actual))
      );
    default:
      return false;
  }
};

/**
 * Apply an adjustment to a base rate according to its type and caps.
 */
const applyAdjustment = (
  baseRate: number,
  adjustmentType: string,
  adjustmentValue: number,
  capMin: number | null,
  capMax: number | null,
): number => {
  let adjusted = baseRate;
  switch (adjustmentType) {
    case "percentage_increase":
      adjusted = baseRate * (1 + adjustmentValue / 100);
      break;
    case "percentage_decrease":
      adjusted = baseRate * (1 - adjustmentValue / 100);
      break;
    case "fixed_amount_increase":
      adjusted = baseRate + adjustmentValue;
      break;
    case "fixed_amount_decrease":
      adjusted = baseRate - adjustmentValue;
      break;
    case "set_to_amount":
      adjusted = adjustmentValue;
      break;
    default:
      adjusted = baseRate;
  }
  if (capMin != null) adjusted = Math.max(adjusted, capMin);
  if (capMax != null) adjusted = Math.min(adjusted, capMax);
  return Math.max(0, Math.round(adjusted * 100) / 100);
};

interface PricingRuleRow {
  rule_id: string;
  rule_name: string;
  rule_type: string;
  priority: number;
  conditions: PricingCondition[] | null;
  adjustment_type: string;
  adjustment_value: number;
  adjustment_cap_min: number | null;
  adjustment_cap_max: number | null;
  can_combine_with_other_rules: boolean;
  conflict_resolution: string;
}

/**
 * Evaluate active pricing rules for a given property/room type/date.
 * Loads applicable rules, evaluates conditions, applies adjustments
 * with priority ordering and combinability logic, returns adjusted rate.
 */
export const evaluatePricingRules = async (
  payload: unknown,
  context: CommandContext,
): Promise<string> => {
  const command = BillingPricingEvaluateCommandSchema.parse(payload);
  const tenantId = context.tenantId;

  // Build evaluation context from command fields
  const evalCtx: Record<string, unknown> = {
    occupancy_percent: command.occupancy_percent,
    demand_level: command.demand_level,
    days_until_arrival: command.days_until_arrival,
    length_of_stay: command.length_of_stay,
    day_of_week: command.day_of_week ?? new Date(command.stay_date).getDay(),
    channel: command.channel,
    segment: command.segment,
  };

  // 1. Load active pricing rules for this property/room-type
  const { rows: rules } = await query<PricingRuleRow>(
    `SELECT rule_id, rule_name, rule_type, priority,
            conditions, adjustment_type,
            COALESCE(adjustment_value, 0) AS adjustment_value,
            adjustment_cap_min, adjustment_cap_max,
            COALESCE(can_combine_with_other_rules, true) AS can_combine_with_other_rules,
            COALESCE(conflict_resolution, 'highest_priority') AS conflict_resolution
     FROM pricing_rules
     WHERE tenant_id = $1 AND property_id = $2
       AND is_active = true AND is_deleted = false
       AND (room_type_id IS NULL OR room_type_id = $3)
       AND (effective_from IS NULL OR effective_from <= $4::date)
       AND (effective_to IS NULL OR effective_to >= $4::date)
     ORDER BY priority ASC, created_at ASC`,
    [
      tenantId,
      command.property_id,
      command.room_type_id,
      new Date(command.stay_date).toISOString().slice(0, 10),
    ],
  );

  // 2. Evaluate conditions and collect matching rules
  const matchingRules = rules.filter((rule) => {
    if (!rule.conditions || !Array.isArray(rule.conditions) || rule.conditions.length === 0) {
      return true; // No conditions = always applies
    }
    return (rule.conditions as PricingCondition[]).every((cond) => evalCondition(cond, evalCtx));
  });

  // 3. Apply adjustments: priority-first, respect combinability
  let adjustedRate = command.base_rate;
  const appliedRules: string[] = [];

  if (matchingRules.length > 0) {
    // First non-combinable rule wins, then stack combinable rules
    const nonCombinable = matchingRules.find((r) => !r.can_combine_with_other_rules);
    if (nonCombinable) {
      adjustedRate = applyAdjustment(
        command.base_rate,
        nonCombinable.adjustment_type,
        nonCombinable.adjustment_value,
        nonCombinable.adjustment_cap_min,
        nonCombinable.adjustment_cap_max,
      );
      appliedRules.push(nonCombinable.rule_id);
    } else {
      // Stack all combinable rules
      for (const rule of matchingRules) {
        adjustedRate = applyAdjustment(
          adjustedRate,
          rule.adjustment_type,
          rule.adjustment_value,
          rule.adjustment_cap_min,
          rule.adjustment_cap_max,
        );
        appliedRules.push(rule.rule_id);
      }
    }
  }

  // 4. Write evaluated result to room_availability.dynamic_price
  await query(
    `UPDATE room_availability
     SET dynamic_price = $4,
         updated_at = NOW()
     WHERE tenant_id = $1 AND property_id = $2
       AND room_type_id = $3
       AND availability_date = $5::date`,
    [
      tenantId,
      command.property_id,
      command.room_type_id,
      adjustedRate,
      new Date(command.stay_date).toISOString().slice(0, 10),
    ],
  );

  appLogger.info(
    {
      propertyId: command.property_id,
      roomTypeId: command.room_type_id,
      baseRate: command.base_rate,
      adjustedRate,
      rulesEvaluated: rules.length,
      rulesApplied: appliedRules.length,
    },
    "Pricing rules evaluated",
  );

  return JSON.stringify({ adjusted_rate: adjustedRate, rules_applied: appliedRules });
};

/**
 * Bulk generate rate recommendations for a property across a date range.
 * Evaluates pricing rules for each room type + date combination and
 * inserts results into rate_recommendations for revenue manager review.
 */
export const bulkGeneratePricingRecommendations = async (
  payload: unknown,
  context: CommandContext,
): Promise<string> => {
  const command = BillingPricingBulkRecommendCommandSchema.parse(payload);
  const tenantId = context.tenantId;
  const actorId = resolveActorId(context.initiatedBy);

  // 1. Get room types to evaluate
  const roomTypeFilter = command.room_type_ids?.length
    ? `AND id = ANY($2::uuid[])`
    : `AND ($2::uuid[] IS NULL OR TRUE)`;
  const { rows: roomTypes } = await query<{ id: string; name: string; base_price: number }>(
    `SELECT id, name, COALESCE(base_price, 0) AS base_price FROM room_types
     WHERE tenant_id = $1 AND property_id = $3 AND is_deleted = false
     ${roomTypeFilter}
     ORDER BY name`,
    [tenantId, command.room_type_ids ?? null, command.property_id],
  );

  // 2. Generate date range
  const startDate = new Date(command.start_date);
  const endDate = new Date(command.end_date);
  const dates: Date[] = [];
  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    dates.push(new Date(d));
  }

  // 3. Load demand calendar for context
  const { rows: demandRows } = await query<Record<string, unknown>>(
    `SELECT calendar_date::text, occupancy_percent, demand_level
     FROM demand_calendar
     WHERE tenant_id = $1 AND property_id = $2
       AND calendar_date >= $3::date AND calendar_date <= $4::date`,
    [
      tenantId,
      command.property_id,
      startDate.toISOString().slice(0, 10),
      endDate.toISOString().slice(0, 10),
    ],
  );
  const demandMap = new Map(demandRows.map((r) => [String(r.calendar_date), r]));

  let generated = 0;

  for (const roomType of roomTypes) {
    for (const date of dates) {
      const dateStr = date.toISOString().slice(0, 10);
      const demand = demandMap.get(dateStr);

      // Evaluate pricing rules synchronously
      const evalPayload = {
        property_id: command.property_id,
        room_type_id: roomType.id,
        base_rate: roomType.base_price,
        stay_date: date,
        occupancy_percent: demand ? Number(demand.occupancy_percent ?? 0) : undefined,
        demand_level: demand?.demand_level ? String(demand.demand_level) : undefined,
        days_until_arrival: Math.max(0, Math.floor((date.getTime() - Date.now()) / 86400000)),
        day_of_week: date.getDay(),
      };

      // Load and evaluate rules inline (avoid circular command dispatch)
      const { rows: rules } = await query<PricingRuleRow>(
        `SELECT rule_id, rule_name, rule_type, priority,
                conditions, adjustment_type,
                COALESCE(adjustment_value, 0) AS adjustment_value,
                adjustment_cap_min, adjustment_cap_max,
                COALESCE(can_combine_with_other_rules, true) AS can_combine_with_other_rules,
                COALESCE(conflict_resolution, 'highest_priority') AS conflict_resolution
         FROM pricing_rules
         WHERE tenant_id = $1 AND property_id = $2
           AND is_active = true AND is_deleted = false
           AND (room_type_id IS NULL OR room_type_id = $3)
           AND (effective_from IS NULL OR effective_from <= $4::date)
           AND (effective_to IS NULL OR effective_to >= $4::date)
         ORDER BY priority ASC`,
        [tenantId, command.property_id, roomType.id, dateStr],
      );

      const evalCtx: Record<string, unknown> = {
        occupancy_percent: evalPayload.occupancy_percent,
        demand_level: evalPayload.demand_level,
        days_until_arrival: evalPayload.days_until_arrival,
        day_of_week: evalPayload.day_of_week,
      };

      const matched = rules.filter((r) => {
        if (!r.conditions || !Array.isArray(r.conditions) || r.conditions.length === 0) return true;
        return (r.conditions as PricingCondition[]).every((c) => evalCondition(c, evalCtx));
      });

      let adjustedRate = roomType.base_price;
      for (const rule of matched) {
        if (!rule.can_combine_with_other_rules) {
          adjustedRate = applyAdjustment(
            roomType.base_price,
            rule.adjustment_type,
            rule.adjustment_value,
            rule.adjustment_cap_min,
            rule.adjustment_cap_max,
          );
          break;
        }
        adjustedRate = applyAdjustment(
          adjustedRate,
          rule.adjustment_type,
          rule.adjustment_value,
          rule.adjustment_cap_min,
          rule.adjustment_cap_max,
        );
      }

      if (!command.dry_run) {
        const recommendationId = randomUUID();
        await query(
          `INSERT INTO rate_recommendations (
             recommendation_id, tenant_id, property_id, room_type_id,
             recommendation_date, current_rate, recommended_rate,
             adjustment_amount, adjustment_percent,
             recommendation_reason, recommendation_source,
             confidence_score, review_status,
             created_at, created_by
           ) VALUES (
             $1, $2, $3, $4,
             $5::date, $6, $7,
             $8, $9,
             $10, 'pricing_engine',
             $11, 'pending',
             NOW(), $12
           )
           ON CONFLICT (property_id, room_type_id, recommendation_date)
             WHERE review_status = 'pending'
           DO UPDATE SET
             recommended_rate = EXCLUDED.recommended_rate,
             adjustment_amount = EXCLUDED.adjustment_amount,
             adjustment_percent = EXCLUDED.adjustment_percent,
             recommendation_reason = EXCLUDED.recommendation_reason,
             confidence_score = EXCLUDED.confidence_score,
             updated_at = NOW()`,
          [
            recommendationId,
            tenantId,
            command.property_id,
            roomType.id,
            dateStr,
            roomType.base_price,
            adjustedRate,
            adjustedRate - roomType.base_price,
            roomType.base_price > 0
              ? Math.round(((adjustedRate - roomType.base_price) / roomType.base_price) * 10000) /
                100
              : 0,
            `${matched.length} pricing rules applied (${matched.map((r) => r.rule_type).join(", ")})`,
            matched.length > 0 ? 80 : 50,
            actorId,
          ],
        );
        generated++;
      }
    }
  }

  appLogger.info(
    {
      propertyId: command.property_id,
      roomTypes: roomTypes.length,
      dates: dates.length,
      generated,
    },
    "Bulk pricing recommendations generated",
  );

  return JSON.stringify({ generated, room_types: roomTypes.length, dates: dates.length });
};
