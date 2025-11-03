/**
 * CommissionTracking Schema
 * @table commission_tracking
 * @category 04-financial
 * @synchronized 2025-11-03
 */

import { z } from 'zod';
import { uuid, money } from '../../shared/base-schemas.js';

/**
 * Complete CommissionTracking schema
 */
export const CommissionTrackingSchema = z.object({
  commission_id: uuid,
  tenant_id: uuid,
  property_id: uuid.optional(),
  commission_number: z.string(),
  commission_type: z.string(),
  beneficiary_type: z.string().optional(),
  beneficiary_id: uuid.optional(),
  beneficiary_name: z.string().optional(),
  staff_id: uuid.optional(),
  agent_id: uuid.optional(),
  channel_id: uuid.optional(),
  source_type: z.string().optional(),
  source_id: uuid,
  source_reference: z.string().optional(),
  reservation_id: uuid.optional(),
  booking_id: uuid.optional(),
  invoice_id: uuid.optional(),
  payment_id: uuid.optional(),
  transaction_date: z.coerce.date(),
  check_in_date: z.coerce.date().optional(),
  check_out_date: z.coerce.date().optional(),
  guest_id: uuid.optional(),
  guest_name: z.string().optional(),
  base_amount: money,
  base_currency: z.string().optional(),
  calculation_method: z.string().optional(),
  commission_rate: money.optional(),
  commission_percent: money.optional(),
  flat_rate_amount: money.optional(),
  is_tiered: z.boolean().optional(),
  tier_level: z.number().int().optional(),
  tier_rate: money.optional(),
  tier_details: z.record(z.unknown()).optional(),
  commission_amount: money,
  commission_currency: z.string().optional(),
  is_taxable: z.boolean().optional(),
  tax_rate: money.optional(),
  tax_amount: money.optional(),
  net_commission_amount: money.optional(),
  commission_status: z.string().optional(),
  requires_approval: z.boolean().optional(),
  approved: z.boolean().optional(),
  approved_by: uuid.optional(),
  approved_at: z.coerce.date().optional(),
  approval_notes: z.string().optional(),
  payment_status: z.string().optional(),
  payment_due_date: z.coerce.date().optional(),
  payment_date: z.coerce.date().optional(),
  payment_amount: money.optional(),
  payment_method: z.string().optional(),
  payment_reference: z.string().optional(),
  payment_batch_id: z.string().optional(),
  paid_by: uuid.optional(),
  paid_at: z.coerce.date().optional(),
  partial_payment_count: z.number().int().optional(),
  total_paid: money.optional(),
  outstanding_amount: money.optional(),
  scheduled_payment_date: z.coerce.date().optional(),
  payment_cycle: z.string().optional(),
  performance_tier: z.string().optional(),
  performance_multiplier: money.optional(),
  bonus_amount: money.optional(),
  volume_tier: z.string().optional(),
  volume_bonus: money.optional(),
  total_volume_ytd: money.optional(),
  is_split: z.boolean().optional(),
  split_count: z.number().int().optional(),
  split_percentage: money.optional(),
  primary_commission_id: uuid.optional(),
  split_recipients: z.record(z.unknown()).optional(),
  is_reversible: z.boolean().optional(),
  reversed: z.boolean().optional(),
  reversal_reason: z.string().optional(),
  reversed_at: z.coerce.date().optional(),
  reversed_by: uuid.optional(),
  original_commission_id: uuid.optional(),
  chargeback: z.boolean().optional(),
  chargeback_amount: money.optional(),
  chargeback_reason: z.string().optional(),
  chargeback_date: z.coerce.date().optional(),
  has_adjustments: z.boolean().optional(),
  adjustment_amount: money.optional(),
  adjustment_reason: z.string().optional(),
  adjusted_by: uuid.optional(),
  adjusted_at: z.coerce.date().optional(),
  disputed: z.boolean().optional(),
  dispute_reason: z.string().optional(),
  dispute_filed_at: z.coerce.date().optional(),
  dispute_filed_by: uuid.optional(),
  dispute_resolved: z.boolean().optional(),
  dispute_resolution: z.string().optional(),
  dispute_resolved_at: z.coerce.date().optional(),
  has_cap: z.boolean().optional(),
  cap_amount: money.optional(),
  capped: z.boolean().optional(),
  pre_cap_amount: money.optional(),
  minimum_commission: money.optional(),
  maximum_commission: money.optional(),
  earning_period_start: z.coerce.date().optional(),
  earning_period_end: z.coerce.date().optional(),
  payment_period: z.string().optional(),
  fiscal_year: z.number().int().optional(),
  fiscal_month: z.number().int().optional(),
  fiscal_quarter: z.number().int().optional(),
  accumulated_ytd: money.optional(),
  accumulated_qtd: money.optional(),
  accumulated_mtd: money.optional(),
  contract_id: uuid.optional(),
  commission_rule_id: uuid.optional(),
  rate_card_id: uuid.optional(),
  has_documentation: z.boolean().optional(),
  documentation_urls: z.array(z.string()).optional(),
  notification_sent: z.boolean().optional(),
  notification_sent_at: z.coerce.date().optional(),
  reconciled: z.boolean().optional(),
  reconciled_at: z.coerce.date().optional(),
  reconciled_by: uuid.optional(),
  reconciliation_notes: z.string().optional(),
  gl_posted: z.boolean().optional(),
  gl_posted_at: z.coerce.date().optional(),
  gl_account: z.string().optional(),
  parent_commission_id: uuid.optional(),
  related_commission_ids: z.array(uuid).optional(),
  metadata: z.record(z.unknown()).optional(),
  notes: z.string().optional(),
  internal_notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
  created_at: z.coerce.date().optional(),
  updated_at: z.coerce.date().optional(),
  created_by: uuid.optional(),
  updated_by: uuid.optional(),
  is_deleted: z.boolean().optional(),
  deleted_at: z.coerce.date().optional(),
  deleted_by: uuid.optional(),
});

export type CommissionTracking = z.infer<typeof CommissionTrackingSchema>;

/**
 * Schema for creating a new commission tracking
 */
export const CreateCommissionTrackingSchema = CommissionTrackingSchema.omit({
  // TODO: Add fields to omit for creation
});

export type CreateCommissionTracking = z.infer<typeof CreateCommissionTrackingSchema>;

/**
 * Schema for updating a commission tracking
 */
export const UpdateCommissionTrackingSchema = CommissionTrackingSchema.partial();

export type UpdateCommissionTracking = z.infer<typeof UpdateCommissionTrackingSchema>;
