/**
 * DEV DOC
 * Module: schemas/02-inventory/commission-rules.ts
 * Description: CommissionRules Schema
 * Table: commission_rules
 * Category: 02-inventory
 * Primary exports: CommissionRulesSchema, CreateCommissionRulesSchema, UpdateCommissionRulesSchema
 * @table commission_rules
 * @category 02-inventory
 * Ownership: Schema package
 */

/**
 * CommissionRules Schema
 * @table commission_rules
 * @category 02-inventory
 * @synchronized 2025-11-14
 */

import { z } from 'zod';

import {
  uuid,
  money
} from '../../shared/base-schemas.js';

/**
 * Complete CommissionRules schema
 */
export const CommissionRulesSchema = z.object({
  rule_id: uuid,
  tenant_id: uuid,
  property_id: uuid.optional(),
  company_id: uuid.optional(),
  apply_to_all_agents: z.boolean().optional(),
  rule_name: z.string(),
  rule_description: z.string().optional(),
  rule_priority: z.number().int().optional(),
  applicable_booking_channels: z.array(z.string()).optional(),
  applicable_room_types: z.array(uuid).optional(),
  applicable_rate_codes: z.array(z.string()).optional(),
  applicable_market_segments: z.array(z.string()).optional(),
  effective_from: z.coerce.date(),
  effective_to: z.coerce.date().optional(),
  room_commission_rate: money.optional(),
  food_beverage_commission_rate: money.optional(),
  spa_commission_rate: money.optional(),
  other_commission_rate: money.optional(),
  overall_commission_rate: money.optional(),
  flat_commission_amount: money.optional(),
  tier_structure: z.record(z.unknown()).optional(),
  exclude_taxes: z.boolean().optional(),
  exclude_fees: z.boolean().optional(),
  exclude_deposits: z.boolean().optional(),
  is_active: z.boolean().optional(),
  notes: z.string().optional(),
  internal_notes: z.string().optional(),
  created_at: z.coerce.date().optional(),
  created_by: uuid.optional(),
  updated_at: z.coerce.date().optional(),
  updated_by: uuid.optional(),
});

export type CommissionRules = z.infer<typeof CommissionRulesSchema>;

/**
 * Schema for creating a new commission rules
 */
export const CreateCommissionRulesSchema = CommissionRulesSchema.omit({
  // TODO: Add fields to omit for creation
});

export type CreateCommissionRules = z.infer<typeof CreateCommissionRulesSchema>;

/**
 * Schema for updating a commission rules
 */
export const UpdateCommissionRulesSchema = CommissionRulesSchema.partial();

export type UpdateCommissionRules = z.infer<typeof UpdateCommissionRulesSchema>;
