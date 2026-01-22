/**
 * DEV DOC
 * Module: schemas/02-inventory/companies.ts
 * Description: Companies Schema
 * Table: companies
 * Category: 02-inventory
 * Primary exports: CompaniesSchema, CreateCompaniesSchema, UpdateCompaniesSchema
 * @table companies
 * @category 02-inventory
 * Ownership: Schema package
 */

/**
 * Companies Schema
 * @table companies
 * @category 02-inventory
 * @synchronized 2025-11-14
 */

import { z } from 'zod';

import {
  uuid,
  money
} from '../../shared/base-schemas.js';

/**
 * Complete Companies schema
 */
export const CompaniesSchema = z.object({
  company_id: uuid,
  tenant_id: uuid,
  company_name: z.string(),
  legal_name: z.string().optional(),
  company_code: z.string().optional(),
  company_type: z.string(),
  primary_contact_name: z.string().optional(),
  primary_contact_title: z.string().optional(),
  primary_contact_email: z.string().optional(),
  primary_contact_phone: z.string().optional(),
  billing_contact_name: z.string().optional(),
  billing_contact_email: z.string().optional(),
  billing_contact_phone: z.string().optional(),
  address_line1: z.string().optional(),
  address_line2: z.string().optional(),
  city: z.string().optional(),
  state_province: z.string().optional(),
  postal_code: z.string().optional(),
  country: z.string().optional(),
  credit_limit: money.optional(),
  current_balance: money.optional(),
  payment_terms: z.number().int().optional(),
  payment_terms_type: z.string().optional(),
  credit_status: z.string().optional(),
  commission_rate: money.optional(),
  commission_type: z.string().optional(),
  preferred_rate_code: z.string().optional(),
  discount_percentage: money.optional(),
  tax_id: z.string().optional(),
  tax_exempt: z.boolean().optional(),
  tax_exempt_certificate_number: z.string().optional(),
  tax_exempt_expiry_date: z.coerce.date().optional(),
  contract_number: z.string().optional(),
  contract_start_date: z.coerce.date().optional(),
  contract_end_date: z.coerce.date().optional(),
  contract_status: z.string().optional(),
  auto_renew: z.boolean().optional(),
  website_url: z.string().optional(),
  iata_number: z.string().optional(),
  arc_number: z.string().optional(),
  clia_number: z.string().optional(),
  total_bookings: z.number().int().optional(),
  total_revenue: money.optional(),
  average_booking_value: money.optional(),
  last_booking_date: z.coerce.date().optional(),
  customer_lifetime_value: money.optional(),
  preferred_communication_method: z.string().optional(),
  reporting_frequency: z.string().optional(),
  notes: z.string().optional(),
  internal_notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
  is_active: z.boolean().optional(),
  is_vip: z.boolean().optional(),
  is_blacklisted: z.boolean().optional(),
  blacklist_reason: z.string().optional(),
  requires_approval: z.boolean().optional(),
  created_at: z.coerce.date().optional(),
  created_by: uuid.optional(),
  updated_at: z.coerce.date().optional(),
  updated_by: uuid.optional(),
  is_deleted: z.boolean().optional(),
  deleted_at: z.coerce.date().optional(),
  deleted_by: uuid.optional(),
  version: z.bigint().optional(),
});

export type Companies = z.infer<typeof CompaniesSchema>;

/**
 * Schema for creating a new companies
 */
export const CreateCompaniesSchema = CompaniesSchema.omit({
  // TODO: Add fields to omit for creation
});

export type CreateCompanies = z.infer<typeof CreateCompaniesSchema>;

/**
 * Schema for updating a companies
 */
export const UpdateCompaniesSchema = CompaniesSchema.partial();

export type UpdateCompanies = z.infer<typeof UpdateCompaniesSchema>;
