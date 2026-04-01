import type { CommandMetadata } from "@tartware/command-consumer-utils";
import {
  activatePricingRule,
  createPricingRule,
  deactivatePricingRule,
  deletePricingRule,
  updatePricingRule,
} from "../../services/pricing-rule-service.js";

/** Fields shared identically between create and update payload mappings. */
const extractSharedRuleFields = (payload: Record<string, unknown>) => ({
  appliesToRoomTypes: (payload.applies_to_room_types as string[]) ?? null,
  appliesToRatePlans: (payload.applies_to_rate_plans as string[]) ?? null,
  appliesToChannels: (payload.applies_to_channels as string[]) ?? null,
  appliesToSegments: (payload.applies_to_segments as string[]) ?? null,
  appliesMonday: payload.applies_monday as boolean | undefined,
  appliesTuesday: payload.applies_tuesday as boolean | undefined,
  appliesWednesday: payload.applies_wednesday as boolean | undefined,
  appliesThursday: payload.applies_thursday as boolean | undefined,
  appliesFriday: payload.applies_friday as boolean | undefined,
  appliesSaturday: payload.applies_saturday as boolean | undefined,
  appliesSunday: payload.applies_sunday as boolean | undefined,
  adjustmentCapMin: (payload.adjustment_cap_min as number) ?? null,
  adjustmentCapMax: (payload.adjustment_cap_max as number) ?? null,
  minRate: (payload.min_rate as number) ?? null,
  maxRate: (payload.max_rate as number) ?? null,
  minLengthOfStay: (payload.min_length_of_stay as number) ?? null,
  maxLengthOfStay: (payload.max_length_of_stay as number) ?? null,
  applyClosedToArrival: payload.apply_closed_to_arrival as boolean | undefined,
  applyClosedToDeparture: payload.apply_closed_to_departure as boolean | undefined,
  applyStopSell: payload.apply_stop_sell as boolean | undefined,
  metadata: (payload.metadata as Record<string, unknown>) ?? null,
});

export const handlePricingRuleCreate = async (
  payload: Record<string, unknown>,
  metadata: CommandMetadata,
  actorId: string | null,
): Promise<{ ruleId: string }> => {
  const result = await createPricingRule(
    metadata.tenantId,
    {
      propertyId: payload.property_id as string,
      ruleName: payload.rule_name as string,
      ruleType: payload.rule_type as string,
      ruleCategory: (payload.rule_category as string) ?? null,
      description: (payload.description as string) ?? null,
      priority: (payload.priority as number) ?? 100,
      isActive: (payload.is_active as boolean) ?? false,
      effectiveFrom: payload.effective_from as string,
      effectiveUntil: (payload.effective_until as string) ?? null,
      ...extractSharedRuleFields(payload),
      conditions: (payload.conditions as Record<string, unknown>) ?? {},
      adjustmentType: payload.adjustment_type as string,
      adjustmentValue: payload.adjustment_value as number,
      canCombineWithOtherRules: (payload.can_combine_with_other_rules as boolean) ?? true,
      requiresApproval: (payload.requires_approval as boolean) ?? false,
    },
    actorId,
  );
  return { ruleId: result.ruleId };
};

export const handlePricingRuleUpdate = async (
  payload: Record<string, unknown>,
  metadata: CommandMetadata,
  actorId: string | null,
): Promise<{ ruleId: string }> => {
  const result = await updatePricingRule(
    payload.rule_id as string,
    metadata.tenantId,
    {
      ruleName: (payload.rule_name as string) ?? null,
      description: (payload.description as string) ?? null,
      priority: (payload.priority as number) ?? null,
      effectiveFrom: (payload.effective_from as string) ?? null,
      effectiveUntil: (payload.effective_until as string) ?? null,
      ...extractSharedRuleFields(payload),
      conditions: (payload.conditions as Record<string, unknown>) ?? null,
      adjustmentType: (payload.adjustment_type as string) ?? null,
      adjustmentValue: (payload.adjustment_value as number) ?? null,
      canCombineWithOtherRules: payload.can_combine_with_other_rules as boolean | undefined,
      requiresApproval: payload.requires_approval as boolean | undefined,
      lastModifiedReason: (payload.last_modified_reason as string) ?? null,
    },
    actorId,
  );
  return { ruleId: result.ruleId };
};

export const handlePricingRuleActivate = async (
  payload: Record<string, unknown>,
  metadata: CommandMetadata,
  actorId: string | null,
): Promise<{ ruleId: string }> => {
  const result = await activatePricingRule(payload.rule_id as string, metadata.tenantId, actorId);
  return { ruleId: result.ruleId };
};

export const handlePricingRuleDeactivate = async (
  payload: Record<string, unknown>,
  metadata: CommandMetadata,
  actorId: string | null,
): Promise<{ ruleId: string }> => {
  const result = await deactivatePricingRule(payload.rule_id as string, metadata.tenantId, actorId);
  return { ruleId: result.ruleId };
};

export const handlePricingRuleDelete = async (
  payload: Record<string, unknown>,
  metadata: CommandMetadata,
  actorId: string | null,
): Promise<{ ruleId: string }> => {
  const result = await deletePricingRule(payload.rule_id as string, metadata.tenantId, actorId);
  return { ruleId: result.ruleId };
};
