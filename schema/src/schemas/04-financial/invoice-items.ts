/**
 * InvoiceItems Schema
 * @table invoice_items
 * @category 04-financial
 * @synchronized 2025-11-03
 */

import { z } from 'zod';
import { uuid, money } from '../../shared/base-schemas.js';

/**
 * Complete InvoiceItems schema
 */
export const InvoiceItemsSchema = z.object({
  id: uuid,
  invoice_id: uuid,
  tenant_id: uuid,
  item_type: z.string(),
  item_code: z.string().optional(),
  description: z.string(),
  quantity: money,
  unit_price: money,
  subtotal: money,
  tax_rate: money.optional(),
  tax_amount: money.optional(),
  discount_rate: money.optional(),
  discount_amount: money.optional(),
  total_amount: money,
  service_date: z.coerce.date().optional(),
  reference_type: z.string().optional(),
  reference_id: uuid.optional(),
  line_number: z.number().int().optional(),
  metadata: z.record(z.unknown()).optional(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date().optional(),
  created_by: z.string().optional(),
  updated_by: z.string().optional(),
  is_deleted: z.boolean().optional(),
  deleted_at: z.coerce.date().optional(),
  deleted_by: z.string().optional(),
});

export type InvoiceItems = z.infer<typeof InvoiceItemsSchema>;

/**
 * Schema for creating a new invoice items
 */
export const CreateInvoiceItemsSchema = InvoiceItemsSchema.omit({
  // TODO: Add fields to omit for creation
});

export type CreateInvoiceItems = z.infer<typeof CreateInvoiceItemsSchema>;

/**
 * Schema for updating a invoice items
 */
export const UpdateInvoiceItemsSchema = InvoiceItemsSchema.partial();

export type UpdateInvoiceItems = z.infer<typeof UpdateInvoiceItemsSchema>;
