/**
 * DEV DOC
 * Module: api/housekeeping.ts
 * Purpose: Housekeeping API response schemas
 * Ownership: Schema package
 */

import { z } from "zod";

import { uuid } from "../shared/base-schemas.js";

/**
 * Housekeeping task list item schema for API responses.
 * Includes display fields derived from enum values.
 */
export const HousekeepingTaskListItemSchema = z.object({
	id: uuid,
	tenant_id: uuid,
	property_id: uuid,
	property_name: z.string().optional(),
	room_number: z.string(),
	task_type: z.string(),
	priority: z.string().optional(),
	status: z.string(),
	status_display: z.string(),
	assigned_to: uuid.optional(),
	assigned_at: z.string().optional(),
	scheduled_date: z.string(),
	scheduled_time: z.string().optional(),
	started_at: z.string().optional(),
	completed_at: z.string().optional(),
	inspected_by: uuid.optional(),
	inspected_at: z.string().optional(),
	inspection_passed: z.boolean().optional(),
	is_guest_request: z.boolean(),
	special_instructions: z.string().optional(),
	notes: z.string().optional(),
	issues_found: z.string().optional(),
	credits: z.number().optional(),
	metadata: z.record(z.unknown()).optional(),
	created_at: z.string(),
	updated_at: z.string().optional(),
	version: z.string(),
});

export type HousekeepingTaskListItem = z.infer<typeof HousekeepingTaskListItemSchema>;

/**
 * Housekeeping task list response schema.
 */
export const HousekeepingTaskListResponseSchema = z.object({
	data: z.array(HousekeepingTaskListItemSchema),
	meta: z.object({
		count: z.number().int().nonnegative(),
	}),
});

export type HousekeepingTaskListResponse = z.infer<typeof HousekeepingTaskListResponseSchema>;
