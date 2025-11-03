/**
 * PackageBookings Schema
 * @table package_bookings
 * @category 02-inventory
 * @synchronized 2025-11-03
 */

import { z } from 'zod';
import { uuid, money } from '../../shared/base-schemas.js';

/**
 * Complete PackageBookings schema
 */
export const PackageBookingsSchema = z.object({
  package_booking_id: uuid,
  package_id: uuid,
  reservation_id: uuid,
  package_price: money,
  number_of_nights: z.number().int(),
  number_of_adults: z.number().int(),
  number_of_children: z.number().int().optional(),
  total_amount: money,
  selected_components: z.record(z.unknown()).optional(),
  component_modifications: z.record(z.unknown()).optional(),
  components_delivered: z.record(z.unknown()).optional(),
  fully_delivered: z.boolean().optional(),
  status: z.string().optional(),
  special_requests: z.string().optional(),
  notes: z.string().optional(),
  created_at: z.coerce.date().optional(),
  created_by: uuid.optional(),
  updated_at: z.coerce.date().optional(),
  updated_by: uuid.optional(),
});

export type PackageBookings = z.infer<typeof PackageBookingsSchema>;

/**
 * Schema for creating a new package bookings
 */
export const CreatePackageBookingsSchema = PackageBookingsSchema.omit({
  // TODO: Add fields to omit for creation
});

export type CreatePackageBookings = z.infer<typeof CreatePackageBookingsSchema>;

/**
 * Schema for updating a package bookings
 */
export const UpdatePackageBookingsSchema = PackageBookingsSchema.partial();

export type UpdatePackageBookings = z.infer<typeof UpdatePackageBookingsSchema>;
