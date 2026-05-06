import { z } from "zod";

// ─── GL Chart of Accounts ────────────────────────────────────────────────────

export const GlAccountTypeSchema = z.enum(["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"]);
export type GlAccountType = z.infer<typeof GlAccountTypeSchema>;

export const GlNormalBalanceSchema = z.enum(["DEBIT", "CREDIT"]);
export type GlNormalBalance = z.infer<typeof GlNormalBalanceSchema>;

/**
 * USALI Chart of Accounts entry.
 * Maps GL account codes to their classification, type, and financial reporting line.
 */
export const GlChartOfAccountsSchema = z.object({
  gl_account_id: z.string().uuid(),
  tenant_id: z.string().uuid(),
  account_code: z.string().min(1).max(20),
  account_name: z.string().min(1).max(100),
  account_type: GlAccountTypeSchema,
  normal_balance: GlNormalBalanceSchema,
  usali_category: z.string().max(100).nullable(),
  usali_section: z.string().max(50).nullable(),
  financial_line: z.string().max(100).nullable(),
  parent_account_code: z.string().max(20).nullable(),
  display_order: z.number().int().default(0),
  is_active: z.boolean().default(true),
  is_system: z.boolean().default(false),
  is_deleted: z.boolean().default(false),
  deleted_at: z.string().datetime().nullable(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime().nullable(),
});

export type GlChartOfAccounts = z.infer<typeof GlChartOfAccountsSchema>;

export const GlChartOfAccountsCreateSchema = GlChartOfAccountsSchema.omit({
  gl_account_id: true,
  created_at: true,
  updated_at: true,
  is_deleted: true,
  deleted_at: true,
});

export type GlChartOfAccountsCreate = z.infer<typeof GlChartOfAccountsCreateSchema>;
