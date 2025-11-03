/**
 * MeetingRooms Schema
 * @table meeting_rooms
 * @category 02-inventory
 * @synchronized 2025-11-03
 */

import { z } from 'zod';
import { uuid, money } from '../../shared/base-schemas.js';

/**
 * Complete MeetingRooms schema
 */
export const MeetingRoomsSchema = z.object({
  room_id: uuid,
  tenant_id: uuid,
  property_id: uuid,
  room_code: z.string(),
  room_name: z.string(),
  room_type: z.string(),
  building: z.string().optional(),
  floor: z.number().int().optional(),
  location_description: z.string().optional(),
  max_capacity: z.number().int(),
  theater_capacity: z.number().int().optional(),
  classroom_capacity: z.number().int().optional(),
  banquet_capacity: z.number().int().optional(),
  reception_capacity: z.number().int().optional(),
  u_shape_capacity: z.number().int().optional(),
  hollow_square_capacity: z.number().int().optional(),
  boardroom_capacity: z.number().int().optional(),
  area_sqm: money.optional(),
  area_sqft: money.optional(),
  length_meters: money.optional(),
  width_meters: money.optional(),
  height_meters: money.optional(),
  ceiling_height_meters: money.optional(),
  has_natural_light: z.boolean().optional(),
  has_windows: z.boolean().optional(),
  has_stage: z.boolean().optional(),
  has_dance_floor: z.boolean().optional(),
  has_audio_visual: z.boolean().optional(),
  has_projector: z.boolean().optional(),
  has_screen: z.boolean().optional(),
  has_microphones: z.boolean().optional(),
  has_sound_system: z.boolean().optional(),
  has_wifi: z.boolean().optional(),
  has_video_conferencing: z.boolean().optional(),
  has_whiteboard: z.boolean().optional(),
  has_flipchart: z.boolean().optional(),
  has_podium: z.boolean().optional(),
  has_climate_control: z.boolean().optional(),
  wheelchair_accessible: z.boolean().optional(),
  has_loading_dock: z.boolean().optional(),
  has_separate_entrance: z.boolean().optional(),
  parking_spaces: z.number().int().optional(),
  elevator_access: z.boolean().optional(),
  default_setup: z.string().optional(),
  setup_time_minutes: z.number().int().optional(),
  teardown_time_minutes: z.number().int().optional(),
  turnover_time_minutes: z.number().int().optional(),
  hourly_rate: money.optional(),
  half_day_rate: money.optional(),
  full_day_rate: money.optional(),
  minimum_rental_hours: z.number().int().optional(),
  overtime_rate_per_hour: money.optional(),
  currency_code: z.string().optional(),
  operating_hours_start: z.string().optional(),
  operating_hours_end: z.string().optional(),
  available_days: z.array(z.string()).optional(),
  blackout_dates: z.array(z.coerce.date()).optional(),
  room_status: z.string(),
  is_active: z.boolean().optional(),
  included_equipment: z.record(z.unknown()).optional(),
  available_equipment: z.record(z.unknown()).optional(),
  furniture_inventory: z.record(z.unknown()).optional(),
  floor_plan_url: z.string().optional(),
  layout_diagrams: z.record(z.unknown()).optional(),
  virtual_tour_url: z.string().optional(),
  primary_photo_url: z.string().optional(),
  photo_gallery: z.record(z.unknown()).optional(),
  marketing_description: z.string().optional(),
  amenities_description: z.string().optional(),
  noise_restrictions: z.boolean().optional(),
  alcohol_allowed: z.boolean().optional(),
  smoking_allowed: z.boolean().optional(),
  food_restrictions: z.string().optional(),
  decoration_policy: z.string().optional(),
  cancellation_policy: z.string().optional(),
  catering_required: z.boolean().optional(),
  external_catering_allowed: z.boolean().optional(),
  kitchen_access: z.boolean().optional(),
  bar_service_available: z.boolean().optional(),
  power_outlets: z.number().int().optional(),
  network_ports: z.number().int().optional(),
  lighting_zones: z.number().int().optional(),
  voltage: z.string().optional(),
  amp_capacity: z.number().int().optional(),
  min_advance_booking_hours: z.number().int().optional(),
  max_advance_booking_days: z.number().int().optional(),
  requires_approval: z.boolean().optional(),
  auto_confirm: z.boolean().optional(),
  internal_notes: z.string().optional(),
  guest_facing_notes: z.string().optional(),
  setup_instructions: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date().optional(),
  created_by: uuid.optional(),
  updated_by: uuid.optional(),
  is_deleted: z.boolean().optional(),
  deleted_at: z.coerce.date().optional(),
  deleted_by: uuid.optional(),
  version: z.bigint().optional(),
});

export type MeetingRooms = z.infer<typeof MeetingRoomsSchema>;

/**
 * Schema for creating a new meeting rooms
 */
export const CreateMeetingRoomsSchema = MeetingRoomsSchema.omit({
  // TODO: Add fields to omit for creation
});

export type CreateMeetingRooms = z.infer<typeof CreateMeetingRoomsSchema>;

/**
 * Schema for updating a meeting rooms
 */
export const UpdateMeetingRoomsSchema = MeetingRoomsSchema.partial();

export type UpdateMeetingRooms = z.infer<typeof UpdateMeetingRoomsSchema>;
