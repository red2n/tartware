/**
 * DEV DOC
 * Module: events/commands/groups.ts
 * Purpose: Zod schemas for group booking command payloads.
 * Ownership: Schema package
 */

import { z } from "zod";

/* ------------------------------------------------------------------ */
/*  group.create                                                      */
/* ------------------------------------------------------------------ */

/**
 * Create a new group booking with initial block request.
 * Inserts into `group_bookings` with status INQUIRY or TENTATIVE.
 */
export const GroupCreateCommandSchema = z.object({
	property_id: z.string().uuid(),
	group_name: z.string().min(1).max(255),
	group_type: z.enum([
		"conference",
		"wedding",
		"corporate",
		"tour_group",
		"sports_team",
		"reunion",
		"convention",
		"government",
		"airline_crew",
		"educational",
		"other",
	]),
	company_id: z.string().uuid().optional(),
	organization_name: z.string().max(255).optional(),
	contact_name: z.string().min(1).max(255),
	contact_email: z.string().email().max(255).optional(),
	contact_phone: z.string().max(50).optional(),
	arrival_date: z.coerce.date(),
	departure_date: z.coerce.date(),
	total_rooms_requested: z.coerce.number().int().positive(),
	cutoff_date: z.coerce.date().optional(),
	cutoff_days_before_arrival: z.coerce.number().int().min(0).optional(),
	block_status: z
		.enum(["inquiry", "tentative", "definite"])
		.optional()
		.default("tentative"),
	rate_type: z
		.enum(["group_rate", "negotiated", "contracted", "special", "rack"])
		.optional(),
	negotiated_rate: z.coerce.number().nonnegative().optional(),
	payment_method: z
		.enum([
			"direct_bill",
			"credit_card",
			"deposit",
			"prepaid",
			"individual_pay",
			"mixed",
		])
		.optional(),
	deposit_amount: z.coerce.number().nonnegative().optional(),
	deposit_due_date: z.coerce.date().optional(),
	complimentary_rooms: z.coerce.number().int().nonnegative().optional(),
	complimentary_ratio: z.string().max(20).optional(),
	meeting_space_required: z.boolean().optional(),
	catering_required: z.boolean().optional(),
	cancellation_policy: z.string().max(2000).optional(),
	cancellation_deadline: z.coerce.date().optional(),
	notes: z.string().max(2000).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type GroupCreateCommand = z.infer<typeof GroupCreateCommandSchema>;

/* ------------------------------------------------------------------ */
/*  group.add_rooms                                                   */
/* ------------------------------------------------------------------ */

const RoomBlockEntrySchema = z.object({
	room_type_id: z.string().uuid(),
	block_date: z.coerce.date(),
	blocked_rooms: z.coerce.number().int().positive(),
	negotiated_rate: z.coerce.number().nonnegative(),
	rack_rate: z.coerce.number().nonnegative().optional(),
	discount_percentage: z.coerce.number().min(0).max(100).optional(),
});

/**
 * Add or update room block allocations for a group by date + room type.
 * Uses UPSERT on the unique (group_booking_id, room_type_id, block_date) index.
 */
export const GroupAddRoomsCommandSchema = z.object({
	group_booking_id: z.string().uuid(),
	blocks: z.array(RoomBlockEntrySchema).min(1).max(365),
	idempotency_key: z.string().max(120).optional(),
});

export type GroupAddRoomsCommand = z.infer<typeof GroupAddRoomsCommandSchema>;

/* ------------------------------------------------------------------ */
/*  group.upload_rooming_list                                         */
/* ------------------------------------------------------------------ */

const RoomingListGuestSchema = z.object({
	guest_name: z.string().min(1).max(255),
	guest_email: z.string().email().max(255).optional(),
	guest_phone: z.string().max(50).optional(),
	room_type_id: z.string().uuid(),
	arrival_date: z.coerce.date(),
	departure_date: z.coerce.date(),
	sharing_with: z.string().max(255).optional(),
	payment_method: z.string().max(50).optional(),
	special_requests: z.string().max(500).optional(),
	vip: z.boolean().optional(),
});

/**
 * Upload a rooming list to create individual reservations from a group block.
 * Each guest entry creates a reservation linked to the group, decrementing
 * available rooms from the matching block row.
 */
export const GroupUploadRoomingListCommandSchema = z.object({
	group_booking_id: z.string().uuid(),
	guests: z.array(RoomingListGuestSchema).min(1).max(500),
	rooming_list_format: z
		.enum(["excel", "csv", "pdf", "portal", "api", "email"])
		.optional()
		.default("api"),
	idempotency_key: z.string().max(120).optional(),
});

export type GroupUploadRoomingListCommand = z.infer<
	typeof GroupUploadRoomingListCommandSchema
>;

/* ------------------------------------------------------------------ */
/*  group.cutoff_enforce                                              */
/* ------------------------------------------------------------------ */

/**
 * Scheduled / background command to enforce cutoff dates.
 * Finds all group_bookings whose cutoff_date <= business_date and
 * releases unsold rooms from blocks back to general inventory.
 * Optionally calculates attrition fees.
 */
export const GroupCutoffEnforceCommandSchema = z.object({
	property_id: z.string().uuid(),
	business_date: z.coerce.date().optional(),
	dry_run: z.boolean().optional().default(false),
	idempotency_key: z.string().max(120).optional(),
});

export type GroupCutoffEnforceCommand = z.infer<
	typeof GroupCutoffEnforceCommandSchema
>;

/* ------------------------------------------------------------------ */
/*  group.billing.setup                                               */
/* ------------------------------------------------------------------ */

const RoutingRuleSchema = z.object({
	charge_type: z.string().min(1).max(50),
	target: z.enum(["master", "individual"]),
});

/**
 * Create a master folio for the group and configure charge-routing rules.
 * Master folios aggregate room & tax charges while individual folios
 * handle incidentals by default.
 */
export const GroupBillingSetupCommandSchema = z.object({
	group_booking_id: z.string().uuid(),
	payment_method: z
		.enum([
			"direct_bill",
			"credit_card",
			"deposit",
			"prepaid",
			"individual_pay",
			"mixed",
		])
		.optional(),
	billing_contact_name: z.string().max(255).optional(),
	billing_contact_email: z.string().email().max(255).optional(),
	billing_contact_phone: z.string().max(50).optional(),
	routing_rules: z.array(RoutingRuleSchema).optional(),
	tax_exempt: z.boolean().optional(),
	tax_id: z.string().max(50).optional(),
	idempotency_key: z.string().max(120).optional(),
});

export type GroupBillingSetupCommand = z.infer<
	typeof GroupBillingSetupCommandSchema
>;
