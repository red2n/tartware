/**
 * DEV DOC
 * Module: schemas/05-operations/call-records.ts
 * Description: Call Records Schema
 * Table: call_records
 * Category: 05-operations
 * Primary exports: CallRecordsSchema, CreateCallRecordsSchema, UpdateCallRecordsSchema
 * @table call_records
 * @category 05-operations
 * Ownership: Schema package
 */

/**
 * Call Records Schema
 * Individual telephone call detail records from PBX — tracks duration, cost, and folio posting
 * @table call_records
 * @category 05-operations
 */

import { z } from "zod";

import { money, uuid } from "../../shared/base-schemas.js";

/** Direction of the phone call */
export const callDirectionEnum = z.enum(["INBOUND", "OUTBOUND", "INTERNAL"]);
export type CallDirection = z.infer<typeof callDirectionEnum>;

/** Classification of call type for billing purposes */
export const callTypeEnum = z.enum([
	"LOCAL",
	"NATIONAL",
	"INTERNATIONAL",
	"TOLL_FREE",
	"PREMIUM",
	"INTERNAL",
	"EMERGENCY",
	"WAKEUP",
	"VOICEMAIL",
]);
export type CallType = z.infer<typeof callTypeEnum>;

/** Outcome status of the call */
export const callStatusEnum = z.enum([
	"COMPLETED",
	"MISSED",
	"BUSY",
	"NO_ANSWER",
	"FAILED",
	"BLOCKED",
]);
export type CallStatus = z.infer<typeof callStatusEnum>;

/**
 * Complete Call Records schema
 */
export const CallRecordsSchema = z.object({
	call_id: uuid,
	tenant_id: uuid,
	property_id: uuid,

	// PBX Reference
	pbx_config_id: uuid.optional(),
	pbx_call_id: z.string().max(100).optional(),

	// Room & Guest
	room_id: uuid.optional(),
	room_number: z.string().max(20).optional(),
	reservation_id: uuid.optional(),
	guest_id: uuid.optional(),

	// Extension
	extension_number: z.string().max(20).optional(),
	trunk_line: z.string().max(50).optional(),

	// Call Details
	call_direction: callDirectionEnum,
	call_type: callTypeEnum,
	dialed_number: z.string().max(50).optional(),
	caller_id: z.string().max(50).optional(),
	call_started_at: z.coerce.date(),
	call_answered_at: z.coerce.date().optional(),
	call_ended_at: z.coerce.date().optional(),
	duration_seconds: z.number().int().min(0).default(0),
	billable_seconds: z.number().int().min(0).default(0),

	// Call Status
	call_status: callStatusEnum.default("COMPLETED"),
	is_answered: z.boolean().default(false),

	// Billing
	rate_per_minute: z.number().min(0).default(0),
	base_cost: money.default(0),
	service_charge: money.default(0),
	total_charge: money.default(0),
	currency_code: z.string().max(3).default("USD"),
	is_billable: z.boolean().default(true),
	is_posted: z.boolean().default(false),
	posted_at: z.coerce.date().optional(),
	folio_id: uuid.optional(),
	charge_posting_id: uuid.optional(),

	// Wake-Up Call
	is_wakeup_call: z.boolean().default(false),
	wakeup_scheduled_time: z.string().optional(), // TIME type as string "HH:MM"
	wakeup_attempt_number: z.number().int().positive().optional(),
	wakeup_confirmed: z.boolean().optional(),

	// Audit
	created_at: z.coerce.date(),
	updated_at: z.coerce.date().optional(),

	// Soft Delete
	is_deleted: z.boolean().default(false),
	deleted_at: z.coerce.date().optional(),
	deleted_by: uuid.optional(),
});

export type CallRecords = z.infer<typeof CallRecordsSchema>;

/**
 * Schema for creating a new call record
 */
export const CreateCallRecordsSchema = CallRecordsSchema.omit({
	call_id: true,
	created_at: true,
	updated_at: true,
	is_deleted: true,
	deleted_at: true,
	deleted_by: true,
});

export type CreateCallRecords = z.infer<typeof CreateCallRecordsSchema>;

/**
 * Schema for updating a call record
 */
export const UpdateCallRecordsSchema = CallRecordsSchema.partial().omit({
	call_id: true,
	tenant_id: true,
	created_at: true,
});

export type UpdateCallRecords = z.infer<typeof UpdateCallRecordsSchema>;
