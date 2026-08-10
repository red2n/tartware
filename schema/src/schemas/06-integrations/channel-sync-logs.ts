/**
 * DEV DOC
 * Module: schemas/06-integrations/channel-sync-logs.ts
 * Description: ChannelSyncLogs Schema
 * Table: channel_sync_logs
 * Category: 06-integrations
 * Primary exports: ChannelSyncLogsSchema, CreateChannelSyncLogsSchema, UpdateChannelSyncLogsSchema
 * @table channel_sync_logs
 * @category 06-integrations
 * Ownership: Schema package
 */

/**
 * ChannelSyncLogs Schema
 * @table channel_sync_logs
 * @category 06-integrations
 * @synchronized 2026-08-10
 */

import { z } from "zod";

import { uuid } from "../../shared/base-schemas.js";

/**
 * Complete ChannelSyncLogs schema
 *
 * One row per channel/OTA sync run, so a retry is a new row rather than an
 * overwrite. The night audit reads the most recent runs per mapping to report
 * what failed overnight.
 */
export const ChannelSyncLogsSchema = z.object({
	sync_log_id: uuid,
	tenant_id: uuid,
	property_id: uuid.optional(),
	/** Owning mapping (channel_mappings.id). */
	channel_mapping_id: uuid.optional(),
	channel_name: z.string().max(100).optional(),
	/** inventory | rates | restrictions | reservations */
	sync_type: z.string().max(50),
	/** inbound (channel -> PMS) or outbound (PMS -> channel). */
	sync_direction: z.string().max(20).optional(),
	/** Mirrors the table's channel_sync_logs_status_check constraint. */
	sync_status: z.enum(["running", "succeeded", "failed", "partial"]),
	started_at: z.coerce.date(),
	completed_at: z.coerce.date().optional(),
	duration_ms: z.number().int().optional(),
	records_processed: z.number().int().optional(),
	records_created: z.number().int().optional(),
	records_updated: z.number().int().optional(),
	records_failed: z.number().int().optional(),
	error_message: z.string().optional(),
	/** User id, or scheduler/night-audit for automated runs. */
	triggered_by: z.string().max(100).optional(),
	payload: z.record(z.unknown()).optional(),
	created_at: z.coerce.date(),
	updated_at: z.coerce.date().optional(),
	is_deleted: z.boolean().optional(),
	deleted_at: z.coerce.date().optional(),
	deleted_by: uuid.optional(),
});

export type ChannelSyncLogs = z.infer<typeof ChannelSyncLogsSchema>;

/**
 * Schema for recording a new sync run
 *
 * The run starts before its outcome is known, so status and the counters carry
 * database defaults rather than being supplied by the caller.
 */
export const CreateChannelSyncLogsSchema = ChannelSyncLogsSchema.omit({
	sync_log_id: true,
	sync_status: true,
	started_at: true,
	created_at: true,
	updated_at: true,
});

export type CreateChannelSyncLogs = z.infer<typeof CreateChannelSyncLogsSchema>;

/**
 * Schema for updating a sync run
 */
export const UpdateChannelSyncLogsSchema = ChannelSyncLogsSchema.partial();

export type UpdateChannelSyncLogs = z.infer<typeof UpdateChannelSyncLogsSchema>;
