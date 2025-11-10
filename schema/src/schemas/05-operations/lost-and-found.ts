/**
 * LostAndFound Schema
 * @table lost_and_found
 * @category 05-operations
 * @synchronized 2025-11-03
 */

import { z } from "zod";
import { uuid, money } from "../../shared/base-schemas.js";

/**
 * Complete LostAndFound schema
 */
export const LostAndFoundSchema = z.object({
	item_id: uuid,
	tenant_id: uuid,
	property_id: uuid,
	item_number: z.string().optional(),
	item_name: z.string(),
	item_description: z.string(),
	item_category: z.string(),
	item_subcategory: z.string().optional(),
	brand: z.string().optional(),
	model: z.string().optional(),
	color: z.string().optional(),
	size: z.string().optional(),
	distinguishing_features: z.string().optional(),
	serial_number: z.string().optional(),
	estimated_value: money.optional(),
	currency: z.string().optional(),
	is_valuable: z.boolean().optional(),
	is_perishable: z.boolean().optional(),
	found_date: z.coerce.date(),
	found_time: z.string().optional(),
	found_by: uuid.optional(),
	found_by_name: z.string().optional(),
	found_location: z.string(),
	room_number: z.string().optional(),
	room_id: uuid.optional(),
	floor_number: z.number().int().optional(),
	area_name: z.string().optional(),
	specific_location: z.string().optional(),
	guest_id: uuid.optional(),
	guest_name: z.string().optional(),
	guest_email: z.string().optional(),
	guest_phone: z.string().optional(),
	reservation_id: uuid.optional(),
	checkout_date: z.coerce.date().optional(),
	item_status: z.string().optional(),
	storage_location: z.string().optional(),
	storage_shelf: z.string().optional(),
	storage_bin: z.string().optional(),
	storage_date: z.coerce.date().optional(),
	stored_by: uuid.optional(),
	requires_secure_storage: z.boolean().optional(),
	secure_storage_location: z.string().optional(),
	is_locked: z.boolean().optional(),
	access_log: z.record(z.unknown()).optional(),
	has_photos: z.boolean().optional(),
	photo_urls: z.array(z.string()).optional(),
	photo_count: z.number().int().optional(),
	has_documents: z.boolean().optional(),
	document_urls: z.array(z.string()).optional(),
	claim_count: z.number().int().optional(),
	claimed: z.boolean().optional(),
	claimed_by_guest_id: uuid.optional(),
	claimed_by_name: z.string().optional(),
	claim_date: z.coerce.date().optional(),
	claim_time: z.string().optional(),
	verification_questions: z.record(z.unknown()).optional(),
	verification_passed: z.boolean().optional(),
	verified_by: uuid.optional(),
	verification_notes: z.string().optional(),
	returned: z.boolean().optional(),
	return_date: z.coerce.date().optional(),
	return_time: z.string().optional(),
	return_method: z.string().optional(),
	returned_to_name: z.string().optional(),
	returned_by: uuid.optional(),
	shipped: z.boolean().optional(),
	shipping_address: z.string().optional(),
	shipping_cost: money.optional(),
	tracking_number: z.string().optional(),
	shipping_carrier: z.string().optional(),
	shipping_date: z.coerce.date().optional(),
	delivery_confirmed: z.boolean().optional(),
	delivery_date: z.coerce.date().optional(),
	guest_notified: z.boolean().optional(),
	notification_sent_at: z.coerce.date().optional(),
	notification_method: z.string().optional(),
	notification_count: z.number().int().optional(),
	last_notification_at: z.coerce.date().optional(),
	guest_contacted: z.boolean().optional(),
	contact_attempts: z.number().int().optional(),
	last_contact_attempt_at: z.coerce.date().optional(),
	guest_response_received: z.boolean().optional(),
	guest_response: z.string().optional(),
	hold_until_date: z.coerce.date().optional(),
	days_in_storage: z.number().int().optional(),
	disposal_date: z.coerce.date().optional(),
	disposal_method: z.string().optional(),
	disposed: z.boolean().optional(),
	disposed_at: z.coerce.date().optional(),
	disposed_by: uuid.optional(),
	disposal_reason: z.string().optional(),
	disposal_notes: z.string().optional(),
	donated: z.boolean().optional(),
	donation_organization: z.string().optional(),
	donation_date: z.coerce.date().optional(),
	donation_receipt_number: z.string().optional(),
	pending_claims: z.record(z.unknown()).optional(),
	false_claims: z.number().int().optional(),
	multiple_claimants: z.boolean().optional(),
	handling_fee: money.optional(),
	storage_fee: money.optional(),
	return_fee: money.optional(),
	fees_collected: money.optional(),
	fees_waived: z.boolean().optional(),
	insurance_claim_filed: z.boolean().optional(),
	insurance_claim_number: z.string().optional(),
	insurance_payout: money.optional(),
	requires_special_handling: z.boolean().optional(),
	special_handling_instructions: z.string().optional(),
	hazardous_material: z.boolean().optional(),
	fragile: z.boolean().optional(),
	internal_notes: z.string().optional(),
	staff_comments: z.string().optional(),
	guest_feedback: z.string().optional(),
	requires_manager_approval: z.boolean().optional(),
	manager_approved: z.boolean().optional(),
	approved_by: uuid.optional(),
	approved_at: z.coerce.date().optional(),
	related_items: z.array(uuid).optional(),
	is_part_of_set: z.boolean().optional(),
	set_description: z.string().optional(),
	metadata: z.record(z.unknown()).optional(),
	tags: z.array(z.string()).optional(),
	created_at: z.coerce.date().optional(),
	updated_at: z.coerce.date().optional(),
	created_by: uuid.optional(),
	updated_by: uuid.optional(),
	is_deleted: z.boolean().optional(),
	deleted_at: z.coerce.date().optional(),
	deleted_by: uuid.optional(),
});

export type LostAndFound = z.infer<typeof LostAndFoundSchema>;

/**
 * Schema for creating a new lost and found
 */
export const CreateLostAndFoundSchema = LostAndFoundSchema.omit({
	// TODO: Add fields to omit for creation
});

export type CreateLostAndFound = z.infer<typeof CreateLostAndFoundSchema>;

/**
 * Schema for updating a lost and found
 */
export const UpdateLostAndFoundSchema = LostAndFoundSchema.partial();

export type UpdateLostAndFound = z.infer<typeof UpdateLostAndFoundSchema>;
