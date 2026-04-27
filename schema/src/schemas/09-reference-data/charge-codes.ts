/**
 * DEV DOC
 * Module: schemas/09-reference-data/charge-codes.ts
 * Description: Charge Codes Schema — tenant-scoped PMS charge codes with
 *   department categorization following USALI guidelines.
 * Table: charge_codes
 * Category: 09-reference-data
 * Primary exports: ChargeCodesSchema, CreateChargeCodeSchema, UpdateChargeCodeSchema
 * @table charge_codes
 * @category 09-reference-data
 * Ownership: Schema package
 */

/**
 * Charge Codes Schema
 * Standard PMS charge codes with department categorization (USALI).
 * Composite PK: (tenant_id, code).
 *
 * @table charge_codes
 * @category 09-reference-data
 * @synchronized 2026-04-27
 */

import { z } from "zod";

import { uuid } from "../../shared/base-schemas.js";

// ─── Full Row Schema ─────────────────────────────────────────────────────────

export const ChargeCodesSchema = z.object({
	tenant_id: uuid,
	code: z.string().min(1).max(50),
	description: z.string().min(1).max(255),
	department_code: z.string().min(1).max(20),
	department_name: z.string().min(1).max(100),
	revenue_group: z.string().max(50).default("OTHER"),
	is_taxable: z.boolean().default(true),
	is_active: z.boolean().default(true),
	display_order: z.number().int().default(0),
	created_at: z.coerce.date().default(() => new Date()),
});

export type ChargeCode = z.infer<typeof ChargeCodesSchema>;

// ─── Create Schema ───────────────────────────────────────────────────────────

export const CreateChargeCodeSchema = ChargeCodesSchema.omit({
	created_at: true,
});

export type CreateChargeCodeInput = z.infer<typeof CreateChargeCodeSchema>;

// ─── Update Schema ───────────────────────────────────────────────────────────

export const UpdateChargeCodeSchema = ChargeCodesSchema.omit({
	tenant_id: true,
	code: true,
	created_at: true,
}).partial();

export type UpdateChargeCodeInput = z.infer<typeof UpdateChargeCodeSchema>;
