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
import { RateStrategyEnum, RateStatusEnum } from '../../shared/enums.js';

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
  strategy: RateStrategyEnum,
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
 * Schema for creating a new rates
 */
export const CreateRatesSchema = RatesSchema.omit({
  // TODO: Add fields to omit for creation
});

export type CreateRates = z.infer<typeof CreateRatesSchema>;

/**
 * Schema for updating a rates
 */
export const UpdateRatesSchema = RatesSchema.partial();

export type UpdateRates = z.infer<typeof UpdateRatesSchema>;
