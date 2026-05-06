import { z } from "zod";

// ─── Charge Code → GL Mapping ────────────────────────────────────────────────

/**
 * Maps a PMS charge code to its USALI GL debit/credit accounts.
 * Used by the GL batch builder to produce double-entry journal lines.
 *
 * debit_account  — normally the Guest Ledger (1100)
 * credit_account — the revenue or liability account (e.g. 4000 Rooms Revenue)
 * For void/reversal the debit/credit sides are swapped by the batch builder.
 */
export const ChargeCodeGlMappingSchema = z.object({
  mapping_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  charge_code: z.string().min(1).max(50),
  debit_account: z.string().min(1).max(20),
  credit_account: z.string().min(1).max(20),
  usali_category: z.string().max(100).nullable(),
  department_code: z.string().max(20).nullable(),
  is_active: z.boolean().default(true),
  is_deleted: z.boolean().default(false),
  deleted_at: z.string().datetime().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime().nullable(),
});

export type ChargeCodeGlMapping = z.infer<typeof ChargeCodeGlMappingSchema>;

export const ChargeCodeGlMappingCreateSchema = ChargeCodeGlMappingSchema.omit({
  mapping_id: true,
  created_at: true,
  updated_at: true,
  is_deleted: true,
  deleted_at: true,
});

export type ChargeCodeGlMappingCreate = z.infer<typeof ChargeCodeGlMappingCreateSchema>;
