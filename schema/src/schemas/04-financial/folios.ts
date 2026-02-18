/**
 * DEV DOC
 * Module: schemas/04-financial/folios.ts
 * Description: Folios Schema
 * Table: folios
 * Category: 04-financial
 * Primary exports: FoliosSchema, CreateFoliosSchema, UpdateFoliosSchema
 * @table folios
 * @category 04-financial
 * Ownership: Schema package
 */

/**
 * Folios Schema
 * @table folios
 * @category 04-financial
 * @synchronized 2025-11-03
 */

import { z } from "zod";

import { money, uuid } from "../../shared/base-schemas.js";

/**
 * Complete Folios schema
 */
export const FoliosSchema = z.object({
	folio_id: uuid,
	tenant_id: uuid,
	property_id: uuid,
	folio_number: z.string(),
	folio_type: z.string(),
	folio_status: z.string(),
	reservation_id: uuid.optional(),
	guest_id: uuid.optional(),
	guest_name: z.string().optional(),
	company_name: z.string().optional(),
	company_reference: z.string().optional(),
	balance: money,
	total_charges: money,
	total_payments: money,
	total_credits: money,
	currency_code: z.string().optional(),
	billing_address_line1: z.string().optional(),
	billing_address_line2: z.string().optional(),
	billing_city: z.string().optional(),
	billing_state: z.string().optional(),
	billing_postal_code: z.string().optional(),
	billing_country: z.string().optional(),
	tax_exempt: z.boolean().optional(),
	tax_id: z.string().optional(),
	settled_at: z.coerce.date().optional(),
	settled_by: uuid.optional(),
	settlement_method: z.string().optional(),
	transferred_from_folio_id: uuid.optional(),
	transferred_to_folio_id: uuid.optional(),
	transferred_at: z.coerce.date().optional(),
	notes: z.string().optional(),
	internal_notes: z.string().optional(),
	reference_number: z.string().optional(),
	opened_at: z.coerce.date(),
	closed_at: z.coerce.date().optional(),
	is_deleted: z.boolean().optional(),
	deleted_at: z.coerce.date().optional(),
	deleted_by: uuid.optional(),
	created_at: z.coerce.date(),
	created_by: uuid,
	updated_at: z.coerce.date().optional(),
	updated_by: uuid.optional(),
});

export type Folios = z.infer<typeof FoliosSchema>;

/**
 * Schema for creating a new folios
 */
export const CreateFoliosSchema = FoliosSchema.omit({
	// TODO: Add fields to omit for creation
});

export type CreateFolios = z.infer<typeof CreateFoliosSchema>;

/**
 * Schema for updating a folios
 */
export const UpdateFoliosSchema = FoliosSchema.partial();

export type UpdateFolios = z.infer<typeof UpdateFoliosSchema>;
