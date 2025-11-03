/**
 * GdsReservationQueue Schema
 * @table gds_reservation_queue
 * @category 06-integrations
 * @synchronized 2025-11-03
 */

import { z } from 'zod';
import { uuid, money } from '../../shared/base-schemas.js';

/**
 * Complete GdsReservationQueue schema
 */
export const GdsReservationQueueSchema = z.object({
  queue_id: uuid,
  gds_message_id: uuid,
  gds_connection_id: uuid,
  tenant_id: uuid,
  property_id: uuid.optional(),
  gds_confirmation_number: z.string(),
  crs_confirmation_number: z.string().optional(),
  pnr_locator: z.string().optional(),
  reservation_action: z.string(),
  arrival_date: z.coerce.date(),
  departure_date: z.coerce.date(),
  room_type_code: z.string().optional(),
  rate_plan_code: z.string().optional(),
  number_of_rooms: z.number().int().optional(),
  number_of_guests: z.number().int().optional(),
  guest_name: z.string().optional(),
  guest_email: z.string().optional(),
  guest_phone: z.string().optional(),
  loyalty_number: z.string().optional(),
  guarantee_type: z.string().optional(),
  payment_card_token: z.string().optional(),
  total_amount: money.optional(),
  currency: z.string().optional(),
  status: z.string(),
  processing_attempts: z.number().int().optional(),
  last_attempt_at: z.coerce.date().optional(),
  processed_reservation_id: uuid.optional(),
  failure_reason: z.string().optional(),
  created_at: z.coerce.date(),
  created_by: uuid.optional(),
  updated_at: z.coerce.date().optional(),
  updated_by: uuid.optional(),
});

export type GdsReservationQueue = z.infer<typeof GdsReservationQueueSchema>;

/**
 * Schema for creating a new gds reservation queue
 */
export const CreateGdsReservationQueueSchema = GdsReservationQueueSchema.omit({
  // TODO: Add fields to omit for creation
});

export type CreateGdsReservationQueue = z.infer<typeof CreateGdsReservationQueueSchema>;

/**
 * Schema for updating a gds reservation queue
 */
export const UpdateGdsReservationQueueSchema = GdsReservationQueueSchema.partial();

export type UpdateGdsReservationQueue = z.infer<typeof UpdateGdsReservationQueueSchema>;
