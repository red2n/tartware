/**
 * GroupBookings Schema
 * @table group_bookings
 * @category 02-inventory
 * @synchronized 2025-11-03
 */

import { z } from 'zod';
import { uuid, money } from '../../shared/base-schemas.js';

/**
 * Complete GroupBookings schema
 */
export const GroupBookingsSchema = z.object({
  group_booking_id: uuid,
  tenant_id: uuid,
  property_id: uuid,
  group_name: z.string(),
  group_code: z.string().optional(),
  group_type: z.string(),
  company_id: uuid.optional(),
  organization_name: z.string().optional(),
  event_name: z.string().optional(),
  event_type: z.string().optional(),
  contact_name: z.string(),
  contact_title: z.string().optional(),
  contact_email: z.string().optional(),
  contact_phone: z.string().optional(),
  contact_mobile: z.string().optional(),
  billing_contact_name: z.string().optional(),
  billing_contact_email: z.string().optional(),
  arrival_date: z.coerce.date(),
  departure_date: z.coerce.date(),
  number_of_nights: z.number().int().optional(),
  total_rooms_requested: z.number().int(),
  total_rooms_blocked: z.number().int().optional(),
  total_rooms_picked: z.number().int().optional(),
  total_rooms_confirmed: z.number().int().optional(),
  cutoff_date: z.coerce.date(),
  cutoff_days_before_arrival: z.number().int().optional(),
  release_unsold_rooms: z.boolean().optional(),
  block_status: z.string().optional(),
  rooming_list_received: z.boolean().optional(),
  rooming_list_received_date: z.coerce.date().optional(),
  rooming_list_deadline: z.coerce.date().optional(),
  rooming_list_format: z.string().optional(),
  master_folio_id: uuid.optional(),
  payment_method: z.string().optional(),
  deposit_amount: money.optional(),
  deposit_percentage: money.optional(),
  deposit_due_date: z.coerce.date().optional(),
  deposit_received: z.boolean().optional(),
  deposit_received_date: z.coerce.date().optional(),
  rate_type: z.string().optional(),
  commissionable: z.boolean().optional(),
  commission_percentage: money.optional(),
  complimentary_rooms: z.number().int().optional(),
  complimentary_ratio: z.string().optional(),
  meeting_space_required: z.boolean().optional(),
  catering_required: z.boolean().optional(),
  av_equipment_required: z.boolean().optional(),
  special_requests: z.string().optional(),
  dietary_restrictions: z.string().optional(),
  accessibility_requirements: z.string().optional(),
  vip_requirements: z.string().optional(),
  expected_arrival_pattern: z.record(z.unknown()).optional(),
  expected_departure_pattern: z.record(z.unknown()).optional(),
  average_length_of_stay: money.optional(),
  estimated_room_revenue: money.optional(),
  estimated_fb_revenue: money.optional(),
  estimated_meeting_revenue: money.optional(),
  estimated_total_revenue: money.optional(),
  actual_revenue: money.optional(),
  account_manager_id: uuid.optional(),
  sales_manager_id: uuid.optional(),
  booking_source: z.string().optional(),
  contract_signed: z.boolean().optional(),
  contract_signed_date: z.coerce.date().optional(),
  contract_document_url: z.string().optional(),
  beo_created: z.boolean().optional(),
  beo_document_url: z.string().optional(),
  cancellation_policy: z.string().optional(),
  cancellation_deadline: z.coerce.date().optional(),
  cancellation_penalty_percentage: money.optional(),
  cancellation_fee: money.optional(),
  confirmation_number: z.string().optional(),
  is_active: z.boolean().optional(),
  booking_confidence: z.string().optional(),
  notes: z.string().optional(),
  internal_notes: z.string().optional(),
  catering_notes: z.string().optional(),
  housekeeping_notes: z.string().optional(),
  created_at: z.coerce.date().optional(),
  created_by: uuid.optional(),
  updated_at: z.coerce.date().optional(),
  updated_by: uuid.optional(),
  is_deleted: z.boolean().optional(),
  deleted_at: z.coerce.date().optional(),
  deleted_by: uuid.optional(),
  version: z.bigint().optional(),
});

export type GroupBookings = z.infer<typeof GroupBookingsSchema>;

/**
 * Schema for creating a new group bookings
 */
export const CreateGroupBookingsSchema = GroupBookingsSchema.omit({
  // TODO: Add fields to omit for creation
});

export type CreateGroupBookings = z.infer<typeof CreateGroupBookingsSchema>;

/**
 * Schema for updating a group bookings
 */
export const UpdateGroupBookingsSchema = GroupBookingsSchema.partial();

export type UpdateGroupBookings = z.infer<typeof UpdateGroupBookingsSchema>;
