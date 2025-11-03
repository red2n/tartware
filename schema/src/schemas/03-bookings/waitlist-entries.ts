/**
 * WaitlistEntries Schema
 * @table waitlist_entries
 * @category 03-bookings
 * @synchronized 2025-11-03
 */

import { z } from 'zod';
import { uuid } from '../../shared/base-schemas.js';

/**
 * Complete WaitlistEntries schema
 */
export const WaitlistEntriesSchema = z.object({
  waitlist_id: uuid,
  tenant_id: uuid,
  property_id: uuid,
  guest_id: uuid.optional(),
  reservation_id: uuid.optional(),
  requested_room_type_id: uuid.optional(),
  requested_rate_id: uuid.optional(),
  arrival_date: z.coerce.date(),
  departure_date: z.coerce.date(),
  nights: z.number().int().optional(),
  number_of_rooms: z.number().int().optional(),
  number_of_adults: z.number().int().optional(),
  number_of_children: z.number().int().optional(),
  flexibility: z.string().optional(),
  waitlist_status: z.string(),
  priority_score: z.number().int().optional(),
  vip_flag: z.boolean().optional(),
  notes: z.string().optional(),
  last_notified_at: z.coerce.date().optional(),
  last_notified_via: z.string().optional(),
  offer_expiration_at: z.coerce.date().optional(),
  offer_response: z.string().optional(),
  offer_response_at: z.coerce.date().optional(),
  created_at: z.coerce.date(),
  created_by: uuid.optional(),
  updated_at: z.coerce.date().optional(),
  updated_by: uuid.optional(),
  is_deleted: z.boolean().optional(),
  deleted_at: z.coerce.date().optional(),
  deleted_by: uuid.optional(),
});

export type WaitlistEntries = z.infer<typeof WaitlistEntriesSchema>;

/**
 * Schema for creating a new waitlist entries
 */
export const CreateWaitlistEntriesSchema = WaitlistEntriesSchema.omit({
  // TODO: Add fields to omit for creation
});

export type CreateWaitlistEntries = z.infer<typeof CreateWaitlistEntriesSchema>;

/**
 * Schema for updating a waitlist entries
 */
export const UpdateWaitlistEntriesSchema = WaitlistEntriesSchema.partial();

export type UpdateWaitlistEntries = z.infer<typeof UpdateWaitlistEntriesSchema>;
