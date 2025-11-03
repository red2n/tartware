/**
 * GuestNotes Schema
 * @table guest_notes
 * @category 03-bookings
 * @synchronized 2025-11-03
 */

import { z } from 'zod';
import { uuid, money } from '../../shared/base-schemas.js';

/**
 * Complete GuestNotes schema
 */
export const GuestNotesSchema = z.object({
  note_id: uuid,
  tenant_id: uuid,
  property_id: uuid,
  guest_id: uuid,
  reservation_id: uuid.optional(),
  note_type: z.string(),
  note_category: z.string().optional(),
  severity: z.string().optional(),
  priority: z.string().optional(),
  subject: z.string().optional(),
  note_text: z.string(),
  is_alert: z.boolean().optional(),
  alert_level: z.string().optional(),
  alert_trigger: z.array(z.string()).optional(),
  show_on_reservation: z.boolean().optional(),
  show_on_checkin: z.boolean().optional(),
  show_on_checkout: z.boolean().optional(),
  show_at_pos: z.boolean().optional(),
  show_at_frontdesk: z.boolean().optional(),
  show_in_housekeeping: z.boolean().optional(),
  is_private: z.boolean().optional(),
  is_internal_only: z.boolean().optional(),
  visible_to_roles: z.array(z.string()).optional(),
  visible_to_departments: z.array(z.string()).optional(),
  hide_from_guest: z.boolean().optional(),
  requires_action: z.boolean().optional(),
  action_required: z.string().optional(),
  action_deadline: z.coerce.date().optional(),
  assigned_to: uuid.optional(),
  assigned_department: z.string().optional(),
  status: z.string().optional(),
  is_resolved: z.boolean().optional(),
  resolved_at: z.coerce.date().optional(),
  resolved_by: uuid.optional(),
  resolution_notes: z.string().optional(),
  resolution_action_taken: z.string().optional(),
  requires_followup: z.boolean().optional(),
  followup_date: z.coerce.date().optional(),
  followup_completed: z.boolean().optional(),
  followup_notes: z.string().optional(),
  guest_satisfaction_impact: z.string().optional(),
  compensation_provided: z.boolean().optional(),
  compensation_amount: money.optional(),
  compensation_type: z.string().optional(),
  created_by: uuid,
  created_by_name: z.string().optional(),
  created_by_role: z.string().optional(),
  created_at: z.coerce.date().optional(),
  updated_by: uuid.optional(),
  updated_at: z.coerce.date().optional(),
  acknowledged_by: uuid.optional(),
  acknowledged_at: z.coerce.date().optional(),
  parent_note_id: uuid.optional(),
  related_note_ids: z.array(uuid).optional(),
  has_attachments: z.boolean().optional(),
  attachment_count: z.number().int().optional(),
  attachment_references: z.record(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
  tags: z.array(z.string()).optional(),
  is_deleted: z.boolean().optional(),
  deleted_at: z.coerce.date().optional(),
  deleted_by: uuid.optional(),
});

export type GuestNotes = z.infer<typeof GuestNotesSchema>;

/**
 * Schema for creating a new guest notes
 */
export const CreateGuestNotesSchema = GuestNotesSchema.omit({
  // TODO: Add fields to omit for creation
});

export type CreateGuestNotes = z.infer<typeof CreateGuestNotesSchema>;

/**
 * Schema for updating a guest notes
 */
export const UpdateGuestNotesSchema = GuestNotesSchema.partial();

export type UpdateGuestNotes = z.infer<typeof UpdateGuestNotesSchema>;
