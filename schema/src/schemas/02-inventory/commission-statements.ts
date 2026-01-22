/**
 * DEV DOC
 * Module: schemas/02-inventory/commission-statements.ts
 * Description: CommissionStatements Schema
 * Table: commission_statements
 * Category: 02-inventory
 * Primary exports: CommissionStatementsSchema, CreateCommissionStatementsSchema, UpdateCommissionStatementsSchema
 * @table commission_statements
 * @category 02-inventory
 * Ownership: Schema package
 */

/**
 * CommissionStatements Schema
 * @table commission_statements
 * @category 02-inventory
 * @synchronized 2025-11-14
 */

import { z } from 'zod';

import {
  uuid,
  money
} from '../../shared/base-schemas.js';

/**
 * Complete CommissionStatements schema
 */
export const CommissionStatementsSchema = z.object({
  statement_id: uuid,
  tenant_id: uuid,
  property_id: uuid.optional(),
  company_id: uuid,
  statement_number: z.string(),
  statement_date: z.coerce.date(),
  period_start_date: z.coerce.date(),
  period_end_date: z.coerce.date(),
  total_bookings: z.number().int().optional(),
  total_room_nights: z.number().int().optional(),
  total_revenue: money.optional(),
  total_gross_commission: money.optional(),
  total_adjustments: money.optional(),
  total_deductions: money.optional(),
  total_net_commission: money.optional(),
  payment_status: z.string().optional(),
  payment_method: z.string().optional(),
  payment_date: z.coerce.date().optional(),
  payment_reference: z.string().optional(),
  payment_id: uuid.optional(),
  statement_url: z.string().optional(),
  supporting_documents: z.array(z.string()).optional(),
  is_finalized: z.boolean().optional(),
  finalized_at: z.coerce.date().optional(),
  finalized_by: uuid.optional(),
  notes: z.string().optional(),
  internal_notes: z.string().optional(),
  created_at: z.coerce.date().optional(),
  created_by: uuid.optional(),
  updated_at: z.coerce.date().optional(),
  updated_by: uuid.optional(),
});

export type CommissionStatements = z.infer<typeof CommissionStatementsSchema>;

/**
 * Schema for creating a new commission statements
 */
export const CreateCommissionStatementsSchema = CommissionStatementsSchema.omit({
  // TODO: Add fields to omit for creation
});

export type CreateCommissionStatements = z.infer<typeof CreateCommissionStatementsSchema>;

/**
 * Schema for updating a commission statements
 */
export const UpdateCommissionStatementsSchema = CommissionStatementsSchema.partial();

export type UpdateCommissionStatements = z.infer<typeof UpdateCommissionStatementsSchema>;
