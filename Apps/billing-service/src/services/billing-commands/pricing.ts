import {
  applyPricingAdjustment,
  bulkGeneratePricingRecommendationsImpl,
  evalPricingCondition,
  type PricingCondition,
  type PricingEngineRuleRow,
} from "@tartware/schemas";

import { query } from "../../lib/db.js";
import { appLogger } from "../../lib/logger.js";
import { BillingPricingEvaluateCommandSchema } from "../../schemas/billing-commands.js";
import { type CommandContext, resolveActorId } from "./common.js";

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
  const { rows: rules } = await query<PricingEngineRuleRow>(
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
    return (rule.conditions as PricingCondition[]).every((cond) =>
      evalPricingCondition(cond, evalCtx),
    );
  });

  // 3. Apply adjustments: priority-first, respect combinability
  let adjustedRate = command.base_rate;
  const appliedRules: string[] = [];

  if (matchingRules.length > 0) {
    // First non-combinable rule wins, then stack combinable rules
    const nonCombinable = matchingRules.find((r) => !r.can_combine_with_other_rules);
    if (nonCombinable) {
      adjustedRate = applyPricingAdjustment(
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
        adjustedRate = applyPricingAdjustment(
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
  const actorId = resolveActorId(context.initiatedBy);
  const result = await bulkGeneratePricingRecommendationsImpl(
    payload,
    context.tenantId,
    actorId,
    query,
  );
  const parsed = JSON.parse(result) as { generated: number; room_types: number; dates: number };
  appLogger.info(
    {
      propertyId: (payload as { property_id?: string }).property_id,
      roomTypes: parsed.room_types,
      dates: parsed.dates,
      generated: parsed.generated,
    },
    "Bulk pricing recommendations generated",
  );
  return result;
};
