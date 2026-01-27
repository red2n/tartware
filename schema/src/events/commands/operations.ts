/**
 * DEV DOC
 * Module: events/commands/operations.ts
 * Purpose: Shared schema/type definitions and validation helpers.
 * Ownership: Schema package
 */

import { z } from "zod";

export const OperationsMaintenanceRequestCommandSchema = z.object({
	property_id: z.string().uuid(),
	room_id: z.string().uuid().optional(),
	issue_category: z.string().min(2).max(100),
	issue_description: z.string().min(2).max(2000),
	priority: z.string().max(20).optional(),
	reported_by: z.string().uuid().optional(),
	reported_at: z.coerce.date().optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type OperationsMaintenanceRequestCommand = z.infer<
	typeof OperationsMaintenanceRequestCommandSchema
>;

export const OperationsIncidentReportCommandSchema = z.object({
	property_id: z.string().uuid(),
	incident_type: z.string().min(2).max(100),
	description: z.string().min(2).max(2000),
	reported_by: z.string().uuid().optional(),
	occurred_at: z.coerce.date().optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type OperationsIncidentReportCommand = z.infer<
	typeof OperationsIncidentReportCommandSchema
>;

export const OperationsAssetUpdateCommandSchema = z
	.object({
		asset_id: z.string().uuid(),
		status: z.string().max(50).optional(),
		location: z.string().max(200).optional(),
		notes: z.string().max(2000).optional(),
		metadata: z.record(z.unknown()).optional(),
		idempotency_key: z.string().max(120).optional(),
	})
	.refine(
		(value) => Boolean(value.status || value.location || value.notes),
		"status, location, or notes is required",
	);

export type OperationsAssetUpdateCommand = z.infer<
	typeof OperationsAssetUpdateCommandSchema
>;

export const OperationsInventoryAdjustCommandSchema = z.object({
	property_id: z.string().uuid(),
	item_id: z.string().uuid(),
	delta_quantity: z.coerce.number(),
	reason: z.string().max(500).optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type OperationsInventoryAdjustCommand = z.infer<
	typeof OperationsInventoryAdjustCommandSchema
>;
