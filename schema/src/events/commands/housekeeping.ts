/**
 * DEV DOC
 * Module: events/commands/housekeeping.ts
 * Purpose: Shared schema/type definitions and validation helpers.
 * Ownership: Schema package
 */

import { z } from "zod";

import { HousekeepingStatusEnum } from "../../shared/enums.js";

export const HousekeepingAssignCommandSchema = z.object({
	task_id: z.string().uuid(),
	assigned_to: z.string().uuid(),
	priority: z.string().max(20).optional(),
	notes: z.string().max(2000).optional(),
	metadata: z.record(z.unknown()).optional(),
});

export type HousekeepingAssignCommand = z.infer<
	typeof HousekeepingAssignCommandSchema
>;

export const HousekeepingCompleteCommandSchema = z.object({
	task_id: z.string().uuid(),
	completed_by: z.string().uuid().optional(),
	notes: z.string().max(2000).optional(),
	inspection: z
		.object({
			inspected_by: z.string().uuid().optional(),
			passed: z.boolean().optional(),
			notes: z.string().max(2000).optional(),
		})
		.optional(),
	metadata: z.record(z.unknown()).optional(),
});

export type HousekeepingCompleteCommand = z.infer<
	typeof HousekeepingCompleteCommandSchema
>;

export const HousekeepingTaskCreateCommandSchema = z.object({
	property_id: z.string().uuid(),
	room_id: z.string().uuid().optional(),
	task_type: z.string().min(2).max(50),
	scheduled_date: z.coerce.date().optional(),
	assigned_to: z.string().uuid().optional(),
	priority: z.string().max(20).optional(),
	notes: z.string().max(2000).optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type HousekeepingTaskCreateCommand = z.infer<
	typeof HousekeepingTaskCreateCommandSchema
>;

export const HousekeepingTaskReassignCommandSchema = z.object({
	task_id: z.string().uuid(),
	assigned_to: z.string().uuid(),
	reason: z.string().max(500).optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type HousekeepingTaskReassignCommand = z.infer<
	typeof HousekeepingTaskReassignCommandSchema
>;

export const HousekeepingTaskReopenCommandSchema = z.object({
	task_id: z.string().uuid(),
	reason: z.string().max(500).optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type HousekeepingTaskReopenCommand = z.infer<
	typeof HousekeepingTaskReopenCommandSchema
>;

export const HousekeepingTaskAddNoteCommandSchema = z.object({
	task_id: z.string().uuid(),
	note: z.string().min(1).max(2000),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type HousekeepingTaskAddNoteCommand = z.infer<
	typeof HousekeepingTaskAddNoteCommandSchema
>;

export const HousekeepingTaskBulkStatusCommandSchema = z.object({
	task_ids: z.array(z.string().uuid()).min(1),
	status: HousekeepingStatusEnum,
	notes: z.string().max(2000).optional(),
	metadata: z.record(z.unknown()).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type HousekeepingTaskBulkStatusCommand = z.infer<
	typeof HousekeepingTaskBulkStatusCommandSchema
>;
