/**
 * BanquetEventOrders Schema
 * @table banquet_event_orders
 * @category 02-inventory
 * @synchronized 2025-11-14
 */

import { z } from 'zod';

import {
  uuid,
  money
} from '../../shared/base-schemas.js';

/**
 * Complete BanquetEventOrders schema
 */
export const BanquetEventOrdersSchema = z.object({
  beo_id: uuid,
  tenant_id: uuid,
  property_id: uuid,
  event_booking_id: uuid,
  beo_number: z.string(),
  beo_version: z.number().int().optional(),
  beo_status: z.string(),
  revision_date: z.coerce.date().optional(),
  revision_reason: z.string().optional(),
  previous_beo_id: uuid.optional(),
  event_date: z.coerce.date(),
  setup_start_time: z.string(),
  event_start_time: z.string(),
  event_end_time: z.string(),
  teardown_end_time: z.string().optional(),
  room_release_time: z.string().optional(),
  meeting_room_id: uuid,
  room_setup: z.string(),
  tables_count: z.number().int().optional(),
  chairs_count: z.number().int().optional(),
  table_configuration: z.string().optional(),
  seating_chart_layout_url: z.string().optional(),
  guaranteed_count: z.number().int(),
  expected_count: z.number().int().optional(),
  over_set_percentage: money.optional(),
  actual_count: z.number().int().optional(),
  menu_type: z.string().optional(),
  menu_items: z.record(z.unknown()).optional(),
  service_style: z.string().optional(),
  courses_count: z.number().int().optional(),
  meal_service_start_time: z.string().optional(),
  meal_service_duration_minutes: z.number().int().optional(),
  appetizers: z.record(z.unknown()).optional(),
  salads: z.record(z.unknown()).optional(),
  entrees: z.record(z.unknown()).optional(),
  sides: z.record(z.unknown()).optional(),
  desserts: z.record(z.unknown()).optional(),
  stations: z.record(z.unknown()).optional(),
  bar_type: z.string().optional(),
  bar_start_time: z.string().optional(),
  bar_end_time: z.string().optional(),
  bar_setup_location: z.string().optional(),
  beverages: z.record(z.unknown()).optional(),
  wine_service: z.record(z.unknown()).optional(),
  coffee_tea_service: z.boolean().optional(),
  water_service: z.string().optional(),
  vegetarian_count: z.number().int().optional(),
  vegan_count: z.number().int().optional(),
  gluten_free_count: z.number().int().optional(),
  dairy_free_count: z.number().int().optional(),
  nut_free_count: z.number().int().optional(),
  kosher_count: z.number().int().optional(),
  halal_count: z.number().int().optional(),
  special_diets: z.record(z.unknown()).optional(),
  linen_color: z.string().optional(),
  linen_type: z.string().optional(),
  napkin_color: z.string().optional(),
  napkin_fold: z.string().optional(),
  table_skirting: z.boolean().optional(),
  centerpieces: z.string().optional(),
  decor_description: z.string().optional(),
  candles: z.boolean().optional(),
  floral_arrangements: z.string().optional(),
  equipment_list: z.record(z.unknown()).optional(),
  av_equipment: z.record(z.unknown()).optional(),
  stage_required: z.boolean().optional(),
  stage_dimensions: z.string().optional(),
  podium_required: z.boolean().optional(),
  dance_floor_required: z.boolean().optional(),
  special_lighting: z.boolean().optional(),
  lighting_notes: z.string().optional(),
  servers_count: z.number().int().optional(),
  bartenders_count: z.number().int().optional(),
  chefs_count: z.number().int().optional(),
  captains_count: z.number().int().optional(),
  coat_check_attendants: z.number().int().optional(),
  valet_attendants: z.number().int().optional(),
  security_guards: z.number().int().optional(),
  staff_arrival_time: z.string().optional(),
  staff_meal_time: z.string().optional(),
  staff_break_schedule: z.string().optional(),
  overtime_authorized: z.boolean().optional(),
  food_subtotal: money.optional(),
  beverage_subtotal: money.optional(),
  equipment_rental_total: money.optional(),
  labor_charges: money.optional(),
  service_charge_percent: money.optional(),
  service_charge_amount: money.optional(),
  gratuity_percent: money.optional(),
  gratuity_amount: money.optional(),
  tax_percent: money.optional(),
  tax_amount: money.optional(),
  total_estimated: money.optional(),
  total_actual: money.optional(),
  currency_code: z.string().optional(),
  billing_type: z.string().optional(),
  price_per_person: money.optional(),
  children_price: money.optional(),
  children_count: z.number().int().optional(),
  kitchen_instructions: z.string().optional(),
  service_instructions: z.string().optional(),
  setup_instructions: z.string().optional(),
  cleanup_instructions: z.string().optional(),
  audio_visual_instructions: z.string().optional(),
  client_approved: z.boolean().optional(),
  client_approved_date: z.coerce.date().optional(),
  client_approved_by: z.string().optional(),
  client_signature_url: z.string().optional(),
  chef_approved: z.boolean().optional(),
  chef_approved_date: z.coerce.date().optional(),
  chef_approved_by: uuid.optional(),
  manager_approved: z.boolean().optional(),
  manager_approved_date: z.coerce.date().optional(),
  manager_approved_by: uuid.optional(),
  setup_completed: z.boolean().optional(),
  setup_completed_time: z.coerce.date().optional(),
  event_started: z.boolean().optional(),
  event_started_time: z.coerce.date().optional(),
  event_ended: z.boolean().optional(),
  event_ended_time: z.coerce.date().optional(),
  teardown_completed: z.boolean().optional(),
  teardown_completed_time: z.coerce.date().optional(),
  post_event_notes: z.string().optional(),
  issues_encountered: z.string().optional(),
  client_satisfaction_rating: z.number().int().optional(),
  photos: z.record(z.unknown()).optional(),
  last_sent_to_client: z.coerce.date().optional(),
  last_sent_to_kitchen: z.coerce.date().optional(),
  last_sent_to_setup: z.coerce.date().optional(),
  distribution_list: z.array(z.string()).optional(),
  signed_beo_url: z.string().optional(),
  floor_plan_url: z.string().optional(),
  seating_chart_document_url: z.string().optional(),
  menu_card_url: z.string().optional(),
  internal_notes: z.string().optional(),
  client_notes: z.string().optional(),
  allergy_warnings: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date().optional(),
  created_by: uuid.optional(),
  updated_by: uuid.optional(),
  is_deleted: z.boolean().optional(),
  deleted_at: z.coerce.date().optional(),
  deleted_by: uuid.optional(),
  version: z.bigint().optional(),
});

export type BanquetEventOrders = z.infer<typeof BanquetEventOrdersSchema>;

/**
 * Schema for creating a new banquet event orders
 */
export const CreateBanquetEventOrdersSchema = BanquetEventOrdersSchema.omit({
  // TODO: Add fields to omit for creation
});

export type CreateBanquetEventOrders = z.infer<typeof CreateBanquetEventOrdersSchema>;

/**
 * Schema for updating a banquet event orders
 */
export const UpdateBanquetEventOrdersSchema = BanquetEventOrdersSchema.partial();

export type UpdateBanquetEventOrders = z.infer<typeof UpdateBanquetEventOrdersSchema>;
