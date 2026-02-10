/**
 * DEV DOC
 * Module: schemas/02-inventory/rates.ts
 * Description: Rates Schema
 * Table: rates
 * Category: 02-inventory
 * Primary exports: RatesSchema, CreateRatesSchema, UpdateRatesSchema
 * @table rates
 * @category 02-inventory
 * Ownership: Schema package
 */

/**
 * Rates Schema
 * @table rates
 * @category 02-inventory
 * @synchronized 2025-11-14
 */

import { z } from 'zod';

import {
  uuid,
  money
} from '../../shared/base-schemas.js';
import { RateStrategyEnum, RateStatusEnum, RateTypeEnum } from '../../shared/enums.js';

/**
 * Complete Rates schema
 */
export const RatesSchema = z.object({
  id: uuid,
  tenant_id: uuid,
  property_id: uuid,
  room_type_id: uuid,
  rate_name: z.string(),
  rate_code: z.string(),
  description: z.string().optional(),
  rate_type: RateTypeEnum.default('BAR'),
  strategy: RateStrategyEnum,
  priority: z.number().int().min(0).max(999).default(100),
  base_rate: money,
  currency: z.string().optional(),
  single_occupancy_rate: money.optional(),
  double_occupancy_rate: money.optional(),
  extra_person_rate: money.optional(),
  extra_child_rate: money.optional(),
  valid_from: z.coerce.date(),
  valid_until: z.coerce.date().optional(),
  advance_booking_days_min: z.number().int().optional(),
  advance_booking_days_max: z.number().int().optional(),
  min_length_of_stay: z.number().int().optional(),
  max_length_of_stay: z.number().int().optional(),
  closed_to_arrival: z.boolean().optional(),
  closed_to_departure: z.boolean().optional(),
  meal_plan: z.string().optional(),
  meal_plan_cost: money.optional(),
  cancellation_policy: z.record(z.unknown()).optional(),
  modifiers: z.record(z.unknown()).optional(),
  channels: z.record(z.unknown()).optional(),
  customer_segments: z.record(z.unknown()).optional(),
  tax_inclusive: z.boolean().optional(),
  tax_rate: money.optional(),
  early_checkin_fee: money.optional(),
  late_checkout_fee: money.optional(),
  early_checkin_cutoff_hour: z.number().int().min(0).max(23).default(14),
  late_checkout_cutoff_hour: z.number().int().min(0).max(23).default(11),
  status: RateStatusEnum,
  display_order: z.number().int().optional(),
  metadata: z.record(z.unknown()).optional(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date().optional(),
  created_by: z.string().optional(),
  updated_by: z.string().optional(),
  is_deleted: z.boolean().optional(),
  deleted_at: z.coerce.date().optional(),
  deleted_by: z.string().optional(),
  version: z.bigint().optional(),
});

export type Rates = z.infer<typeof RatesSchema>;

/**
 * Schema for creating a new rate
 * Omits auto-generated and audit fields
 */
export const CreateRatesSchema = RatesSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
  created_by: true,
  updated_by: true,
  is_deleted: true,
  deleted_at: true,
  deleted_by: true,
  version: true,
});

export type CreateRates = z.infer<typeof CreateRatesSchema>;

/**
 * Schema for updating a rate
 */
export const UpdateRatesSchema = RatesSchema.partial().extend({
  tenant_id: uuid,
});

export type UpdateRates = z.infer<typeof UpdateRatesSchema>;

/**
 * API response schema for rate items
 * Uses string types for dates and version (JSON serialization friendly)
 */
export const RateItemSchema = z.object({
  id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  property_id: z.string().uuid(),
  room_type_id: z.string().uuid(),
  rate_name: z.string(),
  rate_code: z.string(),
  description: z.string().optional(),
  rate_type: z.string(),
  strategy: z.string(),
  priority: z.number().int(),
  base_rate: z.number(),
  currency: z.string().optional(),
  single_occupancy_rate: z.number().optional(),
  double_occupancy_rate: z.number().optional(),
  extra_person_rate: z.number().optional(),
  extra_child_rate: z.number().optional(),
  valid_from: z.string(),
  valid_until: z.string().optional(),
  advance_booking_days_min: z.number().int().optional(),
  advance_booking_days_max: z.number().int().optional(),
  min_length_of_stay: z.number().int().optional(),
  max_length_of_stay: z.number().int().optional(),
  closed_to_arrival: z.boolean().optional(),
  closed_to_departure: z.boolean().optional(),
  meal_plan: z.string().optional(),
  meal_plan_cost: z.number().optional(),
  cancellation_policy: z.unknown().optional(),
  modifiers: z.unknown().optional(),
  channels: z.unknown().optional(),
  customer_segments: z.unknown().optional(),
  tax_inclusive: z.boolean().optional(),
  tax_rate: z.number().optional(),
  early_checkin_fee: z.number().optional(),
  late_checkout_fee: z.number().optional(),
  early_checkin_cutoff_hour: z.number().int().optional(),
  late_checkout_cutoff_hour: z.number().int().optional(),
  status: z.string(),
  display_order: z.number().int().optional(),
  metadata: z.unknown().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  version: z.string().optional(),
});

export type RateItem = z.infer<typeof RateItemSchema>;
