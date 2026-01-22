/**
 * DEV DOC
 * Module: schemas/05-operations/qr-codes.ts
 * Description: QrCodes Schema
 * Table: qr_codes
 * Category: 05-operations
 * Primary exports: QrCodesSchema, CreateQrCodesSchema, UpdateQrCodesSchema
 * @table qr_codes
 * @category 05-operations
 * Ownership: Schema package
 */

/**
 * QrCodes Schema
 * @table qr_codes
 * @category 05-operations
 * @synchronized 2025-11-03
 */

import { z } from "zod";

import { uuid } from "../../shared/base-schemas.js";

/**
 * Complete QrCodes schema
 */
export const QrCodesSchema = z.object({
	qr_code_id: uuid,
	tenant_id: uuid,
	property_id: uuid,
	code_value: z.string(),
	code_type: z.string(),
	target_url: z.string().optional(),
	qr_data: z.record(z.unknown()).optional(),
	is_active: z.boolean().optional(),
	scan_count: z.number().int().optional(),
	last_scanned_at: z.coerce.date().optional(),
	valid_from: z.coerce.date().optional(),
	valid_to: z.coerce.date().optional(),
	location: z.string().optional(),
	room_id: uuid.optional(),
	metadata: z.record(z.unknown()).optional(),
	created_at: z.coerce.date().optional(),
	updated_at: z.coerce.date().optional(),
	created_by: uuid.optional(),
	updated_by: uuid.optional(),
	is_deleted: z.boolean().optional(),
	deleted_at: z.coerce.date().optional(),
	deleted_by: uuid.optional(),
});

export type QrCodes = z.infer<typeof QrCodesSchema>;

/**
 * Schema for creating a new qr codes
 */
export const CreateQrCodesSchema = QrCodesSchema.omit({
	// TODO: Add fields to omit for creation
});

export type CreateQrCodes = z.infer<typeof CreateQrCodesSchema>;

/**
 * Schema for updating a qr codes
 */
export const UpdateQrCodesSchema = QrCodesSchema.partial();

export type UpdateQrCodes = z.infer<typeof UpdateQrCodesSchema>;
