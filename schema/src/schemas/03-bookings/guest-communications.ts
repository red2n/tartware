/**
 * GuestCommunications Schema
 * @table guest_communications
 * @category 03-bookings
 * @synchronized 2025-11-03
 */

import { z } from 'zod';
import { uuid } from '../../shared/base-schemas.js';

/**
 * Complete GuestCommunications schema
 */
export const GuestCommunicationsSchema = z.object({
  id: uuid,
  tenant_id: uuid,
  property_id: uuid,
  guest_id: uuid,
  reservation_id: uuid.optional(),
  template_id: uuid.optional(),
  communication_type: z.string(),
  direction: z.string(),
  subject: z.string().optional(),
  message: z.string(),
  sender_name: z.string().optional(),
  sender_email: z.string().optional(),
  sender_phone: z.string().optional(),
  recipient_name: z.string().optional(),
  recipient_email: z.string().optional(),
  recipient_phone: z.string().optional(),
  status: z.string().optional(),
  external_message_id: z.string().optional(),
  sent_at: z.coerce.date().optional(),
  delivered_at: z.coerce.date().optional(),
  opened_at: z.coerce.date().optional(),
  clicked_at: z.coerce.date().optional(),
  failed_at: z.coerce.date().optional(),
  failure_reason: z.string().optional(),
  attachments: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
  created_by: uuid.optional(),
  created_at: z.coerce.date().optional(),
  updated_at: z.coerce.date().optional(),
});

export type GuestCommunications = z.infer<typeof GuestCommunicationsSchema>;

/**
 * Schema for creating a new guest communications
 */
export const CreateGuestCommunicationsSchema = GuestCommunicationsSchema.omit({
  // TODO: Add fields to omit for creation
});

export type CreateGuestCommunications = z.infer<typeof CreateGuestCommunicationsSchema>;

/**
 * Schema for updating a guest communications
 */
export const UpdateGuestCommunicationsSchema = GuestCommunicationsSchema.partial();

export type UpdateGuestCommunications = z.infer<typeof UpdateGuestCommunicationsSchema>;
