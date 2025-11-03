/**
 * PaymentTokens Schema
 * @table payment_tokens
 * @category 04-financial
 * @synchronized 2025-11-03
 */

import { z } from 'zod';
import { uuid } from '../../shared/base-schemas.js';

/**
 * Complete PaymentTokens schema
 */
export const PaymentTokensSchema = z.object({
  payment_token_id: uuid,
  tenant_id: uuid,
  property_id: uuid.optional(),
  guest_id: uuid.optional(),
  company_id: uuid.optional(),
  token_reference: z.string(),
  vault_provider: z.string(),
  payment_network: z.string().optional(),
  masked_card_number: z.string(),
  card_expiry_month: z.string().optional(),
  card_expiry_year: z.string().optional(),
  cardholder_name: z.string().optional(),
  billing_address: z.record(z.unknown()).optional(),
  supports_recurring: z.boolean().optional(),
  supports_incidental: z.boolean().optional(),
  supports_card_on_file: z.boolean().optional(),
  three_ds_enrolled: z.boolean().optional(),
  network_token: z.boolean().optional(),
  token_status: z.string(),
  last_used_at: z.coerce.date().optional(),
  last_four: z.string().optional(),
  fingerprint: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
  created_at: z.coerce.date(),
  created_by: uuid.optional(),
  updated_at: z.coerce.date().optional(),
  updated_by: uuid.optional(),
  is_deleted: z.boolean().optional(),
  deleted_at: z.coerce.date().optional(),
  deleted_by: uuid.optional(),
});

export type PaymentTokens = z.infer<typeof PaymentTokensSchema>;

/**
 * Schema for creating a new payment tokens
 */
export const CreatePaymentTokensSchema = PaymentTokensSchema.omit({
  // TODO: Add fields to omit for creation
});

export type CreatePaymentTokens = z.infer<typeof CreatePaymentTokensSchema>;

/**
 * Schema for updating a payment tokens
 */
export const UpdatePaymentTokensSchema = PaymentTokensSchema.partial();

export type UpdatePaymentTokens = z.infer<typeof UpdatePaymentTokensSchema>;
