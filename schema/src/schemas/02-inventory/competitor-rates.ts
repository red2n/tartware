/**
 * CompetitorRates Schema
 * @table competitor_rates
 * @category 02-inventory
 * @synchronized 2025-11-14
 */

import { z } from 'zod';
import {
  uuid,
  money
} from '../../shared/base-schemas.js';

/**
 * Complete CompetitorRates schema
 */
export const CompetitorRatesSchema = z.object({
  rate_id: uuid,
  tenant_id: uuid,
  property_id: uuid,
  competitor_property_name: z.string(),
  competitor_property_id: z.string().optional(),
  competitor_brand: z.string().optional(),
  competitor_star_rating: money.optional(),
  check_date: z.coerce.date(),
  stay_date: z.coerce.date(),
  nights: z.number().int().optional(),
  room_type_category: z.string().optional(),
  room_size_sqm: z.number().int().optional(),
  bed_type: z.string().optional(),
  max_occupancy: z.number().int().optional(),
  competitor_rate: money,
  currency: z.string(),
  rate_type: z.string().optional(),
  includes_breakfast: z.boolean().optional(),
  includes_parking: z.boolean().optional(),
  includes_wifi: z.boolean().optional(),
  includes_cancellation: z.boolean().optional(),
  cancellation_policy: z.string().optional(),
  taxes_included: z.boolean().optional(),
  tax_amount: money.optional(),
  fees_amount: money.optional(),
  total_price: money.optional(),
  is_available: z.boolean().optional(),
  rooms_left: z.number().int().optional(),
  availability_status: z.string().optional(),
  source_channel: z.string(),
  source_url: z.string().optional(),
  scrape_method: z.string().optional(),
  scrape_timestamp: z.coerce.date(),
  our_property_rate: money.optional(),
  our_property_room_type_id: uuid.optional(),
  rate_difference: money.optional(),
  rate_difference_percent: money.optional(),
  is_cheaper_than_us: z.boolean().optional(),
  is_more_expensive_than_us: z.boolean().optional(),
  price_position: z.string().optional(),
  market_average_rate: money.optional(),
  deviation_from_market_avg: money.optional(),
  deviation_from_market_avg_percent: money.optional(),
  value_score: money.optional(),
  amenities_score: money.optional(),
  location_score: money.optional(),
  overall_competitiveness_score: money.optional(),
  review_rating: money.optional(),
  review_count: z.number().int().optional(),
  recent_review_trend: z.string().optional(),
  distance_from_our_property_km: money.optional(),
  location_area: z.string().optional(),
  is_same_neighborhood: z.boolean().optional(),
  booking_urgency_indicator: z.string().optional(),
  viewed_count: z.number().int().optional(),
  booking_trend: z.string().optional(),
  has_special_offer: z.boolean().optional(),
  special_offer_description: z.string().optional(),
  promotion_end_date: z.coerce.date().optional(),
  data_confidence_score: money.optional(),
  data_source_reliability: z.string().optional(),
  needs_verification: z.boolean().optional(),
  verified_by: uuid.optional(),
  verified_at: z.coerce.date().optional(),
  alert_if_below_our_rate: z.boolean().optional(),
  alert_if_difference_exceeds_percent: money.optional(),
  alert_triggered: z.boolean().optional(),
  alert_sent_at: z.coerce.date().optional(),
  previous_rate: money.optional(),
  rate_change_amount: money.optional(),
  rate_change_percent: money.optional(),
  rate_change_direction: z.string().optional(),
  raw_data: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
  tags: z.array(z.string()).optional(),
  notes: z.string().optional(),
  created_at: z.coerce.date().optional(),
  updated_at: z.coerce.date().optional(),
  created_by: uuid.optional(),
  updated_by: uuid.optional(),
  is_deleted: z.boolean().optional(),
  deleted_at: z.coerce.date().optional(),
  deleted_by: uuid.optional(),
});

export type CompetitorRates = z.infer<typeof CompetitorRatesSchema>;

/**
 * Schema for creating a new competitor rates
 */
export const CreateCompetitorRatesSchema = CompetitorRatesSchema.omit({
  // TODO: Add fields to omit for creation
});

export type CreateCompetitorRates = z.infer<typeof CreateCompetitorRatesSchema>;

/**
 * Schema for updating a competitor rates
 */
export const UpdateCompetitorRatesSchema = CompetitorRatesSchema.partial();

export type UpdateCompetitorRates = z.infer<typeof UpdateCompetitorRatesSchema>;
