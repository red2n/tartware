/**
 * ContactlessRequests Schema
 * @table contactless_requests
 * @category 05-operations
 * @synchronized 2025-11-03
 */

import { z } from 'zod';
import { uuid, money } from '../../shared/base-schemas.js';

/**
 * Complete ContactlessRequests schema
 */
export const ContactlessRequestsSchema = z.object({
  request_id: uuid,
  tenant_id: uuid,
  property_id: uuid,
  guest_id: uuid,
  reservation_id: uuid.optional(),
  room_id: uuid.optional(),
  request_type: z.string(),
  request_category: z.string().optional(),
  request_title: z.string(),
  request_description: z.string().optional(),
  urgency: z.string().optional(),
  request_channel: z.string(),
  qr_code_scanned: z.boolean().optional(),
  qr_code_location: z.string().optional(),
  requested_at: z.coerce.date().optional(),
  preferred_service_time: z.coerce.date().optional(),
  assigned_to: uuid.optional(),
  assigned_at: z.coerce.date().optional(),
  department: z.string().optional(),
  status: z.string().optional(),
  acknowledged_at: z.coerce.date().optional(),
  acknowledged_by: uuid.optional(),
  started_at: z.coerce.date().optional(),
  completed_at: z.coerce.date().optional(),
  response_time_minutes: z.number().int().optional(),
  resolution_time_minutes: z.number().int().optional(),
  service_delivered: z.boolean().optional(),
  delivery_method: z.string().optional(),
  delivery_photo_url: z.string().optional(),
  delivery_signature_url: z.string().optional(),
  guest_notified: z.boolean().optional(),
  notification_method: z.string().optional(),
  notification_sent_at: z.coerce.date().optional(),
  guest_satisfaction_rating: z.number().int().optional(),
  guest_feedback: z.string().optional(),
  feedback_submitted_at: z.coerce.date().optional(),
  staff_notes: z.string().optional(),
  completion_notes: z.string().optional(),
  service_charge: money.optional(),
  add_to_folio: z.boolean().optional(),
  session_id: z.string().optional(),
  notes: z.string().optional(),
  created_at: z.coerce.date().optional(),
  created_by: uuid.optional(),
  updated_at: z.coerce.date().optional(),
  updated_by: uuid.optional(),
});

export type ContactlessRequests = z.infer<typeof ContactlessRequestsSchema>;

/**
 * Schema for creating a new contactless requests
 */
export const CreateContactlessRequestsSchema = ContactlessRequestsSchema.omit({
  // TODO: Add fields to omit for creation
});

export type CreateContactlessRequests = z.infer<typeof CreateContactlessRequestsSchema>;

/**
 * Schema for updating a contactless requests
 */
export const UpdateContactlessRequestsSchema = ContactlessRequestsSchema.partial();

export type UpdateContactlessRequests = z.infer<typeof UpdateContactlessRequestsSchema>;
