/**
 * EventBookings Schema
 * @table event_bookings
 * @category 02-inventory
 * @synchronized 2025-11-03
 */

import { z } from 'zod';
import { uuid, money } from '../../shared/base-schemas.js';

/**
 * Complete EventBookings schema
 */
export const EventBookingsSchema = z.object({
  event_id: uuid,
  tenant_id: uuid,
  property_id: uuid,
  event_number: z.string().optional(),
  event_name: z.string(),
  event_type: z.string(),
  meeting_room_id: uuid,
  event_date: z.coerce.date(),
  start_time: z.string(),
  end_time: z.string(),
  setup_start_time: z.string().optional(),
  actual_start_time: z.string().optional(),
  actual_end_time: z.string().optional(),
  teardown_end_time: z.string().optional(),
  organizer_name: z.string(),
  organizer_company: z.string().optional(),
  organizer_email: z.string().optional(),
  organizer_phone: z.string().optional(),
  contact_person: z.string().optional(),
  contact_email: z.string().optional(),
  contact_phone: z.string().optional(),
  guest_id: uuid.optional(),
  reservation_id: uuid.optional(),
  company_id: uuid.optional(),
  group_booking_id: uuid.optional(),
  expected_attendees: z.number().int(),
  confirmed_attendees: z.number().int().optional(),
  actual_attendees: z.number().int().optional(),
  guarantee_number: z.number().int().optional(),
  setup_type: z.string(),
  setup_details: z.string().optional(),
  special_requests: z.string().optional(),
  setup_diagram_url: z.string().optional(),
  required_equipment: z.record(z.unknown()).optional(),
  av_requirements: z.record(z.unknown()).optional(),
  technical_contact_name: z.string().optional(),
  technical_contact_phone: z.string().optional(),
  catering_required: z.boolean().optional(),
  catering_service_type: z.string().optional(),
  food_beverage_minimum: money.optional(),
  menu_selections: z.record(z.unknown()).optional(),
  dietary_restrictions: z.string().optional(),
  bar_service_required: z.boolean().optional(),
  booking_status: z.string(),
  confirmation_status: z.string().optional(),
  payment_status: z.string().optional(),
  booked_date: z.coerce.date(),
  confirmed_date: z.coerce.date().optional(),
  beo_due_date: z.coerce.date().optional(),
  final_count_due_date: z.coerce.date().optional(),
  cancellation_deadline: z.coerce.date().optional(),
  decision_date: z.coerce.date().optional(),
  rental_rate: money.optional(),
  setup_fee: money.optional(),
  equipment_rental_fee: money.optional(),
  av_equipment_fee: money.optional(),
  labor_charges: money.optional(),
  service_charge_percent: money.optional(),
  tax_rate: money.optional(),
  estimated_food_beverage: money.optional(),
  estimated_total: money.optional(),
  actual_total: money.optional(),
  currency_code: z.string().optional(),
  deposit_required: money.optional(),
  deposit_paid: money.optional(),
  deposit_due_date: z.coerce.date().optional(),
  final_payment_due: z.coerce.date().optional(),
  contract_signed: z.boolean().optional(),
  contract_signed_date: z.coerce.date().optional(),
  contract_url: z.string().optional(),
  beo_pdf_url: z.string().optional(),
  floor_plan_url: z.string().optional(),
  folio_id: uuid.optional(),
  billing_instructions: z.string().optional(),
  billing_contact_name: z.string().optional(),
  billing_contact_email: z.string().optional(),
  payment_method: z.string().optional(),
  booking_source: z.string().optional(),
  lead_source: z.string().optional(),
  sales_manager_id: uuid.optional(),
  commission_rate: money.optional(),
  post_event_feedback: z.string().optional(),
  post_event_rating: z.number().int().optional(),
  issues_reported: z.string().optional(),
  followup_required: z.boolean().optional(),
  is_recurring: z.boolean().optional(),
  recurring_pattern: z.string().optional(),
  parent_event_id: uuid.optional(),
  series_id: uuid.optional(),
  security_required: z.boolean().optional(),
  insurance_required: z.boolean().optional(),
  insurance_certificate_url: z.string().optional(),
  liability_waiver_signed: z.boolean().optional(),
  internal_notes: z.string().optional(),
  public_notes: z.string().optional(),
  setup_notes: z.string().optional(),
  billing_notes: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date().optional(),
  created_by: uuid.optional(),
  updated_by: uuid.optional(),
  confirmed_by: uuid.optional(),
  is_deleted: z.boolean().optional(),
  deleted_at: z.coerce.date().optional(),
  deleted_by: uuid.optional(),
  version: z.bigint().optional(),
});

export type EventBookings = z.infer<typeof EventBookingsSchema>;

/**
 * Schema for creating a new event bookings
 */
export const CreateEventBookingsSchema = EventBookingsSchema.omit({
  // TODO: Add fields to omit for creation
});

export type CreateEventBookings = z.infer<typeof CreateEventBookingsSchema>;

/**
 * Schema for updating a event bookings
 */
export const UpdateEventBookingsSchema = EventBookingsSchema.partial();

export type UpdateEventBookings = z.infer<typeof UpdateEventBookingsSchema>;
