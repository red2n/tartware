/**
 * Guests Schema
 * @table guests
 * @category 01-core
 * @synchronized 2025-11-14
 */

import { z } from 'zod';
import {
  uuid,
  money
} from '../../shared/base-schemas.js';

/**
 * Complete Guests schema
 */
export const GuestsSchema = z.object({
  id: uuid,
  tenant_id: uuid,
  first_name: z.string(),
  last_name: z.string(),
  middle_name: z.string().optional(),
  title: z.string().optional(),
  date_of_birth: z.coerce.date().optional(),
  gender: z.string().optional(),
  nationality: z.string().optional(),
  email: z.string(),
  phone: z.string().optional(),
  secondary_phone: z.string().optional(),
  address: z.record(z.unknown()).optional(),
  id_type: z.string().optional(),
  id_number: z.string().optional(),
  passport_number: z.string().optional(),
  passport_expiry: z.coerce.date().optional(),
  company_name: z.string().optional(),
  company_tax_id: z.string().optional(),
  loyalty_tier: z.string().optional(),
  loyalty_points: z.number().int().optional(),
  vip_status: z.boolean().optional(),
  preferences: z.record(z.unknown()).optional(),
  marketing_consent: z.boolean().optional(),
  communication_preferences: z.record(z.unknown()).optional(),
  total_bookings: z.number().int().optional(),
  total_nights: z.number().int().optional(),
  total_revenue: money.optional(),
  last_stay_date: z.coerce.date().optional(),
  is_blacklisted: z.boolean().optional(),
  blacklist_reason: z.string().optional(),
  notes: z.string().optional(),
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

export type Guests = z.infer<typeof GuestsSchema>;

/**
 * Schema for creating a new guests
 */
export const CreateGuestsSchema = GuestsSchema.omit({
  // TODO: Add fields to omit for creation
});

export type CreateGuests = z.infer<typeof CreateGuestsSchema>;

/**
 * Schema for updating a guests
 */
export const UpdateGuestsSchema = GuestsSchema.partial();

export type UpdateGuests = z.infer<typeof UpdateGuestsSchema>;
