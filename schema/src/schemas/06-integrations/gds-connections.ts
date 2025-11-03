/**
 * GdsConnections Schema
 * @table gds_connections
 * @category 06-integrations
 * @synchronized 2025-11-03
 */

import { z } from 'zod';
import { uuid } from '../../shared/base-schemas.js';

/**
 * Complete GdsConnections schema
 */
export const GdsConnectionsSchema = z.object({
  gds_connection_id: uuid,
  tenant_id: uuid,
  property_id: uuid.optional(),
  gds_provider: z.string(),
  profile_code: z.string(),
  pseudo_city_code: z.string().optional(),
  agency_code: z.string().optional(),
  office_id: z.string().optional(),
  connection_mode: z.string(),
  credentials: z.record(z.unknown()),
  endpoint_url: z.string().optional(),
  message_version: z.string().optional(),
  supports_availability: z.boolean().optional(),
  supports_rate_update: z.boolean().optional(),
  supports_reservation_push: z.boolean().optional(),
  supports_cancellation: z.boolean().optional(),
  supports_modifications: z.boolean().optional(),
  status: z.string(),
  last_connected_at: z.coerce.date().optional(),
  last_successful_sync: z.coerce.date().optional(),
  last_error_at: z.coerce.date().optional(),
  last_error_message: z.string().optional(),
  retry_backoff_seconds: z.number().int().optional(),
  created_at: z.coerce.date(),
  created_by: uuid.optional(),
  updated_at: z.coerce.date().optional(),
  updated_by: uuid.optional(),
  is_deleted: z.boolean().optional(),
  deleted_at: z.coerce.date().optional(),
  deleted_by: uuid.optional(),
});

export type GdsConnections = z.infer<typeof GdsConnectionsSchema>;

/**
 * Schema for creating a new gds connections
 */
export const CreateGdsConnectionsSchema = GdsConnectionsSchema.omit({
  // TODO: Add fields to omit for creation
});

export type CreateGdsConnections = z.infer<typeof CreateGdsConnectionsSchema>;

/**
 * Schema for updating a gds connections
 */
export const UpdateGdsConnectionsSchema = GdsConnectionsSchema.partial();

export type UpdateGdsConnections = z.infer<typeof UpdateGdsConnectionsSchema>;
