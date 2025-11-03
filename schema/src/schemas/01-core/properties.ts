/**
 * Property Schema - Hotel/property master data
 * @table properties
 * @category 01-core
 * @synchronized 2025-11-03
 */

import { z } from 'zod';

import {
  uuid,
  tenantId as tenantIdBase,
  email,
  phoneNumber,
  url,
  currencyCode,
  starRating,
  auditTimestamps,
  softDelete,
  jsonbMetadata,
  nonEmptyString,
  positiveInt,
  latitude,
  longitude,
} from '../../shared/base-schemas.js';

/**
 * Property address JSONB schema
 */
export const PropertyAddressSchema = z.object({
  street: z.string().min(1),
  city: z.string().min(1),
  state: z.string().min(1),
  postalCode: z.string().min(1),
  country: z.string().length(2),
  latitude: latitude.optional(),
  longitude: longitude.optional(),
});

/**
 * Property configuration JSONB schema
 */
export const PropertyConfigSchema = z.object({
  checkInTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .default('15:00'),
  checkOutTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .default('11:00'),
  amenities: z.array(z.string()).default([]),
  paymentMethods: z
    .array(z.enum(['cash', 'card', 'bank_transfer', 'digital_wallet']))
    .default(['cash', 'card', 'bank_transfer']),
  cancellationPolicy: z
    .object({
      hours: z.number().int().positive().default(24),
      penalty: z.number().min(0).max(100).default(0),
    })
    .default({ hours: 24, penalty: 0 }),
  policies: z.record(z.unknown()).default({}),
});

/**
 * Property integrations JSONB schema
 */
export const PropertyIntegrationsSchema = z.object({
  pms: z.record(z.unknown()).default({}),
  channelManager: z.record(z.unknown()).default({}),
  paymentGateway: z.record(z.unknown()).default({}),
  accounting: z.record(z.unknown()).default({}),
});

/**
 * Complete Property schema
 */
export const PropertySchema = z.object({
  id: uuid.describe('Primary key'),
  tenant_id: tenantIdBase.describe('Tenant reference'),
  property_name: nonEmptyString.max(255).describe('Property name'),
  property_code: nonEmptyString
    .max(50)
    .toUpperCase()
    .regex(/^[A-Z0-9-]+$/, 'Property code must be alphanumeric')
    .describe('Unique property code'),
  address: PropertyAddressSchema.describe('Property address'),
  phone: phoneNumber.optional().describe('Contact phone'),
  email: email.optional().describe('Contact email'),
  website: url.optional().describe('Property website'),
  property_type: z
    .enum(['hotel', 'resort', 'hostel', 'apartment', 'villa', 'motel', 'other'])
    .default('hotel')
    .describe('Property type'),
  star_rating: starRating.optional().describe('Star rating (1-5)'),
  total_rooms: positiveInt.default(0).describe('Total number of rooms'),
  tax_id: z.string().max(100).optional().describe('Tax ID'),
  license_number: z.string().max(100).optional().describe('Business license'),
  currency: currencyCode.default('USD').describe('Property currency'),
  timezone: z.string().default('UTC').describe('Property timezone'),
  config: PropertyConfigSchema.describe('Property configuration'),
  integrations: PropertyIntegrationsSchema.describe('Third-party integrations'),
  is_active: z.boolean().default(true).describe('Property active status'),
  metadata: jsonbMetadata,
  ...auditTimestamps,
  ...softDelete,
  version: z.bigint().default(BigInt(0)).describe('Optimistic locking version'),
});

export type Property = z.infer<typeof PropertySchema>;

/**
 * Schema for creating a new property
 */
export const CreatePropertySchema = PropertySchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
  created_by: true,
  updated_by: true,
  deleted_at: true,
  version: true,
});

export type CreateProperty = z.infer<typeof CreatePropertySchema>;

/**
 * Schema for updating a property
 */
export const UpdatePropertySchema = PropertySchema.omit({
  id: true,
  tenant_id: true, // Cannot change tenant
  created_at: true,
  created_by: true,
  deleted_at: true,
})
  .partial()
  .extend({
    id: uuid,
  });

export type UpdateProperty = z.infer<typeof UpdatePropertySchema>;

/**
 * Property with statistics (for API responses)
 */
export const PropertyWithStatsSchema = PropertySchema.extend({
  room_count: z.number().int().nonnegative().optional(),
  occupied_rooms: z.number().int().nonnegative().optional(),
  available_rooms: z.number().int().nonnegative().optional(),
  occupancy_rate: z.number().min(0).max(100).optional(),
  current_guests: z.number().int().nonnegative().optional(),
  todays_arrivals: z.number().int().nonnegative().optional(),
  todays_departures: z.number().int().nonnegative().optional(),
});

export type PropertyWithStats = z.infer<typeof PropertyWithStatsSchema>;
