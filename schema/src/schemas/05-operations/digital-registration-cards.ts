/**
 * DigitalRegistrationCards Schema
 * @table digital_registration_cards
 * @category 05-operations
 * @synchronized 2025-11-03
 */

import { z } from 'zod';
import { uuid } from '../../shared/base-schemas.js';

/**
 * Complete DigitalRegistrationCards schema
 */
export const DigitalRegistrationCardsSchema = z.object({
  registration_id: uuid,
  tenant_id: uuid,
  property_id: uuid,
  reservation_id: uuid,
  guest_id: uuid,
  mobile_checkin_id: uuid.optional(),
  registration_number: z.string(),
  registration_date: z.coerce.date(),
  registration_time: z.string(),
  guest_full_name: z.string(),
  guest_email: z.string().optional(),
  guest_phone: z.string().optional(),
  guest_date_of_birth: z.coerce.date().optional(),
  guest_nationality: z.string().optional(),
  id_type: z.string().optional(),
  id_number: z.string().optional(),
  id_issuing_country: z.string().optional(),
  id_issue_date: z.coerce.date().optional(),
  id_expiry_date: z.coerce.date().optional(),
  id_front_image_url: z.string().optional(),
  id_back_image_url: z.string().optional(),
  home_address: z.string().optional(),
  home_city: z.string().optional(),
  home_state: z.string().optional(),
  home_country: z.string().optional(),
  home_postal_code: z.string().optional(),
  arrival_date: z.coerce.date(),
  departure_date: z.coerce.date(),
  number_of_nights: z.number().int(),
  number_of_adults: z.number().int(),
  number_of_children: z.number().int().optional(),
  room_number: z.string().optional(),
  room_type: z.string().optional(),
  rate_code: z.string().optional(),
  companion_names: z.array(z.string()).optional(),
  companion_count: z.number().int().optional(),
  vehicle_make: z.string().optional(),
  vehicle_model: z.string().optional(),
  vehicle_color: z.string().optional(),
  vehicle_license_plate: z.string().optional(),
  parking_space_assigned: z.string().optional(),
  visit_purpose: z.string().optional(),
  company_name: z.string().optional(),
  guest_signature_url: z.string().optional(),
  signature_captured_at: z.coerce.date().optional(),
  signature_method: z.string().optional(),
  terms_and_conditions_url: z.string().optional(),
  privacy_policy_url: z.string().optional(),
  terms_accepted: z.boolean().optional(),
  privacy_accepted: z.boolean().optional(),
  marketing_consent: z.boolean().optional(),
  emergency_contact_name: z.string().optional(),
  emergency_contact_phone: z.string().optional(),
  emergency_contact_relationship: z.string().optional(),
  pdf_url: z.string().optional(),
  pdf_generated_at: z.coerce.date().optional(),
  verified: z.boolean().optional(),
  verified_by: uuid.optional(),
  verified_at: z.coerce.date().optional(),
  regulatory_compliance_status: z.string().optional(),
  government_reporting_submitted: z.boolean().optional(),
  government_reporting_date: z.coerce.date().optional(),
  special_notes: z.string().optional(),
  staff_notes: z.string().optional(),
  created_at: z.coerce.date().optional(),
  created_by: uuid.optional(),
  updated_at: z.coerce.date().optional(),
  updated_by: uuid.optional(),
});

export type DigitalRegistrationCards = z.infer<typeof DigitalRegistrationCardsSchema>;

/**
 * Schema for creating a new digital registration cards
 */
export const CreateDigitalRegistrationCardsSchema = DigitalRegistrationCardsSchema.omit({
  // TODO: Add fields to omit for creation
});

export type CreateDigitalRegistrationCards = z.infer<typeof CreateDigitalRegistrationCardsSchema>;

/**
 * Schema for updating a digital registration cards
 */
export const UpdateDigitalRegistrationCardsSchema = DigitalRegistrationCardsSchema.partial();

export type UpdateDigitalRegistrationCards = z.infer<typeof UpdateDigitalRegistrationCardsSchema>;
